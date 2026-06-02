-- Altera a chave primária de location_product para (location_code, product_code, sipr_sq_number).
-- Se a PK atual tiver 4 colunas (incluindo entry_datetime), remove duplicatas antes e depois altera a PK.

-- 1) Remover duplicatas: manter apenas o registro mais recente por (location_code, product_code, sipr_sq_number)
DELETE FROM location_product a
USING location_product b
WHERE a.location_code = b.location_code
  AND a.product_code = b.product_code
  AND a.sipr_sq_number = b.sipr_sq_number
  AND a.entry_datetime < b.entry_datetime;

-- 2) Remover a constraint de PK atual
ALTER TABLE location_product DROP CONSTRAINT IF EXISTS location_product_pkey;

-- 3) Adicionar a nova PK
ALTER TABLE location_product ADD PRIMARY KEY (location_code, product_code, sipr_sq_number);
