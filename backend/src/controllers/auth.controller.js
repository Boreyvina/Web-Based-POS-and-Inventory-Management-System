const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/db');
const { jwt: jwtCfg } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    jwtCfg.secret,
    { expiresIn: jwtCfg.expiresIn }
  );
}

/** POST /api/auth/login  (public) */
exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const user = await queryOne(
    `SELECT u.id, u.username, u.email, u.full_name, u.password_hash, u.is_active, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.username = ? OR u.email = ?`,
    [username, username]
  );

  // Same message for "no such user" and "wrong password" so an attacker
  // can't discover which usernames exist.
  if (!user) throw ApiError.unauthorized('Invalid username or password');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw ApiError.unauthorized('Invalid username or password');
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  res.json({
    success: true,
    data: {
      token: signToken(user),
      user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role },
    },
  });
});

/** POST /api/auth/register  (admin only — staff accounts are created, not self-served) */
exports.register = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, role, phone } = req.body;

  const roleRow = await queryOne('SELECT id FROM roles WHERE name = ?', [role]);
  if (!roleRow) throw ApiError.badRequest(`Unknown role: ${role}`);

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (role_id, username, email, password_hash, full_name, phone)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [roleRow.id, username, email, hash, fullName, phone || null]
  );

  res.status(201).json({
    success: true,
    message: 'User created',
    data: { id: result.insertId, username, email, fullName, role },
  });
});

/** GET /api/auth/me */
exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

/** PATCH /api/auth/password  — change own password */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const row = await queryOne('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ success: true, message: 'Password updated' });
});

/** GET /api/auth/users  (admin) */
exports.listUsers = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.phone, u.is_active,
            u.last_login_at, u.created_at, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
  );
  res.json({ success: true, data: rows });
});

/** PATCH /api/auth/users/:id/status  (admin) */
exports.setUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  if (Number(id) === req.user.id) throw ApiError.badRequest('You cannot deactivate your own account');

  const result = await query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  if (!result.affectedRows) throw ApiError.notFound('User not found');
  res.json({ success: true, message: isActive ? 'User activated' : 'User deactivated' });
});
