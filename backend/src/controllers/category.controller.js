const { query, queryOne } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** GET /api/categories */
exports.list = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT c.id, c.name, c.description, c.is_active, c.created_at,
            COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
     GROUP BY c.id
     ORDER BY c.name`
  );
  res.json({ success: true, data: rows });
});

/** POST /api/categories  (admin) */
exports.create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const result = await query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
  res.status(201).json({ success: true, data: { id: result.insertId, name, description: description || null } });
});

/** PUT /api/categories/:id  (admin) */
exports.update = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  const existing = await queryOne('SELECT id FROM categories WHERE id = ?', [req.params.id]);
  if (!existing) throw ApiError.notFound('Category not found');

  await query(
    `UPDATE categories SET name = COALESCE(?, name),
                           description = COALESCE(?, description),
                           is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [name ?? null, description ?? null, isActive === undefined ? null : (isActive ? 1 : 0), req.params.id]
  );
  res.json({ success: true, message: 'Category updated' });
});

/** DELETE /api/categories/:id  (admin) */
exports.remove = asyncHandler(async (req, res) => {
  const inUse = await queryOne('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', [req.params.id]);
  if (inUse.n > 0) {
    throw ApiError.conflict(`${inUse.n} product(s) use this category. Reassign them first.`);
  }
  const result = await query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw ApiError.notFound('Category not found');
  res.json({ success: true, message: 'Category deleted' });
});
