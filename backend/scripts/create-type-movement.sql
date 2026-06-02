-- Tabela type_movement (tipos de movimentação)
-- Chave primária: tymo_cd_id (SERIAL = auto incremento)

CREATE TABLE IF NOT EXISTS type_movement (
  tymo_cd_id SERIAL PRIMARY KEY,  -- auto incremento (1, 2, 3, ...)
  tymo_nm_movement VARCHAR(50),
  tymo_cd_control VARCHAR(50)
);

-- Se a tabela já existir sem a coluna, adicionar:
-- ALTER TABLE type_movement ADD COLUMN IF NOT EXISTS tymo_cd_control VARCHAR(50);

-- Dados iniciais (só insere se a tabela estiver vazia)
INSERT INTO type_movement (tymo_nm_movement, tymo_cd_control)
SELECT * FROM (VALUES
  ('Customer Order', 'Low'),
  ('Stock Adjustament', 'Down or UP'),
  ('Product Purchase', 'UP'),
  ('Count Check', 'Down ou UP'),
  ('Movement Between Locations', 'Down or UP')
) AS v(tymo_nm_movement, tymo_cd_control)
WHERE (SELECT COUNT(*) FROM type_movement) = 0;
