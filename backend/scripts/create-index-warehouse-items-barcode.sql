-- Índice para busca por barcode na tabela de produtos (warehouse_items)
CREATE INDEX IF NOT EXISTS idx_warehouse_items_barcode
  ON warehouse_items(barcode);
