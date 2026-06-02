-- Adiciona coluna cust_cd_id na tabela movement (FK para customer)

ALTER TABLE movement
  ADD COLUMN IF NOT EXISTS cust_cd_id INTEGER REFERENCES customer(cust_cd_id);
