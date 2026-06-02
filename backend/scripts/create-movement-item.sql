-- Tabela movement_item (itens de cada movimentação)
-- Chave primária: moit_cd_id (SERIAL)
-- UNIQUE (move_cd_id, product_code) para evitar duplicata de produto no mesmo movimento
-- Referências: movement(move_cd_id), warehouse_items(codigo)

CREATE TABLE IF NOT EXISTS movement_item (
  moit_cd_id     SERIAL PRIMARY KEY,
  move_cd_id     INTEGER NOT NULL REFERENCES movement(move_cd_id) ON DELETE CASCADE,
  product_code   VARCHAR(50) NOT NULL REFERENCES warehouse_items(codigo),
  move_qt_movement INTEGER NOT NULL,
  UNIQUE (move_cd_id, product_code)
);

-- Se a tabela já existir com PK (move_cd_id, product_code), execute:
-- backend/scripts/alter-movement-item-add-moit-id.sql
