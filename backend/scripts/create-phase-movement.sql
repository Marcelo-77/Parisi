-- Tabela phase_movement (fases do movimento)
-- Chave primária: phmo_sq_id (SERIAL)
-- Referência: type_movement (tymo_cd_id)

CREATE TABLE IF NOT EXISTS phase_movement (
  phmo_sq_id    SERIAL PRIMARY KEY,
  tymo_sq_id    INTEGER NOT NULL REFERENCES type_movement(tymo_cd_id),
  phmo_ds_phase VARCHAR(50),
  phmo_nr_sequence INTEGER
);
