-- =====================================================================
--  RESET — DELETES EVERYTHING
--
--  *** THIS DESTROYS ALL YOUR DATA ***
--
--  Every product, every sale, every staff account and every stock record
--  in pos_system is permanently deleted. There is no undo.
--
--  Only run this when you genuinely want to start from nothing, for
--  example after testing before a real demo.
--
--  AFTER RUNNING THIS you must also run, in order:
--     1. schema.sql                (rebuilds the tables and starting rows)
--     2. npm run seed:passwords    (from the backend folder)
--
--  If you only want to clear test SALES but keep your products, do not
--  use this file. Use the three lines at the bottom instead.
-- =====================================================================

DROP DATABASE IF EXISTS pos_system;

-- Now run schema.sql.


-- ---------------------------------------------------------------------
-- Gentler option: clear sales only, keep products and staff.
-- Select these four lines and run just them.
-- ---------------------------------------------------------------------
-- USE pos_system;
-- DELETE FROM inventory_logs WHERE change_type = 'sale' OR change_type = 'void';
-- DELETE FROM sales;                 -- sale_items go with them automatically
-- -- note: this does NOT put the sold stock back on the shelf.
