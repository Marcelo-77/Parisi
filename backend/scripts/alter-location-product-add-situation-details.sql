-- Location Product: Damaged situation + details of the situation
-- Run on local / Approval Neon / Production Neon as needed.

INSERT INTO situation_product (sipr_nm_description)
SELECT 'Damaged'
WHERE NOT EXISTS (
  SELECT 1
  FROM situation_product
  WHERE LOWER(TRIM(sipr_nm_description)) = 'damaged'
);

ALTER TABLE location_product
  ADD COLUMN IF NOT EXISTS situation_details VARCHAR(500);

COMMENT ON COLUMN location_product.situation_details IS
  'Required when situation is Missing or Damaged. Warehouse stock is updated only for Full.';
