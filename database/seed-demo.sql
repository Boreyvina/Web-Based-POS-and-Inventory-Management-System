-- =====================================================================
--  OPTIONAL demo products — do NOT run this on a real shop's database.
--
--  schema.sql already gives you staff accounts and categories. This file
--  adds fifteen sample products on top, so the dashboard charts have
--  something to draw while you develop or rehearse your presentation.
--
--  A few products have expiry dates relative to today, including one already
--  expired and two expiring within a fortnight, so the expiry alerts have
--  something to show.
--
--  No sales are inserted on purpose: ring those up in the app, so the
--  stock deductions and inventory logs are real rather than invented.
--
--  Run AFTER schema.sql. To get back to no products, re-run schema.sql.
-- =====================================================================

USE pos_system;

INSERT INTO products
  (category_id, sku, barcode, name, unit, cost_price, selling_price, stock_quantity, low_stock_threshold, expiry_date)
VALUES
  ((SELECT id FROM categories WHERE name = 'Beverages'),     'BEV-001', '8850001000017', 'Bottled Water 500ml',    'pcs', 0.15, 0.30, 240, 40, NULL),
  ((SELECT id FROM categories WHERE name = 'Beverages'),     'BEV-002', '8850001000024', 'Cola Can 330ml',         'pcs', 0.35, 0.60, 120, 24, NULL),
  ((SELECT id FROM categories WHERE name = 'Beverages'),     'BEV-003', '8850001000031', 'Orange Juice 1L',        'pcs', 1.10, 1.80,  36, 12, DATE_ADD(CURDATE(), INTERVAL 40 DAY)),
  ((SELECT id FROM categories WHERE name = 'Beverages'),     'BEV-004', '8850001000048', 'Energy Drink 250ml',     'pcs', 0.55, 1.00,   8, 12, DATE_ADD(CURDATE(), INTERVAL 90 DAY)),
  ((SELECT id FROM categories WHERE name = 'Snacks'),        'SNK-001', '8850002000016', 'Potato Chips 60g',       'pcs', 0.40, 0.75,  90, 20, DATE_ADD(CURDATE(), INTERVAL 25 DAY)),
  ((SELECT id FROM categories WHERE name = 'Snacks'),        'SNK-002', '8850002000023', 'Chocolate Biscuit Pack', 'pcs', 0.50, 0.90,  64, 20, DATE_ADD(CURDATE(), INTERVAL 60 DAY)),
  ((SELECT id FROM categories WHERE name = 'Snacks'),        'SNK-003', '8850002000030', 'Salted Peanuts 100g',    'pcs', 0.45, 0.80,  15, 20, DATE_ADD(CURDATE(), INTERVAL 8 DAY)),
  ((SELECT id FROM categories WHERE name = 'Dairy & Eggs'),  'DRY-001', '8850003000015', 'Fresh Milk 1L',          'pcs', 1.00, 1.60,  28, 10, DATE_ADD(CURDATE(), INTERVAL 4 DAY)),
  ((SELECT id FROM categories WHERE name = 'Dairy & Eggs'),  'DRY-002', '8850003000022', 'Yoghurt Cup 150g',       'pcs', 0.35, 0.65,  42, 15, DATE_ADD(CURDATE(), INTERVAL 11 DAY)),
  ((SELECT id FROM categories WHERE name = 'Bakery'),        'BAK-001', '8850006000012', 'Sliced Bread 400g',      'pcs', 0.70, 1.20,  20, 10, DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
  ((SELECT id FROM categories WHERE name = 'Household'),     'HHD-001', '8850004000014', 'Bath Soap 90g',          'pcs', 0.30, 0.55,  70, 15, NULL),
  ((SELECT id FROM categories WHERE name = 'Household'),     'HHD-002', '8850004000021', 'Laundry Detergent 1kg',  'pcs', 1.60, 2.50,  18, 10, NULL),
  ((SELECT id FROM categories WHERE name = 'Household'),     'HHD-003', '8850004000038', 'Tissue Box 200 sheets',  'pcs', 0.70, 1.20,   6, 10, NULL),
  ((SELECT id FROM categories WHERE name = 'Instant Food'),  'INS-001', '8850005000013', 'Instant Noodles Cup',    'pcs', 0.25, 0.50, 150, 30, DATE_ADD(CURDATE(), INTERVAL 180 DAY)),
  ((SELECT id FROM categories WHERE name = 'Instant Food'),  'INS-002', '8850005000020', 'Canned Sardines 155g',   'pcs', 0.80, 1.30,  44, 15);

-- Opening-stock audit rows, so inventory_logs matches the stock figures.
INSERT INTO inventory_logs (product_id, user_id, change_type, quantity_change, stock_before, stock_after, note)
SELECT id, 1, 'initial', stock_quantity, 0, stock_quantity, 'Demo opening stock' FROM products;
