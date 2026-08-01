ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS photo TEXT;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'warehouse_items'
  AND column_name = 'photo';
