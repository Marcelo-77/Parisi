-- Tabela customer (clientes)
-- Chave primária: cust_cd_id (SERIAL = auto incremento)

CREATE TABLE IF NOT EXISTS customer (
  cust_cd_id     SERIAL PRIMARY KEY,
  cust_nm_customer VARCHAR(50),
  cust_cd_code   VARCHAR(20),
  cust_ds_address VARCHAR(100)
);
