const { query, queryOne, withTransaction } = require('../config/db');
const { removeLocalImage } = require('../config/upload');
const { receiveStock, consumeStock } = require('../utils/stock');
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
      // Opening stock is the product's first batch, so it behaves the same as
      // every delivery that follows it.
      await receiveStock(conn, {
        productId: result.insertId,
        quantity: initialStock,
        costPrice: Number(costPrice) || 0,
        expiryDate: expiryDate || null,
        userId: req.user.id,
        changeType: 'initial',
        note: 'Opening stock',
      });
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
  const { changeType, quantityChange, note, expiryDate, batchNo, costPrice } = req.body;
  const delta = Number(quantityChange);

  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id, name, cost_price FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
    const product = rows[0];
    if (!product) throw ApiError.notFound('Product not found');

    if (delta > 0) {
      // Stock arriving makes a new batch, keeping it separate from what is
      // already on the shelf — different delivery, possibly different date.
      return receiveStock(conn, {
        productId: product.id,
        quantity: delta,
        costPrice: costPrice === undefined ? product.cost_price : Number(costPrice),
        expiryDate: expiryDate || null,
        batchNo: batchNo || null,
        userId: req.user.id,
        changeType,
        note: note || null,
      });
    }

    // Stock leaving comes off the oldest batch first. allowExpired is on
    // because a correction may well be about removing expired units.
    return consumeStock(conn, {
      productId: product.id,
      quantity: Math.abs(delta),
      userId: req.user.id,
      changeType,
      note: note || null,
      allowExpired: true,
    });
  });

  res.json({ success: true, message: 'Stock adjusted', data: result });
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
      'SELECT id, name FROM products WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    const product = rows[0];
    if (!product) throw ApiError.notFound('Product not found');

    // Only expired batches are eligible. Fresh stock of the same product is
    // left alone — that is the whole reason batches exist.
    const [expired] = await conn.query(
      `SELECT COALESCE(SUM(quantity_remaining), 0) AS total
       FROM product_batches
       WHERE product_id = ? AND quantity_remaining > 0
         AND expiry_date IS NOT NULL AND expiry_date < CURDATE()`,
      [product.id]
    );
    const expiredTotal = Number(expired[0].total);
    if (expiredTotal === 0) throw ApiError.badRequest(`Nothing expired to write off for "${product.name}"`);

    const amount = quantity === undefined ? expiredTotal : Number(quantity);
    if (amount <= 0) throw ApiError.badRequest('Nothing to write off');
    if (amount > expiredTotal) {
      throw ApiError.badRequest(`Only ${expiredTotal} expired units of "${product.name}", cannot write off ${amount}`);
    }

    const outcome = await consumeStock(conn, {
      productId: product.id,
      quantity: amount,
      userId: req.user.id,
      changeType: 'expired',
      note: note || 'Expired stock written off',
      allowExpired: true,
      onlyExpired: true,
    });

    return { name: product.name, written_off: amount, ...outcome };
  });

  res.json({ success: true, message: `${result.written_off} × ${result.name} written off`, data: result });
});

/** DELETE /api/products/:id  (admin) — soft delete, because sale history references it */
exports.remove = asyncHandler(async (req, res) => {
  const result = await query('UPDATE products SET is_active = FALSE WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw ApiError.notFound('Product not found');
  res.json({ success: true, message: 'Product deactivated (sale history is preserved)' });
});

/**
 * GET /api/products/:id/batches
 * Every delivery of this product, newest first, with what is left of each.
 */
exports.batches = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT b.id, b.batch_no, b.quantity_received, b.quantity_remaining,
            b.cost_price, b.expiry_date, b.received_at, b.note,
            b.purchase_order_id, o.po_number,
            DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry,
            CASE WHEN b.expiry_date IS NULL THEN 'none'
                 WHEN DATEDIFF(b.expiry_date, CURDATE()) < 0 THEN 'expired'
                 WHEN DATEDIFF(b.expiry_date, CURDATE()) <= 14 THEN 'expiring'
                 ELSE 'ok' END AS expiry_status
     FROM product_batches b
     LEFT JOIN purchase_orders o ON o.id = b.purchase_order_id
     WHERE b.product_id = ?
     ORDER BY (b.quantity_remaining = 0), (b.expiry_date IS NULL), b.expiry_date ASC, b.received_at ASC`,
    [req.params.id]
  );

  const onShelf = rows.filter((r) => r.quantity_remaining > 0);
  res.json({
    success: true,
    data: rows,
    summary: {
      batchCount: onShelf.length,
      totalRemaining: onShelf.reduce((n, r) => n + r.quantity_remaining, 0),
      oldest: onShelf[0] || null,
    },
  });
});

/** GET /api/products/alerts/low-stock */
exports.lowStock = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM v_low_stock ORDER BY stock_quantity ASC');
  res.json({ success: true, data: rows, count: rows.length });
});
