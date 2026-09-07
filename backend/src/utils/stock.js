const ApiError = require('./ApiError');

/**
 * All stock movement goes through this file.
 *
 * The rule: products.stock_quantity is never edited directly anywhere else.
 * It is a running total, recalculated from the batches after every change, so
 * the number on the product list can never drift away from the batches behind
 * it. One place to get right instead of six.
 */

/**
 * Recalculate a product's headline figures from its batches.
 *
 * stock_quantity  = everything still unsold across all batches
 * expiry_date     = the EARLIEST expiry still on the shelf, because that is
 *                   the one that matters. When the oldest batch sells out,
 *                   the product's date automatically becomes the next one.
 */
async function refreshProduct(conn, productId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(quantity_remaining), 0) AS total,
            MIN(CASE WHEN quantity_remaining > 0 THEN expiry_date END) AS next_expiry
     FROM product_batches WHERE product_id = ?`,
    [productId]
  );
  const { total, next_expiry: nextExpiry } = rows[0];

  await conn.query(
    'UPDATE products SET stock_quantity = ?, expiry_date = ? WHERE id = ?',
    [total, nextExpiry, productId]
  );
  return { stock: Number(total), expiryDate: nextExpiry };
}

/**
 * Stock coming IN: a delivery, a customer return, a positive correction.
 * Always creates a new batch — that is what keeps new stock separate from old.
 */
async function receiveStock(conn, opts) {
  const {
    productId, quantity, costPrice = 0, expiryDate = null, batchNo = null,
    purchaseOrderId = null, userId = null, changeType = 'restock', note = null,
  } = opts;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw ApiError.badRequest('Quantity received must be a positive whole number');
  }

  const [before] = await conn.query(
    'SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM product_batches WHERE product_id = ?',
    [productId]
  );
  const stockBefore = Number(before[0].total);

  const [batch] = await conn.query(
    `INSERT INTO product_batches
      (product_id, batch_no, purchase_order_id, quantity_received, quantity_remaining,
       cost_price, expiry_date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [productId, batchNo, purchaseOrderId, quantity, quantity, costPrice, expiryDate, note]
  );

  const { stock: stockAfter } = await refreshProduct(conn, productId);

  await conn.query(
    `INSERT INTO inventory_logs
      (product_id, user_id, change_type, quantity_change, stock_before, stock_after,
       reference_id, batch_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [productId, userId, changeType, quantity, stockBefore, stockAfter,
     purchaseOrderId, batch.insertId, note]
  );

  return { batchId: batch.insertId, stockBefore, stockAfter };
}

/**
 * Stock going OUT: a sale, a write-off, a negative correction.
 *
 * Takes from batches in FEFO order — First Expired, First Out. The batch that
 * goes off soonest is sold first, which is what a shopkeeper does by hand when
 * they rotate the shelf. Batches with no expiry date fall to the back and are
 * taken oldest-delivery-first instead.
 *
 * A single sale can span several batches: 5 units where the oldest batch has
 * 2 left takes 2 from that one and 3 from the next.
 */
async function consumeStock(conn, opts) {
  const {
    productId, quantity, userId = null, changeType = 'sale',
    referenceId = null, note = null, allowExpired = false, onlyExpired = false,
  } = opts;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw ApiError.badRequest('Quantity must be a positive whole number');
  }

  // Lock the batch rows for this product so two tills cannot take the same
  // units. ORDER BY here is the FEFO rule: NULL expiry dates sort last.
  const [batches] = await conn.query(
    `SELECT id, quantity_remaining, expiry_date, cost_price
     FROM product_batches
     WHERE product_id = ? AND quantity_remaining > 0
       ${onlyExpired ? 'AND expiry_date IS NOT NULL AND expiry_date < CURDATE()' : ''}
     ORDER BY (expiry_date IS NULL), expiry_date ASC, received_at ASC, id ASC
     FOR UPDATE`,
    [productId]
  );

  const available = batches.reduce((sum, b) => sum + b.quantity_remaining, 0);
  if (available < quantity) {
    const [[product]] = await conn.query('SELECT name FROM products WHERE id = ?', [productId]);
    throw ApiError.conflict(
      `Not enough stock for "${product ? product.name : `product #${productId}`}": ` +
      `${available} available, ${quantity} requested`
    );
  }

  const stockBefore = (await conn.query(
    'SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM product_batches WHERE product_id = ?',
    [productId]
  ))[0][0].total;

  let outstanding = quantity;
  const taken = [];

  for (const batch of batches) {
    if (outstanding === 0) break;

    if (!allowExpired && batch.expiry_date && new Date(batch.expiry_date) < startOfToday()) {
      const [[product]] = await conn.query('SELECT name FROM products WHERE id = ?', [productId]);
      throw ApiError.conflict(
        `The oldest stock of "${product.name}" expired on ${asDate(batch.expiry_date)}. ` +
        'Write it off before selling the newer stock.'
      );
    }

    const take = Math.min(batch.quantity_remaining, outstanding);
    await conn.query(
      'UPDATE product_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?',
      [take, batch.id]
    );
    taken.push({ batchId: batch.id, quantity: take, expiryDate: batch.expiry_date, costPrice: batch.cost_price });
    outstanding -= take;
  }

  const { stock: stockAfter } = await refreshProduct(conn, productId);

  // One log row per batch touched, so the trail shows exactly which stock went.
  let running = Number(stockBefore);
  for (const t of taken) {
    await conn.query(
      `INSERT INTO inventory_logs
        (product_id, user_id, change_type, quantity_change, stock_before, stock_after,
         reference_id, batch_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, userId, changeType, -t.quantity, running, running - t.quantity,
       referenceId, t.batchId, note]
    );
    running -= t.quantity;
  }

  return { stockBefore: Number(stockBefore), stockAfter, batches: taken };
}

/** Put stock back where it came from — used when voiding a sale. */
async function returnStock(conn, opts) {
  const { productId, quantity, userId = null, referenceId = null, note = null, batchId = null } = opts;

  const [before] = await conn.query(
    'SELECT COALESCE(SUM(quantity_remaining), 0) AS total FROM product_batches WHERE product_id = ?',
    [productId]
  );
  const stockBefore = Number(before[0].total);

  // If we know which batch it came from, put it back there so the expiry date
  // travels with it. Otherwise treat it as a fresh return with no date.
  let usedBatch = batchId;
  if (batchId) {
    const [rows] = await conn.query('SELECT id FROM product_batches WHERE id = ? FOR UPDATE', [batchId]);
    if (rows[0]) {
      await conn.query(
        'UPDATE product_batches SET quantity_remaining = quantity_remaining + ? WHERE id = ?',
        [quantity, batchId]
      );
    } else {
      usedBatch = null;
    }
  }

  if (!usedBatch) {
    const [batch] = await conn.query(
      `INSERT INTO product_batches
        (product_id, quantity_received, quantity_remaining, cost_price, note)
       VALUES (?, ?, ?, (SELECT cost_price FROM products WHERE id = ?), ?)`,
      [productId, quantity, quantity, productId, note || 'Returned stock']
    );
    usedBatch = batch.insertId;
  }

  const { stock: stockAfter } = await refreshProduct(conn, productId);

  await conn.query(
    `INSERT INTO inventory_logs
      (product_id, user_id, change_type, quantity_change, stock_before, stock_after,
       reference_id, batch_id, note)
     VALUES (?, ?, 'void', ?, ?, ?, ?, ?, ?)`,
    [productId, userId, quantity, stockBefore, stockAfter, referenceId, usedBatch, note]
  );

  return { stockBefore, stockAfter };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function asDate(value) {
  return String(value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

module.exports = { refreshProduct, receiveStock, consumeStock, returnStock };
