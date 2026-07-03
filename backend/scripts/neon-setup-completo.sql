-- =============================================================================
-- Double-Y Warehouse System - Setup completo para Neon (PostgreSQL)
-- Equivalente ao backend/scripts/init-database.js + dados iniciais essenciais
--
-- Como usar no Neon:
--   1) Abra o projeto no https://console.neon.tech
--   2) SQL Editor -> cole este arquivo inteiro -> Run
--   3) Pode executar mais de uma vez (usa IF NOT EXISTS / verificacoes)
-- =============================================================================

-- Extensao para UUID (gen_random_uuid) - Neon/PostgreSQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1) FUNCIONARIOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  cargo VARCHAR(50) NOT NULL,
  departamento VARCHAR(50) NOT NULL,
  data_admissao DATE,
  photo TEXT,
  password TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS photo TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS salario;

-- =============================================================================
-- 1b) COMPANY
-- =============================================================================
CREATE TABLE IF NOT EXISTS company (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company(id);

INSERT INTO company (name)
VALUES ('Parisi Bathware Sydney'), ('Double-Y Warehouse System'), ('Alpha & Omega Church')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS church_service_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL DEFAULT 'Ordem de Culto',
  service_date DATE,
  church_name VARCHAR(150),
  dirigente VARCHAR(150),
  opening_act VARCHAR(300),
  worship_songs JSONB NOT NULL DEFAULT '[]'::jsonb,
  scripture_reader VARCHAR(150),
  praise_leader VARCHAR(150),
  praise_status VARCHAR(150),
  offerings_instruction VARCHAR(500),
  message_speaker VARCHAR(150),
  closing_prayer_leader VARCHAR(150),
  priestly_blessing_leader VARCHAR(150),
  announcements_position INTEGER NOT NULL DEFAULT 8,
  scripture_position INTEGER NOT NULL DEFAULT 4,
  created_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE church_service_order
ADD COLUMN IF NOT EXISTS announcements_position INTEGER NOT NULL DEFAULT 8;

ALTER TABLE church_service_order
ADD COLUMN IF NOT EXISTS scripture_position INTEGER NOT NULL DEFAULT 4;

CREATE TABLE IF NOT EXISTS system_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  sector VARCHAR(50),
  file_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  uploaded_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  uploaded_by_name VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_data BYTEA
);

ALTER TABLE system_documentation ADD COLUMN IF NOT EXISTS sector VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_system_documentation_title ON system_documentation(title);
CREATE INDEX IF NOT EXISTS idx_system_documentation_criado ON system_documentation(criado_em DESC);

-- =============================================================================
-- 2) WAREHOUSE (produtos e movimentacoes simples)
-- =============================================================================
CREATE TABLE IF NOT EXISTS warehouse_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  barcode NUMERIC(20),
  nome VARCHAR(100) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  quantidade INTEGER DEFAULT 0,
  quantidade_minima INTEGER DEFAULT 0,
  localizacao VARCHAR(50),
  preco_unitario DECIMAL(10,2) DEFAULT 0,
  fornecedor VARCHAR(100),
  descricao TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS barcode NUMERIC(20);

CREATE TABLE IF NOT EXISTS warehouse_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade INTEGER NOT NULL,
  motivo TEXT,
  data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3) MOVEMENT (tipos, fases, movimentos, picking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS type_movement (
  tymo_cd_id SERIAL PRIMARY KEY,
  tymo_nm_movement VARCHAR(50),
  tymo_cd_control VARCHAR(50)
);

ALTER TABLE type_movement ADD COLUMN IF NOT EXISTS tymo_cd_control VARCHAR(50);

INSERT INTO type_movement (tymo_nm_movement, tymo_cd_control)
SELECT 'Customer Order', 'Low'
WHERE NOT EXISTS (SELECT 1 FROM type_movement WHERE tymo_nm_movement = 'Customer Order');

INSERT INTO type_movement (tymo_nm_movement, tymo_cd_control)
SELECT 'Stock Adjustament', 'Down or UP'
WHERE NOT EXISTS (SELECT 1 FROM type_movement WHERE tymo_nm_movement = 'Stock Adjustament');

INSERT INTO type_movement (tymo_nm_movement, tymo_cd_control)
SELECT 'Product Purchase', 'UP'
WHERE NOT EXISTS (SELECT 1 FROM type_movement WHERE tymo_nm_movement = 'Product Purchase');

INSERT INTO type_movement (tymo_nm_movement, tymo_cd_control)
SELECT 'Count Check', 'Down ou UP'
WHERE NOT EXISTS (SELECT 1 FROM type_movement WHERE tymo_nm_movement = 'Count Check');

INSERT INTO type_movement (tymo_nm_movement, tymo_cd_control)
SELECT 'Movement Between Locations', 'Down or UP'
WHERE NOT EXISTS (SELECT 1 FROM type_movement WHERE tymo_nm_movement = 'Movement Between Locations');

CREATE TABLE IF NOT EXISTS phase_movement (
  phmo_sq_id SERIAL PRIMARY KEY,
  tymo_sq_id INTEGER NOT NULL REFERENCES type_movement(tymo_cd_id),
  phmo_ds_phase VARCHAR(50),
  phmo_nr_sequence INTEGER
);

INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
SELECT 1, 'Order Sent for Picking', 10
WHERE NOT EXISTS (SELECT 1 FROM phase_movement WHERE phmo_ds_phase = 'Order Sent for Picking');

INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
SELECT 1, 'Separation and Picking', 15
WHERE NOT EXISTS (SELECT 1 FROM phase_movement WHERE phmo_ds_phase = 'Separation and Picking');

INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
SELECT 1, 'Sent for Double Checking', 20
WHERE NOT EXISTS (SELECT 1 FROM phase_movement WHERE phmo_ds_phase = 'Sent for Double Checking');

CREATE TABLE IF NOT EXISTS customer (
  cust_cd_id SERIAL PRIMARY KEY,
  cust_nm_customer VARCHAR(50),
  cust_cd_code VARCHAR(20),
  cust_ds_address VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS movement (
  move_cd_id SERIAL PRIMARY KEY,
  tymo_cd_id INTEGER NOT NULL REFERENCES type_movement(tymo_cd_id),
  move_cd_destination INTEGER,
  move_dt_movement TIMESTAMP,
  move_cd_movement VARCHAR(50),
  cust_cd_id INTEGER REFERENCES customer(cust_cd_id)
);

ALTER TABLE movement ADD COLUMN IF NOT EXISTS move_cd_destination INTEGER;
ALTER TABLE movement ADD COLUMN IF NOT EXISTS cust_cd_id INTEGER REFERENCES customer(cust_cd_id);

CREATE TABLE IF NOT EXISTS movement_item (
  moit_cd_id SERIAL PRIMARY KEY,
  move_cd_id INTEGER NOT NULL REFERENCES movement(move_cd_id) ON DELETE CASCADE,
  product_code VARCHAR(50) NOT NULL REFERENCES warehouse_items(codigo),
  move_qt_movement INTEGER NOT NULL,
  UNIQUE (move_cd_id, product_code)
);

CREATE TABLE IF NOT EXISTS phase_movement_item (
  phmi_cd_id SERIAL PRIMARY KEY,
  phmo_sq_id INTEGER NOT NULL REFERENCES phase_movement(phmo_sq_id),
  moit_cd_id INTEGER NOT NULL REFERENCES movement_item(moit_cd_id),
  phmi_qt_movement INTEGER,
  phmi_qt_picked INTEGER,
  phmi_qt_double_checked INTEGER,
  phmi_cd_motivo INTEGER CHECK (phmi_cd_motivo IN (1, 2)),
  id_funcionario UUID REFERENCES funcionarios(id)
);

ALTER TABLE phase_movement_item
  ADD COLUMN IF NOT EXISTS id_funcionario UUID REFERENCES funcionarios(id);

-- =============================================================================
-- 4) LOCATIONS E LOCATION PRODUCT
-- =============================================================================
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL,
  access_type VARCHAR(50) NOT NULL,
  section VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  usuario_inseriu VARCHAR(50),
  usuario_alterou VARCHAR(50),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE warehouse_locations
  ADD COLUMN IF NOT EXISTS section VARCHAR(50) NOT NULL DEFAULT 'OTHER';

ALTER TABLE warehouse_locations
  ADD COLUMN IF NOT EXISTS usuario_inseriu VARCHAR(50);

ALTER TABLE warehouse_locations
  ADD COLUMN IF NOT EXISTS usuario_alterou VARCHAR(50);

UPDATE warehouse_locations
SET section = 'TAPWARE',
    atualizado_em = CURRENT_TIMESTAMP
WHERE section IS DISTINCT FROM 'TAPWARE';

CREATE TABLE IF NOT EXISTS situation_product (
  sipr_sq_number SERIAL PRIMARY KEY,
  sipr_nm_description VARCHAR(255)
);

-- Situacoes obrigatorias para Location Product
INSERT INTO situation_product (sipr_nm_description)
SELECT 'Full' WHERE NOT EXISTS (SELECT 1 FROM situation_product WHERE sipr_nm_description = 'Full');

INSERT INTO situation_product (sipr_nm_description)
SELECT 'Missing' WHERE NOT EXISTS (SELECT 1 FROM situation_product WHERE sipr_nm_description = 'Missing');

INSERT INTO situation_product (sipr_nm_description)
SELECT 'Missing Lid' WHERE NOT EXISTS (SELECT 1 FROM situation_product WHERE sipr_nm_description = 'Missing Lid');

INSERT INTO situation_product (sipr_nm_description)
SELECT 'Missing Filter' WHERE NOT EXISTS (SELECT 1 FROM situation_product WHERE sipr_nm_description = 'Missing Filter');

CREATE TABLE IF NOT EXISTS system_applications (
  syap_cd_seq SERIAL PRIMARY KEY,
  syap_nm_application VARCHAR(100) NOT NULL,
  syap_ds_detailed VARCHAR(150),
  CONSTRAINT syap_cd_seq_max CHECK (syap_cd_seq >= 1 AND syap_cd_seq <= 9999)
);

INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT v.application, v.menu_name
FROM (VALUES
  ('users.html', 'Users'),
  ('pesquisa.html', 'Users_search'),
  ('customer.html', 'Customer'),
  ('warehouse.html', 'Product'),
  ('special-search-product.html', 'Product_Special_Search'),
  ('upload-warehouse-map.html', 'Applications_Upload_Warehouse_Map'),
  ('System-Documentation.html', 'Applications_System_Documentation'),
  ('System-Documentation-Search.html', 'Applications_System_Documentation_Search'),
  ('System-settings.html', 'Applications_System_Settings'),
  ('location.html', 'Location'),
  ('location-search.html', 'Location_Search'),
  ('location-product.html', 'Location_Product'),
  ('log-location-product.html', 'Location'),
  ('movement.html', 'Movement'),
  ('movement-situation.html', 'Movement_Situation'),
  ('picking.html', 'Picking'),
  ('separation-picking.html', 'Separation_Picking'),
  ('double-checking.html', 'Double_Checking'),
  ('last-check-label.html', 'Packing'),
  ('help.html', 'Help'),
  ('Order_of_Service.html', 'Church_Order_of_Service'),
  ('Order_of_Service_Search.html', 'Church_Order_of_Service_Search'),
  ('applications.html', 'Applications'),
  ('application_users.html', 'Applications_Users'),
  ('change-password.html', 'Users_Change_Password')
) AS v(application, menu_name)
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications s WHERE s.syap_nm_application = v.application
);

UPDATE system_applications sa
SET syap_ds_detailed = v.menu_name
FROM (VALUES
  ('users.html', 'Users'),
  ('pesquisa.html', 'Users_search'),
  ('customer.html', 'Customer'),
  ('warehouse.html', 'Product'),
  ('special-search-product.html', 'Product_Special_Search'),
  ('upload-warehouse-map.html', 'Applications_Upload_Warehouse_Map'),
  ('System-Documentation.html', 'Applications_System_Documentation'),
  ('System-Documentation-Search.html', 'Applications_System_Documentation_Search'),
  ('System-settings.html', 'Applications_System_Settings'),
  ('location.html', 'Location'),
  ('location-search.html', 'Location_Search'),
  ('location-product.html', 'Location_Product'),
  ('log-location-product.html', 'Location'),
  ('movement.html', 'Movement'),
  ('movement-situation.html', 'Movement_Situation'),
  ('picking.html', 'Picking'),
  ('separation-picking.html', 'Separation_Picking'),
  ('double-checking.html', 'Double_Checking'),
  ('last-check-label.html', 'Packing'),
  ('help.html', 'Help'),
  ('Order_of_Service.html', 'Church_Order_of_Service'),
  ('Order_of_Service_Search.html', 'Church_Order_of_Service_Search'),
  ('applications.html', 'Applications'),
  ('application_users.html', 'Applications_Users'),
  ('change-password.html', 'Users_Change_Password')
) AS v(application, menu_name)
WHERE sa.syap_nm_application = v.application;

UPDATE system_applications
SET syap_nm_application = 'users.html'
WHERE syap_nm_application = 'index.html';

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_applications_name
ON system_applications (syap_nm_application);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (setting_key, setting_value)
SELECT v.setting_key, v.setting_value
FROM (VALUES
  ('show_header_stats', 'true'),
  ('background_color', '#667eea'),
  ('background_color_end', '#764ba2')
) AS v(setting_key, setting_value)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_applications (
  id_funcionario UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  syap_cd_seq INTEGER NOT NULL REFERENCES system_applications(syap_cd_seq) ON DELETE CASCADE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_funcionario, syap_cd_seq)
);

CREATE TABLE IF NOT EXISTS location_product (
  location_code VARCHAR(50) NOT NULL REFERENCES warehouse_locations(location) ON DELETE CASCADE,
  product_code VARCHAR(50) NOT NULL REFERENCES warehouse_items(codigo) ON DELETE CASCADE,
  entry_datetime TIMESTAMP NOT NULL,
  sipr_sq_number INTEGER NOT NULL REFERENCES situation_product(sipr_sq_number) ON DELETE RESTRICT,
  quantity_informed INTEGER DEFAULT 0,
  quantity_current INTEGER DEFAULT 0,
  stat_cd_id VARCHAR(1),
  usuario_inseriu VARCHAR(50),
  PRIMARY KEY (location_code, product_code, sipr_sq_number)
);

ALTER TABLE location_product ADD COLUMN IF NOT EXISTS stat_cd_id VARCHAR(1);
ALTER TABLE location_product ADD COLUMN IF NOT EXISTS usuario_inseriu VARCHAR(50);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'location_product' AND column_name = 'sta_cd_id'
  ) THEN
    ALTER TABLE location_product RENAME COLUMN sta_cd_id TO stat_cd_id;
  END IF;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

UPDATE location_product SET stat_cd_id = 'A' WHERE stat_cd_id IS NULL;

CREATE TABLE IF NOT EXISTS location_product_log (
  location_code_log VARCHAR(50) NOT NULL,
  product_code_log VARCHAR(50) NOT NULL,
  entry_datetime_log TIMESTAMP NOT NULL,
  quantity_current_prev_log INTEGER,
  quantity_current_log INTEGER,
  sipr_sq_number INTEGER NOT NULL,
  usuario_alterou_log VARCHAR(50),
  operation_log VARCHAR(10),
  PRIMARY KEY (location_code_log, product_code_log, sipr_sq_number, entry_datetime_log)
);

ALTER TABLE location_product_log ADD COLUMN IF NOT EXISTS usuario_alterou_log VARCHAR(50);
ALTER TABLE location_product_log ADD COLUMN IF NOT EXISTS operation_log VARCHAR(10);

-- =============================================================================
-- 5) DADOS OPCIONAIS - CLIENTES (Harvey Norman)
-- =============================================================================
INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST001', '100 George St, Sydney NSW 2000'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST001');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST002', '250 Elizabeth St, Melbourne VIC 3000'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST002');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST003', '270 Queen St, Brisbane QLD 4000'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST003');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST004', '800 Hay St, Perth WA 6000'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST004');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST005', '100 Rundle Mall, Adelaide SA 5000'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST005');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST006', '3 Southport Central, Gold Coast QLD 4215'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST006');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST007', '1 Hunter St, Newcastle NSW 2300'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST007');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST008', '1 Canberra Centre, Canberra ACT 2601'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST008');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST009', '116 Liverpool St, Hobart TAS 7000'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST009');

INSERT INTO customer (cust_nm_customer, cust_cd_code, cust_ds_address)
SELECT 'Harvey Norman', 'CUST010', '159 Church St, Parramatta NSW 2150'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE cust_cd_code = 'CUST010');

-- =============================================================================
-- 6) INDICES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_warehouse_items_codigo ON warehouse_items(codigo);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_categoria ON warehouse_items(categoria);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_barcode ON warehouse_items(barcode);
CREATE INDEX IF NOT EXISTS idx_warehouse_movements_item_id ON warehouse_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_movements_data ON warehouse_movements(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_location ON warehouse_locations(location);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_status ON warehouse_locations(status);
CREATE INDEX IF NOT EXISTS idx_location_product_location ON location_product(location_code);
CREATE INDEX IF NOT EXISTS idx_location_product_product ON location_product(product_code);
CREATE INDEX IF NOT EXISTS idx_location_product_entry ON location_product(entry_datetime);
CREATE INDEX IF NOT EXISTS idx_location_product_log_location ON location_product_log(location_code_log);
CREATE INDEX IF NOT EXISTS idx_location_product_log_product ON location_product_log(product_code_log);
CREATE INDEX IF NOT EXISTS idx_location_product_log_entry ON location_product_log(entry_datetime_log);

-- =============================================================================
-- 7) FUNCOES E TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS location_product_before_update_log ON location_product;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_funcionarios_updated_at ON funcionarios;
CREATE TRIGGER update_funcionarios_updated_at
  BEFORE UPDATE ON funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_warehouse_items_updated_at ON warehouse_items;
CREATE TRIGGER update_warehouse_items_updated_at
  BEFORE UPDATE ON warehouse_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_warehouse_locations_updated_at ON warehouse_locations;
CREATE TRIGGER update_warehouse_locations_updated_at
  BEFORE UPDATE ON warehouse_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FIM - Verificacao rapida (opcional)
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
