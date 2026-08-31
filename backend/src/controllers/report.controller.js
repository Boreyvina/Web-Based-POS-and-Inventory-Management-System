const PDFDocument = require('pdfkit');
const { query, queryOne } = require('../config/db');
const { store } = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { toCSV } = require('../utils/helpers');

/** Default range = last 30 days if the client sends nothing. */
function range(qs) {
  const to = qs.to || new Date().toISOString().slice(0, 10);
  const from = qs.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return { from: `${from} 00:00:00`, to: `${to} 23:59:59`, fromDate: from, toDate: to };
}

/** GET /api/reports/summary  (admin) — the four dashboard cards */
exports.summary = asyncHandler(async (req, res) => {
  const today = await queryOne(
    `SELECT COUNT(*) AS transactions, COALESCE(SUM(total_amount), 0) AS revenue
     FROM sales WHERE status = 'completed' AND DATE(created_at) = CURDATE()`
  );
  const month = await queryOne(
    `SELECT COUNT(*) AS transactions, COALESCE(SUM(total_amount), 0) AS revenue
     FROM sales WHERE status = 'completed'
       AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
  );
  const expiry = await queryOne(
    `SELECT
       SUM(CASE WHEN DATEDIFF(expiry_date, CURDATE()) < 0 THEN 1 ELSE 0 END) AS expired_count,
       SUM(CASE WHEN DATEDIFF(expiry_date, CURDATE()) >= 0
                 AND DATEDIFF(expiry_date, CURDATE()) <= expiry_warning_days THEN 1 ELSE 0 END) AS expiring_count,
       COALESCE(SUM(CASE WHEN DATEDIFF(expiry_date, CURDATE()) <= expiry_warning_days
                         THEN stock_quantity * cost_price ELSE 0 END), 0) AS value_at_risk
     FROM products
     WHERE is_active = TRUE AND expiry_date IS NOT NULL AND stock_quantity > 0`
  );

  const inventory = await queryOne(
    `SELECT COUNT(*) AS total_products,
            COALESCE(SUM(stock_quantity), 0) AS total_units,
            COALESCE(SUM(stock_quantity * cost_price), 0) AS stock_value,
            SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) AS low_stock_count,
            SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock_count
     FROM products WHERE is_active = TRUE`
  );

  res.json({
    success: true,
    data: {
      today: { revenue: today.revenue, transactions: today.transactions },
      month: { revenue: month.revenue, transactions: month.transactions },
      inventory,
      expiry: {
        expiredCount: Number(expiry.expired_count) || 0,
        expiringCount: Number(expiry.expiring_count) || 0,
        valueAtRisk: Number(expiry.value_at_risk) || 0,
      },
      currency: store.currency,
    },
  });
});

/** GET /api/reports/revenue?from=&to=&groupBy=day|week|month  → Chart.js line chart */
exports.revenue = asyncHandler(async (req, res) => {
  const { from, to, fromDate, toDate } = range(req.query);
  const groupBy = req.query.groupBy || 'day';

  const formats = {
    day: "DATE_FORMAT(created_at, '%Y-%m-%d')",
    week: "DATE_FORMAT(created_at, '%x-W%v')",
    month: "DATE_FORMAT(created_at, '%Y-%m')",
  };
  const expr = formats[groupBy];
  if (!expr) throw ApiError.badRequest("groupBy must be one of: day, week, month");

  const rows = await query(
    `SELECT ${expr} AS period,
            COUNT(*) AS transactions,
            COALESCE(SUM(total_amount), 0) AS revenue,
            COALESCE(SUM(discount_amount), 0) AS discounts
     FROM sales
     WHERE status = 'completed' AND created_at BETWEEN ? AND ?
     GROUP BY period
     ORDER BY period`,
    [from, to]
  );

  res.json({
    success: true,
    data: {
      range: { from: fromDate, to: toDate, groupBy },
      // Pre-shaped for Chart.js so the frontend just drops it in.
      labels: rows.map((r) => r.period),
      datasets: [
        { label: 'Revenue', data: rows.map((r) => Number(r.revenue)) },
        { label: 'Transactions', data: rows.map((r) => Number(r.transactions)) },
      ],
      rows,
    },
  });
});

/** GET /api/reports/top-products?from=&to=&limit=  → Chart.js bar chart */
exports.topProducts = asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const rows = await query(
    `SELECT si.product_id, si.product_name, si.sku,
            SUM(si.quantity) AS units_sold,
            SUM(si.line_total) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'completed' AND s.created_at BETWEEN ? AND ?
     GROUP BY si.product_id, si.product_name, si.sku
     ORDER BY units_sold DESC
     LIMIT ?`,
    [from, to, limit]
  );

  res.json({
    success: true,
    data: {
      labels: rows.map((r) => r.product_name),
      datasets: [{ label: 'Units sold', data: rows.map((r) => Number(r.units_sold)) }],
      rows,
    },
  });
});

/** GET /api/reports/sales-by-category?from=&to=  → Chart.js doughnut */
exports.byCategory = asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);
  const rows = await query(
    `SELECT COALESCE(c.name, 'Uncategorised') AS category,
            SUM(si.quantity) AS units_sold,
            SUM(si.line_total) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE s.status = 'completed' AND s.created_at BETWEEN ? AND ?
     GROUP BY category
     ORDER BY revenue DESC`,
    [from, to]
  );
  res.json({
    success: true,
    data: {
      labels: rows.map((r) => r.category),
      datasets: [{ label: 'Revenue', data: rows.map((r) => Number(r.revenue)) }],
      rows,
    },
  });
});

/** GET /api/reports/payment-methods?from=&to= */
exports.paymentMethods = asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);
  const rows = await query(
    `SELECT payment_method, COUNT(*) AS transactions, COALESCE(SUM(total_amount), 0) AS revenue
     FROM sales
     WHERE status = 'completed' AND created_at BETWEEN ? AND ?
     GROUP BY payment_method
     ORDER BY revenue DESC`,
    [from, to]
  );
  res.json({ success: true, data: { labels: rows.map((r) => r.payment_method), rows } });
});

/** GET /api/reports/stock-levels  → Chart.js bar chart of the lowest stock */
exports.stockLevels = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
  const rows = await query(
    `SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold, c.name AS category
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = TRUE
     ORDER BY (p.stock_quantity - p.low_stock_threshold) ASC
     LIMIT ?`,
    [limit]
  );
  res.json({
    success: true,
    data: {
      labels: rows.map((r) => r.name),
      datasets: [
        { label: 'In stock', data: rows.map((r) => Number(r.stock_quantity)) },
        { label: 'Threshold', data: rows.map((r) => Number(r.low_stock_threshold)) },
      ],
      rows,
    },
  });
});

/* -------------------------------------------------------------------- */
/*  Exports                                                             */
/* -------------------------------------------------------------------- */

async function fetchExportRows(type, from, to) {
  if (type === 'sales') {
    return query(
      `SELECT s.invoice_no, DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') AS date,
              u.full_name AS cashier, s.payment_method, s.status,
              s.subtotal, s.discount_amount, s.tax_amount, s.total_amount
       FROM sales s JOIN users u ON u.id = s.user_id
       WHERE s.created_at BETWEEN ? AND ?
       ORDER BY s.created_at`,
      [from, to]
    );
  }
  if (type === 'inventory') {
    return query(
      `SELECT p.sku, p.name, COALESCE(c.name, '-') AS category, p.unit,
              p.cost_price, p.selling_price, p.stock_quantity, p.low_stock_threshold,
              (p.stock_quantity * p.cost_price) AS stock_value,
              COALESCE(DATE_FORMAT(p.expiry_date, '%Y-%m-%d'), '-') AS expiry_date,
              CASE WHEN p.expiry_date IS NULL THEN '-'
                   WHEN DATEDIFF(p.expiry_date, CURDATE()) < 0 THEN 'EXPIRED'
                   WHEN DATEDIFF(p.expiry_date, CURDATE()) <= p.expiry_warning_days THEN 'EXPIRING'
                   ELSE 'OK' END AS expiry_status,
              CASE WHEN p.stock_quantity <= p.low_stock_threshold THEN 'LOW' ELSE 'OK' END AS status
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = TRUE
       ORDER BY p.name`
    );
  }
  if (type === 'expiry') {
    return query(
      `SELECT p.sku, p.name, COALESCE(c.name, '-') AS category,
              p.stock_quantity, p.unit, p.cost_price,
              DATE_FORMAT(p.expiry_date, '%Y-%m-%d') AS expiry_date,
              DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
              (p.stock_quantity * p.cost_price) AS value_at_risk,
              CASE WHEN DATEDIFF(p.expiry_date, CURDATE()) < 0 THEN 'EXPIRED' ELSE 'EXPIRING' END AS status
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = TRUE AND p.expiry_date IS NOT NULL AND p.stock_quantity > 0
         AND DATEDIFF(p.expiry_date, CURDATE()) <= p.expiry_warning_days
       ORDER BY days_left ASC`
    );
  }
  throw ApiError.badRequest("type must be 'sales', 'inventory' or 'expiry'");
}

/** GET /api/reports/export?type=sales|inventory&format=csv|pdf&from=&to=  (admin) */
exports.exportReport = asyncHandler(async (req, res) => {
  const { type = 'sales', format = 'csv' } = req.query;
  const { from, to, fromDate, toDate } = range(req.query);

  const rows = await fetchExportRows(type, from, to);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${type}-report-${stamp}`;

  if (format === 'csv') {
    if (!rows.length) throw ApiError.notFound('No data in that range');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(toCSV(rows));
  }

  if (format !== 'pdf') throw ApiError.badRequest("format must be 'csv' or 'pdf'");

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text(store.name, { align: 'center' });
  const titles = { sales: 'Sales', inventory: 'Inventory', expiry: 'Expiry' };
  doc.fontSize(12).text(
    `${titles[type] || 'Inventory'} Report` +
    (type === 'sales' ? `  (${fromDate} to ${toDate})` : ''),
    { align: 'center' }
  );
  doc.moveDown(1);

  if (!rows.length) {
    doc.fontSize(11).text('No data in the selected range.');
    doc.end();
    return;
  }

  const headers = Object.keys(rows[0]);
  const usable = doc.page.width - 72;
  const colWidth = usable / headers.length;
  let y = doc.y;

  const drawRow = (values, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    values.forEach((v, i) => {
      doc.text(String(v ?? ''), 36 + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
    });
    y += 16;
    if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
  };

  drawRow(headers.map((h) => h.replace(/_/g, ' ').toUpperCase()), true);
  rows.forEach((r) => drawRow(headers.map((h) => r[h])));

  if (type === 'sales') {
    const total = rows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    y += 8;
    drawRow(headers.map((h, i) => (i === headers.length - 1 ? total.toFixed(2) : i === 0 ? 'TOTAL' : '')), true);
  }

  doc.end();
});
