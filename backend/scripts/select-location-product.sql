-- SELECT na tabela location_product
-- Tabela: location_code, product_code, entry_datetime, sipr_sq_number, quantity_informed, quantity_current, stat_cd_id
-- Chave primária: (location_code, product_code, sipr_sq_number)

-- SELECT simples (todos os registros)
SELECT
  location_code,
  product_code,
  entry_datetime,
  sipr_sq_number,
  quantity_informed,
  quantity_current
FROM location_product
ORDER BY entry_datetime DESC, location_code, product_code;

-- SELECT com descrição da situação (JOIN situation_product)
SELECT
  lp.location_code,
  lp.product_code,
  lp.entry_datetime,
  lp.sipr_sq_number,
  sp.sipr_nm_description AS situation_description,
  lp.quantity_informed,
  lp.quantity_current
FROM location_product lp
LEFT JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
ORDER BY lp.entry_datetime DESC, lp.location_code, lp.product_code;

-- SELECT apenas registros com quantity_current > 0
SELECT
  lp.location_code,
  lp.product_code,
  lp.entry_datetime,
  lp.sipr_sq_number,
  sp.sipr_nm_description AS situation_description,
  lp.quantity_informed,
  lp.quantity_current
FROM location_product lp
LEFT JOIN situation_product sp ON sp.sipr_sq_number = lp.sipr_sq_number
WHERE lp.quantity_current > 0
ORDER BY lp.location_code, lp.entry_datetime DESC;

-- SELECT DISTINCT location_code com quantity_current > 0
SELECT DISTINCT location_code
FROM location_product
WHERE quantity_current > 0
ORDER BY location_code;

