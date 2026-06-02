-- Tabela movement (movimentações)
-- Chave primária: move_cd_id (SERIAL)
-- Referências: type_movement (tymo_cd_id), customer (cust_cd_id)

CREATE TABLE IF NOT EXISTS movement (
  move_cd_id          SERIAL PRIMARY KEY,
  tymo_cd_id          INTEGER NOT NULL REFERENCES type_movement(tymo_cd_id),
  cust_cd_id          INTEGER REFERENCES customer(cust_cd_id),
  move_cd_destination INTEGER,
  move_dt_movement    TIMESTAMP,
  move_cd_movement    VARCHAR(50)
);

-- Se a tabela movement já existir sem cust_cd_id, execute:
-- ALTER TABLE movement ADD COLUMN IF NOT EXISTS cust_cd_id INTEGER REFERENCES customer(cust_cd_id);
