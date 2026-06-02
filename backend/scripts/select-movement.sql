-- SELECT na tabela movement (e movement_item)
-- movement: move_cd_id, tymo_cd_id, cust_cd_id, move_cd_destination, move_dt_movement, move_cd_movement
-- move_cd_destination: 1 = Local, 2 = Inter state, 3 = Pick UP

-- SELECT simples (todos os movimentos)
SELECT
  move_cd_id,
  tymo_cd_id,
  cust_cd_id,
  move_cd_destination,
  move_dt_movement,
  move_cd_movement
FROM movement
ORDER BY move_dt_movement DESC NULLS LAST, move_cd_id DESC;

-- SELECT com nome do tipo e do cliente (JOIN type_movement, customer)
SELECT
  m.move_cd_id,
  m.tymo_cd_id,
  m.cust_cd_id,
  tm.tymo_nm_movement AS type_movement_name,
  c.cust_nm_customer,
  m.move_cd_destination,
  m.move_dt_movement,
  m.move_cd_movement
FROM movement m
LEFT JOIN type_movement tm ON tm.tymo_cd_id = m.tymo_cd_id
LEFT JOIN customer c ON c.cust_cd_id = m.cust_cd_id
ORDER BY m.move_dt_movement DESC NULLS LAST, m.move_cd_id DESC;

-- SELECT com destino em texto e cliente (CASE)
SELECT
  m.move_cd_id,
  m.tymo_cd_id,
  m.cust_cd_id,
  tm.tymo_nm_movement AS type_movement_name,
  c.cust_nm_customer,
  m.move_cd_destination,
  CASE m.move_cd_destination
    WHEN 1 THEN 'Local'
    WHEN 2 THEN 'Inter state'
    WHEN 3 THEN 'Pick UP'
    ELSE NULL
  END AS destination_label,
  m.move_dt_movement,
  m.move_cd_movement
FROM movement m
LEFT JOIN type_movement tm ON tm.tymo_cd_id = m.tymo_cd_id
LEFT JOIN customer c ON c.cust_cd_id = m.cust_cd_id
ORDER BY m.move_dt_movement DESC NULLS LAST, m.move_cd_id DESC;

-- SELECT movimento + itens (uma linha por item)
SELECT
  m.move_cd_id,
  tm.tymo_nm_movement AS type_movement_name,
  c.cust_nm_customer,
  CASE m.move_cd_destination
    WHEN 1 THEN 'Local'
    WHEN 2 THEN 'Inter state'
    WHEN 3 THEN 'Pick UP'
    ELSE NULL
  END AS destination_label,
  m.move_dt_movement,
  m.move_cd_movement,
  mi.product_code,
  mi.move_qt_movement
FROM movement m
LEFT JOIN type_movement tm ON tm.tymo_cd_id = m.tymo_cd_id
LEFT JOIN customer c ON c.cust_cd_id = m.cust_cd_id
LEFT JOIN movement_item mi ON mi.move_cd_id = m.move_cd_id
ORDER BY m.move_dt_movement DESC NULLS LAST, m.move_cd_id, mi.product_code;

-- SELECT movimentos com quantidade de itens (contagem)
SELECT
  m.move_cd_id,
  tm.tymo_nm_movement AS type_movement_name,
  c.cust_nm_customer,
  CASE m.move_cd_destination
    WHEN 1 THEN 'Local'
    WHEN 2 THEN 'Inter state'
    WHEN 3 THEN 'Pick UP'
    ELSE NULL
  END AS destination_label,
  m.move_dt_movement,
  m.move_cd_movement,
  COUNT(mi.product_code) AS items_count
FROM movement m
LEFT JOIN type_movement tm ON tm.tymo_cd_id = m.tymo_cd_id
LEFT JOIN customer c ON c.cust_cd_id = m.cust_cd_id
LEFT JOIN movement_item mi ON mi.move_cd_id = m.move_cd_id
GROUP BY m.move_cd_id, tm.tymo_nm_movement, c.cust_nm_customer, m.move_cd_destination, m.move_dt_movement, m.move_cd_movement
ORDER BY m.move_dt_movement DESC NULLS LAST, m.move_cd_id DESC;
