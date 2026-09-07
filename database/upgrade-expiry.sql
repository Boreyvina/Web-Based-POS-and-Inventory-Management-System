-- =====================================================================
--  UPGRADE — adds expiry tracking to a database you already have data in
--
--  Only needed if you created your database BEFORE expiry tracking was
--  added, and you do not want to lose the products already in it.
--
--  If you are setting up fresh, ignore this file: schema.sql already
--  includes everything.
--
--  Running this twice will report "Duplicate column name" — that is
--  harmless and simply means it was already applied.
-- =====================================================================

USE pos_system;

ALTER TABLE products
  ADD COLUMN expiry_date         DATE NULL AFTER low_stock_threshold,
  ADD COLUMN expiry_warning_days INT  NOT NULL DEFAULT 14 AFTER expiry_date,
  ADD INDEX  idx_products_expiry (expiry_date);

ALTER TABLE inventory_logs
  MODIFY COLUMN change_type
    ENUM('initial','sale','restock','adjustment','return','void','expired') NOT NULL;

CREATE OR REPLACE VIEW v_expiring AS
SELECT p.id, p.sku, p.name, c.name AS category,
       p.stock_quantity, p.unit, p.cost_price, p.expiry_date,
       DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
       (p.stock_quantity * p.cost_price)  AS value_at_risk,
       CASE WHEN DATEDIFF(p.expiry_date, CURDATE()) < 0 THEN 'expired'
            ELSE 'expiring' END           AS expiry_status
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = TRUE
  AND p.expiry_date IS NOT NULL
  AND p.stock_quantity > 0
  AND DATEDIFF(p.expiry_date, CURDATE()) <= p.expiry_warning_days;

-- Check it worked:
-- DESCRIBE products;
