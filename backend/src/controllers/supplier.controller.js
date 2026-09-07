const { query, queryOne } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/suppliers */
exports.list = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT s.*,
            COUNT(o.id) AS order_count,
            MAX(o.order_date) AS last_order_date
     FROM suppliers s
     LEFT JOIN purchase_orders o ON o.supplier_id = s.id
     ${req.query.includeInactive === 'true' ? '' : 'WHERE s.is_active = TRUE'}
     GROUP BY s.id
     ORDER BY s.name`
  );
  res.json({ success: true, data: rows });
});

/** POST /api/suppliers */
exports.create = asyncHandler(async (req, res) => {
  const { name, contactPerson, phone, email, address, note } = req.body;
  const result = await query(
    `INSERT INTO suppliers (name, contact_person, phone, email, address, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name.trim(), contactPerson || null, phone || null, email || null, address || null, note || null]
  );
  const supplier = await queryOne('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, message: 'Supplier added', data: supplier });
});

/** PUT /api/suppliers/:id */
exports.update = asyncHandler(async (req, res) => {
  const { name, contactPerson, phone, email, address, note, isActive } = req.body;
  const existing = await queryOne('SELECT id FROM suppliers WHERE id = ?', [req.params.id]);
  if (!existing) throw ApiError.notFound('Supplier not found');

  await query(
    `UPDATE suppliers SET
       name = COALESCE(?, name),
       contact_person = COALESCE(?, contact_person),
       phone = COALESCE(?, phone),
       email = COALESCE(?, email),
       address = COALESCE(?, address),
       note = COALESCE(?, note),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [name ?? null, contactPerson ?? null, phone ?? null, email ?? null, address ?? null,
     note ?? null, isActive === undefined ? null : (isActive ? 1 : 0), req.params.id]
  );
  const supplier = await queryOne('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Supplier updated', data: supplier });
});

/** DELETE /api/suppliers/:id — deactivate, because orders point at it */
exports.remove = asyncHandler(async (req, res) => {
  const result = await query('UPDATE suppliers SET is_active = FALSE WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw ApiError.notFound('Supplier not found');
  res.json({ success: true, message: 'Supplier deactivated (order history is kept)' });
});
