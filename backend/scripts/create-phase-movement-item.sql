-- Tabela phase_movement_item (itens por fase de movimento)
-- Chave primária: phmi_cd_id (SERIAL)
-- Referências:
--   phmo_sq_id       -> phase_movement(phmo_sq_id)
--   moit_cd_id       -> movement_item(moit_cd_id)
--   id_funcionario   -> funcionarios(id), opcional (NULL permitido)
-- Motivo (phmi_cd_motivo):
--   1 = OK
--   2 = No STOCK
--   3 = Double Check Error
--   4 = Last check Error

CREATE TABLE IF NOT EXISTS phase_movement_item (
  phmi_cd_id             SERIAL PRIMARY KEY,
  phmo_sq_id             INTEGER NOT NULL REFERENCES phase_movement(phmo_sq_id),
  moit_cd_id             INTEGER NOT NULL REFERENCES movement_item(moit_cd_id),
  phmi_qt_movement       INTEGER,
  phmi_qt_picked         INTEGER,
  phmi_qt_double_checked INTEGER,
  phmi_cd_motivo         INTEGER
    CHECK (phmi_cd_motivo IN (1, 2, 3, 4)),
  id_funcionario         UUID REFERENCES funcionarios(id)
);

