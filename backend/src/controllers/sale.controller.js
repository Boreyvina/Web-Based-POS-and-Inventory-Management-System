const { query, queryOne, withTransaction } = require('../config/db');
const { store } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { money, paginate } = require('../utils/helpers');

/**
 * POST /api/sales  — CHECKOUT
 *
 * body: {
 *   items: [{ productId, quantity, discount? }],
 *   paymentMethod: 'cash'|'card'|'mobile'|'other',
 *   amountPaid: number,
 *   discountAmount?: number,   // order-level discount
 *   note?: string
 * }
 *
 * Everything below happens inside ONE transaction. If any product turns out
 * to be short on stock, nothing is written at all — no half-finished sale.
 * Prices come from the DATABASE, never from the request body, so a tampered
 * client can't set its own prices.
 */
exports.checkout = asyncHandler(async (req, res) => {
  const { items, paymentMethod = 'cash', amountPaid = 0, discountAmount = 0, note } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Cart is empty');
  }

  // Merge duplicate lines (scanning the same item twice) into one.
  const merged = new Map();
  for (const item of items) {
    const id = Number(item.productId);
    const qty = Number(item.quantity);
    if (!id || !Number.isInteger(qty) || qty <= 0) {
      throw ApiError.badRequest('Each cart item needs a productId and a positive whole quantity');
    }
    const prev = merged.get(id) || { productId: id, quantity: 0, discount: 0 };
    prev.quantity += qty;
    prev.discount = money(prev.discount + (Number(item.discount) || 0));
    merged.set(id, prev);
  }
  // Sort by id: locking rows in a consistent order prevents deadlocks when
  // two cashiers check out overlapping carts at the same moment.
  const cart = [...merged.values()].sort((a, b) => a.productId - b.productId);

  const saleId = await withTransaction(async (conn) => {
    let subtotal = 0;
    const lines = [];

    for (const line of cart) {
      const [rows] = await conn.query(
        `SELECT id, sku, name, selling_price, stock_quantity, is_active, expiry_date,
                DATEDIFF(expiry_date, CURDATE()) AS days_to_expiry
         FROM products WHERE id = ? FOR UPDATE`,
        [line.productId]
      );
      const product = rows[0];
      if (!product) throw ApiError.badRequest(`Product #${line.productId} does not exist`);
      if (!product.is_active) throw ApiError.badRequest(`"${product.name}" is no longer for sale`);

      // Selling expired goods is the thing expiry tracking exists to prevent,
      // so this is a hard stop rather than a warning. An admin can correct a
      // mistyped date, or write the stock off from the Products screen.
      if (product.expiry_date !== null && product.days_to_expiry < 0) {
        throw ApiError.conflict(
          `"${product.name}" expired on ${String(product.expiry_date).slice(0, 10)} and cannot be sold. ` +
          'Remove it from the shelf and ask an admin to write it off.'
        );
      }
      if (product.stock_quantity < line.quantity) {
        throw ApiError.conflict(
          `Not enough stock for "${product.name}": ${product.stock_quantity} left, ${line.quantity} requested`
        );
      }

      const lineTotal = money(product.selling_price * line.quantity - line.discount);
      if (lineTotal < 0) throw ApiError.badRequest(`Discount on "${product.name}" exceeds the line total`);

      subtotal = money(subtotal + lineTotal);
      lines.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.selling_price,
        quantity: line.quantity,
        lineDiscount: line.discount,
        lineTotal,
        stockBefore: product.stock_quantity,
        stockAfter: product.stock_quantity - line.quantity,
      });
    }

    const orderDiscount = money(Number(discountAmount) || 0);
    if (orderDiscount > subtotal) throw ApiError.badRequest('Discount is larger than the subtotal');

    const taxable = money(subtotal - orderDiscount);
    const taxAmount = money(taxable * (store.taxRate / 100));
    const totalAmount = money(taxable + taxAmount);

    const paid = money(Number(amountPaid) || 0);
    if (paymentMethod === 'cash' && paid < totalAmount) {
      throw ApiError.badRequest(`Amount paid (${paid}) is less than the total (${totalAmount})`);
    }
    const changeDue = paymentMethod === 'cash' ? money(paid - totalAmount) : 0;

    // Insert with a temporary invoice number, then rewrite it using the real
    // auto-increment id. This guarantees uniqueness without a counter table.
    const tempInvoice = `TMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const [saleResult] = await conn.query(
      `INSERT INTO sales
        (invoice_no, user_id, subtotal, discount_amount, tax_amount, total_amount,
         payment_method, amount_paid, change_due, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tempInvoice, req.user.id, subtotal, orderDiscount, taxAmount, totalAmount,
       paymentMethod, paymentMethod === 'cash' ? paid : totalAmount, changeDue, note || null]
    );
    const newSaleId = saleResult.insertId;

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const invoiceNo = `INV-${stamp}-${String(newSaleId).padStart(5, '0')}`;
    await conn.query('UPDATE sales SET invoice_no = ? WHERE id = ?', [invoiceNo, newSaleId]);

    for (const l of lines) {
      await conn.query(
        `INSERT INTO sale_items
          (sale_id, product_id, product_name, sku, unit_price, quantity, line_discount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newSaleId, l.productId, l.productName, l.sku, l.unitPrice, l.quantity, l.lineDiscount, l.lineTotal]
      );
      await conn.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [l.stockAfter, l.productId]);
      await conn.query(
        `INSERT INTO inventory_logs
          (product_id, user_id, change_type, quantity_change, stock_before, stock_after, reference_id, note)
         VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
        [l.productId, req.user.id, -l.quantity, l.stockBefore, l.stockAfter, newSaleId, invoiceNo]
      );
    }

    return newSaleId;
  });

  const sale = await getSaleWithItems(saleId);
  res.status(201).json({ success: true, message: 'Sale completed', data: sale });
});

/** Shared loader: sale header + line items + receipt header info. */
async function getSaleWithItems(id) {
  const sale = await queryOne(
    `SELECT s.*, u.full_name AS cashier_name, u.username AS cashier_username
     FROM sales s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [id]
  );
  if (!sale) throw ApiError.notFound('Sale not found');
  sale.items = await query('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [id]);
  sale.store = { name: store.name, address: store.address, phone: store.phone, currency: store.currency };
  return sale;
}

/** GET /api/sales?from=&to=&cashierId=&status=&page=&limit= */
exports.list = asyncHandler(async (req, res) => {
  const { from, to, cashierId, status, search } = req.query;
  const { page, limit, offset } = paginate(req.query);

  const where = [];
  const params = [];

  // A cashier only ever sees their own transactions — enforced here, on the
  // server, not by hiding a button in the UI.
  if (req.user.role === 'cashier') {
    where.push('s.user_id = ?');
    params.push(req.user.id);
  } else if (cashierId) {
    where.push('s.user_id = ?');
    params.push(Number(cashierId));
  }

  if (from) { where.push('s.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('s.created_at <= ?'); params.push(`${to} 23:59:59`); }
  if (status) { where.push('s.status = ?'); params.push(status); }
  if (search) { where.push('s.invoice_no LIKE ?'); params.push(`%${search}%`); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT s.id, s.invoice_no, s.subtotal, s.discount_amount, s.tax_amount, s.total_amount,
            s.payment_method, s.status, s.created_at,
            u.full_name AS cashier_name,
            (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
     FROM sales s JOIN users u ON u.id = s.user_id
     ${whereSql}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totals = await queryOne(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_amount ELSE 0 END), 0) AS revenue
     FROM sales s ${whereSql}`,
    params
  );

  res.json({
    success: true,
    data: rows,
    summary: { revenue: totals.revenue },
    pagination: { page, limit, total: totals.total, totalPages: Math.ceil(totals.total / limit) },
  });
});

/** GET /api/sales/:id  — full receipt */
exports.getById = asyncHandler(async (req, res) => {
  const sale = await getSaleWithItems(req.params.id);
  if (req.user.role === 'cashier' && sale.user_id !== req.user.id) {
    throw ApiError.forbidden('You can only view your own sales');
  }
  res.json({ success: true, data: sale });
});

/** PATCH /api/sales/:id/void  (admin) — reverses stock and logs it */
exports.voidSale = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  await withTransaction(async (conn) => {
    const [saleRows] = await conn.query('SELECT id, invoice_no, status FROM sales WHERE id = ? FOR UPDATE', [req.params.id]);
    const sale = saleRows[0];
    if (!sale) throw ApiError.notFound('Sale not found');
    if (sale.status !== 'completed') throw ApiError.badRequest(`This sale is already ${sale.status}`);

    const [items] = await conn.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [sale.id]);

    for (const item of items) {
      if (!item.product_id) continue; // product was purged; nothing to restore
      const [rows] = await conn.query('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      if (!rows[0]) continue;
      const before = rows[0].stock_quantity;
      const after = before + item.quantity;
      await conn.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [after, item.product_id]);
      await conn.query(
        `INSERT INTO inventory_logs
          (product_id, user_id, change_type, quantity_change, stock_before, stock_after, reference_id, note)
         VALUES (?, ?, 'void', ?, ?, ?, ?, ?)`,
        [item.product_id, req.user.id, item.quantity, before, after, sale.id,
         `Void ${sale.invoice_no}${reason ? `: ${reason}` : ''}`]
      );
    }

    await conn.query(
      "UPDATE sales SET status = 'voided', note = CONCAT(COALESCE(note, ''), ' [VOIDED: ', ?, ']') WHERE id = ?",
      [reason || 'no reason given', sale.id]
    );
  });

  res.json({ success: true, message: 'Sale voided and stock restored' });
});
