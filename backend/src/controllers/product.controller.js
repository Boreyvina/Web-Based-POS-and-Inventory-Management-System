const { query, queryOne, withTransaction } = require('../config/db');
const { removeLocalImage } = require('../config/upload');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/helpers');

/**
 * Every product needs a unique internal code, but nobody wants to invent one
 * for each item. If the client does not send a SKU we build one from the
 * category initials plus a running number: BEV-0007, SNK-0031, GEN-0002.
 */
async function generateSku(conn, categoryId) {
  let prefix = 'GEN';
  if (categoryId) {
    const [rows] = await conn.query('SELECT name FROM categories WHERE id = ?', [categoryId]);
    if (rows[0]) {
      const letters = rows[0].name.replace(/[^a-zA-Z]/g, '').toUpperCase();
      if (letters.length >= 3) prefix = letters.slice(0, 3);
    }
  }
  const [[{ next }]] = await conn.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(sku, '-', -1) AS UNSIGNED)), 0) + 1 AS next FROM products WHERE sku LIKE ?",
    [`${prefix}-%`]
  );
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

const SELECT_PRODUCT = `
  SELECT p.id, p.sku, p.barcode, p.name, p.description, p.image_url, p.unit,
         p.cost_price, p.selling_price, p.stock_quantity, p.low_stock_threshold,
         p.is_active, p.category_id, c.name AS category_name,
         p.expiry_date, p.expiry_warning_days,
         (p.stock_quantity <= p.low_stock_threshold) AS is_low_stock,
         DATEDIFF(p.expiry_date, CURDATE()) AS days_to_expiry,
         CASE WHEN p.expiry_date IS NULL THEN 'none'
              WHEN DATEDIFF(p.expiry_date, CURDATE()) < 0 THEN 'expired'
              WHEN DATEDIFF(p.expiry_date, CURDATE()) <= p.expiry_warning_days THEN 'expiring'
              ELSE 'ok' END AS expiry_status,
         p.created_at, p.updated_at
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

/** GET /api/products?search=&categoryId=&lowStock=&includeInactive=&page=&limit= */
exports.list = asyncHandler(async (req, res) => {
  const { search, categoryId, lowStock, expiring, includeInactive } = req.query;
  const { page, limit, offset } = paginate(req.query);

  const where = [];
  const params = [];

  if (includeInactive !== 'true') where.push('p.is_active = TRUE');
  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (categoryId) { where.push('p.category_id = ?'); params.push(Number(categoryId)); }
  if (lowStock === 'true') where.push('p.stock_quantity <= p.low_stock_threshold');
  if (expiring === 'true') {
    where.push(
      'p.expiry_date IS NOT NULL AND p.stock_quantity > 0 ' +
      'AND DATEDIFF(p.expiry_date, CURDATE()) <= p.expiry_warning_days'
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `${SELECT_PRODUCT} ${whereSql} ORDER BY p.name LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const { total } = await queryOne(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params);

  res.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /api/products/:id */
exports.getById = asyncHandler(async (req, res) => {
  const product = await queryOne(`${SELECT_PRODUCT} WHERE p.id = ?`, [req.params.id]);
  if (!product) throw ApiError.notFound('Product not found');
  res.json({ success: true, data: product });
});

/** GET /api/products/barcode/:code  — the scanner hot path */
exports.getByBarcode = asyncHandler(async (req, res) => {
  const product = await queryOne(
    `${SELECT_PRODUCT} WHERE (p.barcode = ? OR p.sku = ?) AND p.is_active = TRUE`,
    [req.params.code, req.params.code]
  );
  if (!product) throw ApiError.notFound('No product matches that barcode or SKU');
  res.json({ success: true, data: product });
});

/** POST /api/products  (admin) */
exports.create = asyncHandler(async (req, res) => {
  const {
    sku, barcode, name, description, imageUrl, unit,
    costPrice, sellingPrice, stockQuantity, lowStockThreshold, categoryId,
    expiryDate, expiryWarningDays,
  } = req.body;

  const initialStock = Number(stockQuantity) || 0;

  const id = await withTransaction(async (conn) => {
    const code = sku && sku.trim() ? sku.trim() : await generateSku(conn, categoryId);

    const [result] = await conn.query(
      `INSERT INTO products
        (category_id, sku, barcode, name, description, image_url, unit,
         cost_price, selling_price, stock_quantity, low_stock_threshold,
         expiry_date, expiry_warning_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId || null, code, barcode || null, name, description || null,
        imageUrl || null, unit || 'pcs', Number(costPrice) || 0, Number(sellingPrice),
        initialStock, Number(lowStockThreshold) || 10,
        expiryDate || null, Number(expiryWarningDays) || 14,
      ]
    );

    if (initialStock > 0) {
      await conn.query(
        `INSERT INTO inventory_logs
          (product_id, user_id, change_type, quantity_change, stock_before, stock_after, note)
         VALUES (?, ?, 'initial', ?, 0, ?, 'Product created')`,
        [result.insertId, req.user.id, initialStock, initialStock]
      );
    }
    return result.insertId;
  });

  const product = await queryOne(`${SELECT_PRODUCT} WHERE p.id = ?`, [id]);
  res.status(201).json({ success: true, message: 'Product created', data: product });
});

/** PUT /api/products/:id  (admin) — does NOT change stock; use the stock endpoint */
exports.update = asyncHandler(async (req, res) => {
  const {
    sku, barcode, name, description, imageUrl, unit,
    costPrice, sellingPrice, lowStockThreshold, categoryId, isActive,
    expiryDate, expiryWarningDays,
  } = req.body;

  const existing = await queryOne('SELECT id, image_url, expiry_date FROM products WHERE id = ?', [req.params.id]);
  if (!existing) throw ApiError.notFound('Product not found');

  // image_url is handled explicitly rather than with COALESCE, because the
  // caller must be able to CLEAR a photo by sending null. COALESCE would read
  // that as "leave it alone".
  const imageProvided = Object.prototype.hasOwnProperty.call(req.body, 'imageUrl');
  const nextImage = imageProvided ? (imageUrl || null) : existing.image_url;

  // Same reasoning as the image: the caller must be able to REMOVE an expiry
  // date (a product reclassified as non-perishable), and COALESCE cannot
  // express "set this to nothing".
  const expiryProvided = Object.prototype.hasOwnProperty.call(req.body, 'expiryDate');
  const nextExpiry = expiryProvided ? (expiryDate || null) : existing.expiry_date;

  await query(
    `UPDATE products SET
       sku = COALESCE(?, sku),
       barcode = COALESCE(?, barcode),
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       image_url = ?,
       unit = COALESCE(?, unit),
       cost_price = COALESCE(?, cost_price),
       selling_price = COALESCE(?, selling_price),
       low_stock_threshold = COALESCE(?, low_stock_threshold),
       expiry_date = ?,
       expiry_warning_days = COALESCE(?, expiry_warning_days),
       category_id = COALESCE(?, category_id),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [
      sku ?? null, barcode ?? null, name ?? null, description ?? null, nextImage,
      unit ?? null, costPrice ?? null, sellingPrice ?? null, lowStockThreshold ?? null,
      nextExpiry, expiryWarningDays ?? null,
      categoryId ?? null, isActive === undefined ? null : (isActive ? 1 : 0), req.params.id,
    ]
  );

  // The old photo is now orphaned — delete the file so uploads/ does not grow
  // by one image every time somebody edits a product.
  if (imageProvided && existing.image_url && existing.image_url !== nextImage) {
    removeLocalImage(existing.image_url);
  }

  const product = await queryOne(`${SELECT_PRODUCT} WHERE p.id = ?`, [req.params.id]);
  res.json({ success: true, message: 'Product updated', data: product });
});

/**
 * PATCH /api/products/:id/stock  (admin + cashier)
 * body: { changeType: 'restock'|'adjustment'|'return', quantityChange: number, note? }
 * quantityChange is a DELTA: +12 received, -3 damaged.
 */
exports.adjustStock = asyncHandler(async (req, res) => {
  const { changeType, quantityChange, note } = req.body;
  const delta = Number(quantityChange);

  const result = await withTransaction(async (conn) => {
    // Lock the row so two people adjusting at once can't overwrite each other.
    const [rows] = await conn.query('SELECT id, name, stock_quantity FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
    const product = rows[0];
    if (!product) throw ApiError.notFound('Product not found');

    const before = product.stock_quantity;
    const after = before + delta;
    if (after < 0) throw ApiError.badRequest(`Cannot reduce ${product.name} below zero (current stock: ${before})`);

    await conn.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [after, product.id]);
    await conn.query(
      `INSERT INTO inventory_logs
        (product_id, user_id, change_type, quantity_change, stock_before, stock_after, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product.id, req.user.id, changeType, delta, before, after, note || null]
    );

    return { stockBefore: before, stockAfter: after };
  });

  res.json({ success: true, message: 'Stock adjusted', data: result });
});

/** DELETE /api/products/:id  (admin) — soft delete, because sale history references it */
exports.remove = asyncHandler(async (req, res) => {
  const result = await query('UPDATE products SET is_active = FALSE WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw ApiError.notFound('Product not found');
  res.json({ success: true, message: 'Product deactivated (sale history is preserved)' });
});

/**
 * GET /api/products/alerts/expiring?days=
 * Anything already past its date, or inside its warning window. Sorted with
 * the worst first, because that is the order you deal with them in.
 */
exports.expiring = asyncHandler(async (req, res) => {
  const days = req.query.days === undefined ? null : Number(req.query.days);
  const rows = days === null
    ? await query('SELECT * FROM v_expiring ORDER BY days_left ASC')
    : await query(
        `SELECT p.id, p.sku, p.name, c.name AS category, p.stock_quantity, p.unit,
                p.cost_price, p.expiry_date,
                DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
                (p.stock_quantity * p.cost_price) AS value_at_risk,
                CASE WHEN DATEDIFF(p.expiry_date, CURDATE()) < 0 THEN 'expired'
                     ELSE 'expiring' END AS expiry_status
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = TRUE AND p.expiry_date IS NOT NULL
           AND p.stock_quantity > 0
           AND DATEDIFF(p.expiry_date, CURDATE()) <= ?
         ORDER BY days_left ASC`,
        [days]
      );

  const expired = rows.filter((r) => r.expiry_status === 'expired');
  res.json({
    success: true,
    data: rows,
    count: rows.length,
    expiredCount: expired.length,
    valueAtRisk: rows.reduce((sum, r) => sum + Number(r.value_at_risk), 0),
  });
});

/**
 * POST /api/products/:id/write-off
 * Throw away expired stock. This is just a stock adjustment with its own
 * reason, so the loss shows up in the inventory log as 'expired' rather than
 * being hidden inside a generic correction.
 */
exports.writeOffExpired = asyncHandler(async (req, res) => {
  const { quantity, note } = req.body;

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id, name, stock_quantity, expiry_date FROM products WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    const product = rows[0];
    if (!product) throw ApiError.notFound('Product not found');

    const amount = quantity === undefined ? product.stock_quantity : Number(quantity);
    if (amount <= 0) throw ApiError.badRequest('Nothing to write off');
    if (amount > product.stock_quantity) {
      throw ApiError.badRequest(`Only ${product.stock_quantity} in stock, cannot write off ${amount}`);
    }

    const before = product.stock_quantity;
    const after = before - amount;
    await conn.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [after, product.id]);
    await conn.query(
      `INSERT INTO inventory_logs
        (product_id, user_id, change_type, quantity_change, stock_before, stock_after, note)
       VALUES (?, ?, 'expired', ?, ?, ?, ?)`,
      [product.id, req.user.id, -amount, before, after,
       note || `Expired ${product.expiry_date ? String(product.expiry_date).slice(0, 10) : ''}`.trim()]
    );

    return { name: product.name, written_off: amount, stockBefore: before, stockAfter: after };
  });

  res.json({ success: true, message: `${result.written_off} × ${result.name} written off`, data: result });
});

/** GET /api/products/alerts/low-stock */
exports.lowStock = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM v_low_stock ORDER BY stock_quantity ASC');
  res.json({ success: true, data: rows, count: rows.length });
});
