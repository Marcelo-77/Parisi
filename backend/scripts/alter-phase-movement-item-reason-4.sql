-- Permite motivo 4 = "Last check Error" na tabela phase_movement_item (bases já existentes).
-- Executar apenas se a tabela já existir com CHECK (phmi_cd_motivo IN (1, 2, 3)).

ALTER TABLE phase_movement_item
  DROP CONSTRAINT IF EXISTS phase_movement_item_phmi_cd_motivo_check;

ALTER TABLE phase_movement_item
  ADD CONSTRAINT phase_movement_item_phmi_cd_motivo_check
  CHECK (phmi_cd_motivo IN (1, 2, 3, 4));
