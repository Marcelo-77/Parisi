-- Adiciona coluna barcode na tabela warehouse_items
-- Tipo solicitado: NUMBER(20) -> em PostgreSQL usamos NUMERIC(20)

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS barcode NUMERIC(20);
