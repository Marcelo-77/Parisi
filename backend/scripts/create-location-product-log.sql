-- Tabela location_product_log (histórico de alterações de quantity_current em location_product)
-- Chave primária: (location_code_log, product_code_log, sipr_sq_number, entry_datetime_log)

CREATE TABLE IF NOT EXISTS location_product_log (
  location_code_log VARCHAR(50) NOT NULL,
  product_code_log VARCHAR(50) NOT NULL,
  entry_datetime_log TIMESTAMP NOT NULL,
  quantity_current_prev_log INTEGER,
  quantity_current_log INTEGER,
  sipr_sq_number INTEGER NOT NULL,
  PRIMARY KEY (location_code_log, product_code_log, sipr_sq_number, entry_datetime_log)
);

-- Índices opcionais para consultas por location ou product
CREATE INDEX IF NOT EXISTS idx_location_product_log_location ON location_product_log(location_code_log);
CREATE INDEX IF NOT EXISTS idx_location_product_log_product ON location_product_log(product_code_log);
CREATE INDEX IF NOT EXISTS idx_location_product_log_entry ON location_product_log(entry_datetime_log);
