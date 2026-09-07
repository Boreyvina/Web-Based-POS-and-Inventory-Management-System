const { query, queryOne, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { money, paginate } = require('../utils/helpers');
const { receiveStock } = require('../utils/stock');

/** Load an order with its lines and the supplier's details. */
async function getOrder(id) {
  const order = await queryOne(
    `SELECT o.*, s.name AS supplier_name, s.phone AS supplier_phone,
            u.full_name AS created_by
     FROM purchase_orders o
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     JOIN users u ON u.id = o.user_id
     WHERE o.id = ?`,
    [id]
  );
  if (!order) throw ApiError.notFound('Order not found');

  order.items = await query(
    `SELECT i.*, p.sku, p.stock_quantity AS current_stock,
            (i.quantity_ordered - i.quantity_received) AS quantity_outstanding
     FROM purchase_order_items i
     LEFT JOIN products p ON p.id = i.product_id
     WHERE i.purchase_order_id = ?
     ORDER BY i.id`,
    [id]
  );
  return order;
}

/**
 * POST /api/purchase-orders
 * Raise an order. Nothing touches stock yet — the goods are not here.
 */
exports.create = asyncHandler(async (req, res) => {
  const { supplierId, items, expectedDate, note, status } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('An order needs at least one line');
  }

  const orderId = await withTransaction(async (conn) => {
    const temp = `TMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const wanted = status === 'ordered' ? 'ordered' : 'draft';

    const [result] = await conn.query(
      `INSERT INTO purchase_orders (po_number, supplier_id, user_id, status, order_date, expected_date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [temp, supplierId || null, req.user.id, wanted,
       wanted === 'ordered' ? new Date() : null, expectedDate || null, note || null]
    );
    const id = result.insertId;

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    await conn.query('UPDATE purchase_orders SET po_number = ? WHERE id = ?',
      [`PO-${stamp}-${String(id).padStart(5, '0')}`, id]);

    let total = 0;
    for (const line of items) {
      const productId = Number(line.productId);
      const qty = Number(line.quantity);
      if (!productId || !Number.isInteger(qty) || qty <= 0) {
        throw ApiError.badRequest('Each line needs a product and a positive whole quantity');
      }

      const [rows] = await conn.query('SELECT id, name, cost_price FROM products WHERE id = ?', [productId]);
      const product = rows[0];
      if (!product) throw ApiError.badRequest(`Product #${productId} does not exist`);

      // Default to the product's usual cost, but let the buyer override it —
      // supplier prices change between orders.
      const unitCost = line.unitCost === undefined ? Number(product.cost_price) : Number(line.unitCost);
      const lineTotal = money(unitCost * qty);
      total = money(total + lineTotal);

      await conn.query(
        `INSERT INTO purchase_order_items
          (purchase_order_id, product_id, product_name, quantity_ordered, unit_cost, expiry_date, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, productId, product.name, qty, unitCost, line.expiryDate || null, lineTotal]
      );
    }

    await conn.query('UPDATE purchase_orders SET total_cost = ? WHERE id = ?', [total, id]);
    return id;
  });

  res.status(201).json({ success: true, message: 'Order created', data: await getOrder(orderId) });
});

/** GET /api/purchase-orders?status=&supplierId=&page= */
exports.list = asyncHandler(async (req, res) => {
  const { status, supplierId, search } = req.query;
  const { page, limit, offset } = paginate(req.query);

  const where = [];
  const params = [];
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (supplierId) { where.push('o.supplier_id = ?'); params.push(Number(supplierId)); }
  if (search) { where.push('o.po_number LIKE ?'); params.push(`%${search}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT o.id, o.po_number, o.status, o.order_date, o.expected_date, o.received_date,
            o.total_cost, o.created_at,
            s.name AS supplier_name, u.full_name AS created_by,
            (SELECT COUNT(*) FROM purchase_order_items i WHERE i.purchase_order_id = o.id) AS line_count,
            (SELECT COALESCE(SUM(i.quantity_ordered - i.quantity_received), 0)
             FROM purchase_order_items i WHERE i.purchase_order_id = o.id) AS units_outstanding
     FROM purchase_orders o
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     JOIN users u ON u.id = o.user_id
     ${whereSql}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const { total } = await queryOne(`SELECT COUNT(*) AS total FROM purchase_orders o ${whereSql}`, params);

  res.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /api/purchase-orders/:id */
exports.getById = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getOrder(req.params.id) });
});

/** PATCH /api/purchase-orders/:id/send — draft becomes ordered */
exports.send = asyncHandler(async (req, res) => {
  const order = await queryOne('SELECT id, status FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status !== 'draft') throw ApiError.badRequest(`This order is already ${order.status}`);

  await query("UPDATE purchase_orders SET status = 'ordered', order_date = CURDATE() WHERE id = ?", [req.params.id]);
  res.json({ success: true, message: 'Order marked as sent to the supplier' });
});

/**
 * POST /api/purchase-orders/:id/receive
 *
 * The delivery arrives. body: { lines: [{ itemId, quantity, expiryDate?, batchNo?, unitCost? }] }
 *
 * Each line creates a NEW BATCH, so this delivery stays separate from stock
 * already on the shelf. Partial deliveries are normal: receive what turned up,
 * and the order stays open for the rest.
 */
exports.receive = asyncHandler(async (req, res) => {
  const { lines, note } = req.body;
  if (!Array.isArray(lines) || lines.length === 0) {
    throw ApiError.badRequest('Say which lines arrived');
  }

  await withTransaction(async (conn) => {
    const [orderRows] = await conn.query(
      'SELECT id, po_number, status FROM purchase_orders WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    const order = orderRows[0];
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === 'cancelled') throw ApiError.badRequest('This order was cancelled');
    if (order.status === 'received') throw ApiError.badRequest('This order is already fully received');
    if (order.status === 'draft') throw ApiError.badRequest('Send the order to the supplier before receiving it');

    for (const line of lines) {
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty <= 0) continue; // nothing arrived for this line

      const [itemRows] = await conn.query(
        `SELECT * FROM purchase_order_items
         WHERE id = ? AND purchase_order_id = ? FOR UPDATE`,
        [line.itemId, order.id]
      );
      const item = itemRows[0];
      if (!item) throw ApiError.badRequest(`Line ${line.itemId} is not on this order`);
      if (!item.product_id) throw ApiError.badRequest(`"${item.product_name}" no longer exists as a product`);

      const outstanding = item.quantity_ordered - item.quantity_received;
      if (qty > outstanding) {
        throw ApiError.badRequest(
          `"${item.product_name}": ${outstanding} still outstanding, cannot receive ${qty}`
        );
      }

      const unitCost = line.unitCost === undefined ? Number(item.unit_cost) : Number(line.unitCost);

      await receiveStock(conn, {
        productId: item.product_id,
        quantity: qty,
        costPrice: unitCost,
        expiryDate: line.expiryDate || item.expiry_date || null,
        batchNo: line.batchNo || null,
        purchaseOrderId: order.id,
        userId: req.user.id,
        changeType: 'received',
        note: note || `Delivery for ${order.po_number}`,
      });

      await conn.query(
        'UPDATE purchase_order_items SET quantity_received = quantity_received + ? WHERE id = ?',
        [qty, item.id]
      );

      // If the supplier charged a different price, remember it as the product's
      // new cost. Otherwise your margins slowly become fiction.
      if (line.unitCost !== undefined) {
        await conn.query('UPDATE products SET cost_price = ? WHERE id = ?', [unitCost, item.product_id]);
      }
    }

    // Fully received, or still waiting on some of it?
    const [[remaining]] = await conn.query(
      `SELECT COALESCE(SUM(quantity_ordered - quantity_received), 0) AS outstanding
       FROM purchase_order_items WHERE purchase_order_id = ?`,
      [order.id]
    );

    const nextStatus = Number(remaining.outstanding) === 0 ? 'received' : 'partial';
    await conn.query(
      `UPDATE purchase_orders
       SET status = ?, received_date = CASE WHEN ? = 'received' THEN CURDATE() ELSE received_date END
       WHERE id = ?`,
      [nextStatus, nextStatus, order.id]
    );
  });

  res.json({ success: true, message: 'Delivery recorded', data: await getOrder(req.params.id) });
});

/** PATCH /api/purchase-orders/:id/cancel */
exports.cancel = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const order = await queryOne('SELECT id, status FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status === 'received') throw ApiError.badRequest('A fully received order cannot be cancelled');

  await query(
    "UPDATE purchase_orders SET status = 'cancelled', note = CONCAT(COALESCE(note, ''), ' [CANCELLED: ', ?, ']') WHERE id = ?",
    [reason || 'no reason given', req.params.id]
  );
  res.json({ success: true, message: 'Order cancelled. Any stock already received stays on the shelf.' });
});

/**
 * GET /api/purchase-orders/suggestions
 * What to reorder: anything at or below its reorder level, minus whatever is
 * already on its way, so you do not order the same thing twice.
 */
exports.suggestions = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT p.id AS product_id, p.name, p.sku, p.unit, p.cost_price,
            p.stock_quantity, p.low_stock_threshold,
            COALESCE(o.quantity_on_order, 0) AS on_order,
            o.next_expected,
            GREATEST(p.low_stock_threshold * 2 - p.stock_quantity - COALESCE(o.quantity_on_order, 0), 0)
              AS suggested_quantity
     FROM products p
     LEFT JOIN v_on_order o ON o.product_id = p.id
     WHERE p.is_active = TRUE
       AND p.stock_quantity <= p.low_stock_threshold
     ORDER BY (p.stock_quantity - p.low_stock_threshold) ASC`
  );
  res.json({
    success: true,
    data: rows.filter((r) => r.suggested_quantity > 0),
    count: rows.length,
  });
});
