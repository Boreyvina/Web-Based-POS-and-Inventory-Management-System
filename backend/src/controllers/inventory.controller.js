const { query, queryOne } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/helpers');

/** GET /api/inventory/logs?productId=&changeType=&from=&to=&page=&limit=  (admin) */
exports.logs = asyncHandler(async (req, res) => {
  const { productId, changeType, from, to } = req.query;
  const { page, limit, offset } = paginate(req.query);

  const where = [];
  const params = [];
  if (productId) { where.push('l.product_id = ?'); params.push(Number(productId)); }
  if (changeType) { where.push('l.change_type = ?'); params.push(changeType); }
  if (from) { where.push('l.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('l.created_at <= ?'); params.push(`${to} 23:59:59`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT l.id, l.change_type, l.quantity_change, l.stock_before, l.stock_after,
            l.reference_id, l.note, l.created_at,
            p.id AS product_id, p.name AS product_name, p.sku,
            u.full_name AS user_name
     FROM inventory_logs l
     JOIN products p ON p.id = l.product_id
     LEFT JOIN users u ON u.id = l.user_id
     ${whereSql}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const { total } = await queryOne(`SELECT COUNT(*) AS total FROM inventory_logs l ${whereSql}`, params);

  res.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
