const { query, queryOne } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/helpers');

/**
 * GET /api/public/products  — the customer-facing catalogue. No login.
 * Deliberately does NOT expose cost_price or exact stock levels: a shopper
 * has no business knowing your margins.
 */
exports.products = asyncHandler(async (req, res) => {
  const { search, categoryId } = req.query;
  const { page, limit, offset } = paginate(req.query);

  const where = ['p.is_active = TRUE'];
  const params = [];
  if (search) {
    where.push('(p.name LIKE ? OR c.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (categoryId) { where.push('p.category_id = ?'); params.push(Number(categoryId)); }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const rows = await query(
    `SELECT p.id, p.name, p.description, p.image_url, p.unit, p.selling_price AS price,
            c.name AS category,
            CASE WHEN p.stock_quantity <= 0 THEN 'out_of_stock'
                 WHEN p.stock_quantity <= p.low_stock_threshold THEN 'low'
                 ELSE 'in_stock' END AS availability
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.name
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const { total } = await queryOne(
    `SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`,
    params
  );

  res.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /api/public/categories */
exports.categories = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT c.id, c.name, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
     WHERE c.is_active = TRUE
     GROUP BY c.id
     HAVING product_count > 0
     ORDER BY c.name`
  );
  res.json({ success: true, data: rows });
});
