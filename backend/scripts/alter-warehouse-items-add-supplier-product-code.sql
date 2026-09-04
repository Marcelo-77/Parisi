-- Add supplier_product_code to warehouse_items (Bath LIST import / product maintenance)
-- Run in Neon SQL Editor (Approval or Production) if needed before/after deploy.

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS supplier_product_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_supplier_product_code
  ON warehouse_items(supplier_product_code);

-- Optional check:
-- SELECT codigo, nome, subcategoria, supplier_product_code, barcode
-- FROM warehouse_items
-- WHERE supplier_product_code IS NOT NULL
-- ORDER BY atualizado_em DESC
-- LIMIT 50;
