-- Adiciona coluna moit_cd_id (INTEGER/SERIAL) e torna chave primária
-- 1) Adicionar coluna (SERIAL = auto incremento)
-- 2) Remover PK antiga (move_cd_id, product_code)
-- 3) Definir nova PK (moit_cd_id)
-- 4) Manter unicidade (move_cd_id, product_code) com UNIQUE

ALTER TABLE movement_item
  ADD COLUMN IF NOT EXISTS moit_cd_id SERIAL;

ALTER TABLE movement_item
  DROP CONSTRAINT IF EXISTS movement_item_pkey;

ALTER TABLE movement_item
  ADD PRIMARY KEY (moit_cd_id);

ALTER TABLE movement_item
  ADD CONSTRAINT movement_item_move_product_unique UNIQUE (move_cd_id, product_code);
