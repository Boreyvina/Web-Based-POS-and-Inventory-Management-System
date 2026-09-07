const jwt = require('jsonwebtoken');
const { jwt: jwtCfg } = require('../config/env');
const { queryOne } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Reads "Authorization: Bearer <token>", verifies it, and attaches
 * req.user = { id, username, role }.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }
  const token = header.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, jwtCfg.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Session expired, please log in again');
    throw ApiError.unauthorized('Invalid token');
  }

  // Re-check the user each request: a disabled account must lose access
  // immediately, not when the token happens to expire.
  const user = await queryOne(
    `SELECT u.id, u.username, u.full_name, u.email, u.is_active, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [payload.sub]
  );
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated');

  req.user = { id: user.id, username: user.username, fullName: user.full_name, email: user.email, role: user.role };
  next();
});

/** Usage: router.post('/', authenticate, authorize('admin'), handler) */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${allowedRoles.join(' or ')}`));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
