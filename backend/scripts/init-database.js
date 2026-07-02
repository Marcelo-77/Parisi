// Script para inicializar o banco de dados PostgreSQL
const { query } = require('../config/database');

async function initDatabase() {
  try {
    console.log('🔄 Criando tabelas do banco de dados...');

    // Criar tabela de funcionários
    await query(`
      CREATE TABLE IF NOT EXISTS funcionarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        telefone VARCHAR(20) NOT NULL,
        cargo VARCHAR(50) NOT NULL,
        departamento VARCHAR(50) NOT NULL,
        data_admissao DATE,
        photo TEXT,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela funcionarios criada/verificada');

    // Adicionar coluna photo se não existir
    try {
      await query(`
        ALTER TABLE funcionarios 
        ADD COLUMN IF NOT EXISTS photo TEXT
      `);
      console.log('✅ Coluna photo adicionada/verificada');
    } catch (error) {
      // Coluna pode já existir, ignorar erro
    }

    // Adicionar coluna password se não existir
    try {
      await query(`
        ALTER TABLE funcionarios 
        ADD COLUMN IF NOT EXISTS password TEXT
      `);
      console.log('✅ Coluna password adicionada/verificada');
    } catch (error) {
      // Coluna pode já existir, ignorar erro
    }

    // Remover coluna salario se existir (migração)
    try {
      await query(`
        ALTER TABLE funcionarios 
        DROP COLUMN IF EXISTS salario
      `);
      console.log('✅ Coluna salario removida (se existia)');
    } catch (error) {
      // Ignorar erro se coluna não existir
    }

    await query(`
      CREATE TABLE IF NOT EXISTS company (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL UNIQUE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela company criada/verificada');

    try {
      await query(`
        ALTER TABLE funcionarios
        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company(id)
      `);
      console.log('✅ Coluna company_id adicionada/verificada em funcionarios');
    } catch (error) {
      // Coluna pode já existir
    }

    await query(`
      INSERT INTO company (name)
      VALUES ('Parisi Bathware Sydney'), ('Double-Y Warehouse System'), ('Alpha & Omega Church')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Company seeds Parisi Bathware Sydney, Double-Y Warehouse System e Alpha & Omega Church verificadas');

    const { ensureChurchServiceOrderSchema } = require('./ensure-church-service-order');
    await ensureChurchServiceOrderSchema();
    console.log('✅ Tabela church_service_order e colunas de posicionamento verificadas');

    // Criar tabela de itens do warehouse
    await query(`
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
      )
    `);
    console.log('✅ Tabela warehouse_items criada/verificada');

    // Migração: adicionar coluna barcode em warehouse_items (bases existentes)
    await query(`
      ALTER TABLE warehouse_items
      ADD COLUMN IF NOT EXISTS barcode NUMERIC(20)
    `);
    console.log('✅ warehouse_items.barcode adicionada/verificada');

    // Criar tabela de movimentações do warehouse
    await query(`
      CREATE TABLE IF NOT EXISTS warehouse_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
        tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
        quantidade INTEGER NOT NULL,
        motivo TEXT,
        data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela warehouse_movements criada/verificada');

    // Criar tabela type_movement (tipos de movimentação)
    await query(`
      CREATE TABLE IF NOT EXISTS type_movement (
        tymo_cd_id SERIAL PRIMARY KEY,
        tymo_nm_movement VARCHAR(50),
        tymo_cd_control VARCHAR(50)
      )
    `);
    await query(`
      ALTER TABLE type_movement ADD COLUMN IF NOT EXISTS tymo_cd_control VARCHAR(50)
    `);
    console.log('✅ Tabela type_movement criada/verificada');

    // Inserir dados iniciais em type_movement (só se a tabela estiver vazia)
    try {
      const countRes = await query(`SELECT COUNT(*) AS n FROM type_movement`);
      const n = countRes.rows && countRes.rows[0] ? parseInt(countRes.rows[0].n, 10) : 0;
      if (n === 0) {
        await query(`
          INSERT INTO type_movement (tymo_nm_movement, tymo_cd_control) VALUES
          ('Customer Order', 'Low'),
          ('Stock Adjustament', 'Down or UP'),
          ('Product Purchase', 'UP'),
          ('Count Check', 'Down ou UP'),
          ('Movement Between Locations', 'Down or UP')
        `);
        console.log('✅ type_movement: dados iniciais inseridos');
      }
    } catch (e) {
      console.warn('⚠️ type_movement: inserção inicial ignorada ou já existente:', e.message);
    }

    // Criar tabela phase_movement (fases do movimento)
    await query(`
      CREATE TABLE IF NOT EXISTS phase_movement (
        phmo_sq_id    SERIAL PRIMARY KEY,
        tymo_sq_id    INTEGER NOT NULL REFERENCES type_movement(tymo_cd_id),
        phmo_ds_phase VARCHAR(50),
        phmo_nr_sequence INTEGER
      )
    `);
    console.log('✅ Tabela phase_movement criada/verificada');

    // Inserir fases 2 e 3 em phase_movement (tymo_cd_id = 1) se não existirem
    try {
      await query(`
        INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
        SELECT 1, 'Order Sent for Picking', 10
        WHERE NOT EXISTS (SELECT 1 FROM phase_movement WHERE phmo_ds_phase = 'Order Sent for Picking')
      `);
      await query(`
        INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
        SELECT 1, 'Separation and Picking', 15
        WHERE NOT EXISTS (SELECT 1 FROM phase_movement WHERE phmo_ds_phase = 'Separation and Picking')
      `);
      await query(`
        INSERT INTO phase_movement (tymo_sq_id, phmo_ds_phase, phmo_nr_sequence)
        SELECT 1, 'Sent for Double Checking', 20
        WHERE NOT EXISTS (SELECT 1 FROM phase_movement WHERE phmo_ds_phase = 'Sent for Double Checking')
      `);
      console.log('✅ phase_movement: fases 2, 3 e 4 verificadas');
    } catch (e) {
      console.warn('⚠️ phase_movement fases 2/3 (pode ser esperado):', e.message);
    }

    // Criar tabela movement (movimentações)
    await query(`
      CREATE TABLE IF NOT EXISTS movement (
        move_cd_id          SERIAL PRIMARY KEY,
        tymo_cd_id          INTEGER NOT NULL REFERENCES type_movement(tymo_cd_id),
        move_cd_destination INTEGER,
        move_dt_movement    TIMESTAMP,
        move_cd_movement    VARCHAR(50)
      )
    `);
    await query(`
      ALTER TABLE movement
      ADD COLUMN IF NOT EXISTS move_cd_destination INTEGER
    `);
    console.log('✅ Tabela movement criada/verificada');

    // Criar tabela movement_item (itens de cada movimentação)
    await query(`
      CREATE TABLE IF NOT EXISTS movement_item (
        moit_cd_id       SERIAL PRIMARY KEY,
        move_cd_id       INTEGER NOT NULL REFERENCES movement(move_cd_id) ON DELETE CASCADE,
        product_code     VARCHAR(50) NOT NULL REFERENCES warehouse_items(codigo),
        move_qt_movement  INTEGER NOT NULL,
        UNIQUE (move_cd_id, product_code)
      )
    `);
    console.log('✅ Tabela movement_item criada/verificada');

    // Criar tabela phase_movement_item (itens por fase de movimento)
    await query(`
      CREATE TABLE IF NOT EXISTS phase_movement_item (
        phmi_cd_id             SERIAL PRIMARY KEY,
        phmo_sq_id             INTEGER NOT NULL REFERENCES phase_movement(phmo_sq_id),
        moit_cd_id             INTEGER NOT NULL REFERENCES movement_item(moit_cd_id),
        phmi_qt_movement       INTEGER,
        phmi_qt_picked         INTEGER,
        phmi_qt_double_checked INTEGER,
        phmi_cd_motivo         INTEGER
          CHECK (phmi_cd_motivo IN (1, 2)),
        id_funcionario         UUID REFERENCES funcionarios(id)
      )
    `);
    console.log('✅ Tabela phase_movement_item criada/verificada');

    // Migração: adicionar id_funcionario em phase_movement_item se não existir
    try {
      await query(`
        ALTER TABLE phase_movement_item
        ADD COLUMN IF NOT EXISTS id_funcionario UUID REFERENCES funcionarios(id)
      `);
      console.log('✅ phase_movement_item: coluna id_funcionario adicionada/verificada');
    } catch (e) {
      console.warn('⚠️ phase_movement_item id_funcionario (pode ser esperado):', e.message);
    }

    // Migração: se movement_item existir sem moit_cd_id, adicionar coluna e alterar PK
    try {
      const hasCol = await query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'movement_item' AND column_name = 'moit_cd_id'
      `);
      if (!hasCol.rows || hasCol.rows.length === 0) {
        await query(`ALTER TABLE movement_item ADD COLUMN moit_cd_id SERIAL`);
        await query(`ALTER TABLE movement_item DROP CONSTRAINT IF EXISTS movement_item_pkey`);
        await query(`ALTER TABLE movement_item ADD PRIMARY KEY (moit_cd_id)`);
        await query(`ALTER TABLE movement_item ADD CONSTRAINT movement_item_move_product_unique UNIQUE (move_cd_id, product_code)`);
        console.log('✅ movement_item: moit_cd_id adicionado e PK alterada');
      }
    } catch (e) {
      console.warn('⚠️ Migração movement_item moit_cd_id (pode ser esperado):', e.message);
    }

    // Criar tabela customer (clientes)
    await query(`
      CREATE TABLE IF NOT EXISTS customer (
        cust_cd_id       SERIAL PRIMARY KEY,
        cust_nm_customer VARCHAR(50),
        cust_cd_code     VARCHAR(20),
        cust_ds_address  VARCHAR(100)
      )
    `);
    console.log('✅ Tabela customer criada/verificada');

    // movement: adicionar FK para customer (cust_cd_id)
    await query(`
      ALTER TABLE movement
      ADD COLUMN IF NOT EXISTS cust_cd_id INTEGER REFERENCES customer(cust_cd_id)
    `);
    console.log('✅ movement.cust_cd_id (FK customer) verificada');

    // Criar tabela de locations do warehouse
    await query(`
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
      )
    `);
    console.log('✅ Tabela warehouse_locations criada/verificada');

    await query(`
      ALTER TABLE warehouse_locations
      ADD COLUMN IF NOT EXISTS section VARCHAR(50) NOT NULL DEFAULT 'OTHER'
    `);
    console.log('✅ warehouse_locations.section verificada');

    await query(`
      ALTER TABLE warehouse_locations
      ADD COLUMN IF NOT EXISTS usuario_inseriu VARCHAR(50)
    `);
    await query(`
      ALTER TABLE warehouse_locations
      ADD COLUMN IF NOT EXISTS usuario_alterou VARCHAR(50)
    `);
    console.log('✅ warehouse_locations.usuario_inseriu / usuario_alterou verificadas');

    // Criar tabela situation_product
    await query(`
      CREATE TABLE IF NOT EXISTS situation_product (
        sipr_sq_number SERIAL PRIMARY KEY,
        sipr_nm_description VARCHAR(255)
      )
    `);
    console.log('✅ Tabela situation_product criada/verificada');

    // Criar tabela system_applications
    await query(`
      CREATE TABLE IF NOT EXISTS system_applications (
        syap_cd_seq SERIAL PRIMARY KEY,
        syap_nm_application VARCHAR(100) NOT NULL,
        syap_ds_detailed VARCHAR(150),
        CONSTRAINT syap_cd_seq_max CHECK (syap_cd_seq >= 1 AND syap_cd_seq <= 9999)
      )
    `);
    console.log('✅ Tabela system_applications criada/verificada');

    const systemApplicationMenus = [
      { application: 'users.html', menuName: 'Users' },
      { application: 'pesquisa.html', menuName: 'Users_search' },
      { application: 'customer.html', menuName: 'Customer' },
      { application: 'warehouse.html', menuName: 'Product' },
      { application: 'special-search-product.html', menuName: 'Product_Special_Search' },
      { application: 'upload-warehouse-map.html', menuName: 'Applications_Upload_Warehouse_Map' },
      { application: 'System-Documentation.html', menuName: 'Applications_System_Documentation' },
      { application: 'System-Documentation-Search.html', menuName: 'Applications_System_Documentation_Search' },
      { application: 'System-settings.html', menuName: 'Applications_System_Settings' },
      { application: 'location.html', menuName: 'Location' },
      { application: 'location-search.html', menuName: 'Location_Search' },
      { application: 'location-product.html', menuName: 'Location_Product' },
      { application: 'log-location-product.html', menuName: 'Location' },
      { application: 'movement.html', menuName: 'Movement' },
      { application: 'movement-situation.html', menuName: 'Movement_Situation' },
      { application: 'picking.html', menuName: 'Picking' },
      { application: 'separation-picking.html', menuName: 'Separation_Picking' },
      { application: 'double-checking.html', menuName: 'Double_Checking' },
      { application: 'last-check-label.html', menuName: 'Packing' },
      { application: 'help.html', menuName: 'Help' },
      { application: 'Order_of_Service.html', menuName: 'Church_Order_of_Service' },
      { application: 'Order_of_Service_Search.html', menuName: 'Church_Order_of_Service_Search' },
      { application: 'applications.html', menuName: 'Applications' },
      { application: 'application_users.html', menuName: 'Applications_Users' },
      { application: 'change-password.html', menuName: 'Users_Change_Password' }
    ];

    for (const item of systemApplicationMenus) {
      await query(
        `INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
         SELECT $1::VARCHAR(100), $2::VARCHAR(150)
         WHERE NOT EXISTS (
           SELECT 1 FROM system_applications WHERE syap_nm_application = $1::VARCHAR(100)
         )`,
        [item.application, item.menuName]
      );
      await query(
        `UPDATE system_applications
         SET syap_ds_detailed = $2::VARCHAR(150)
         WHERE syap_nm_application = $1::VARCHAR(100)`,
        [item.application, item.menuName]
      );
    }
    console.log(`✅ system_applications: ${systemApplicationMenus.length} menu HTML pages verified`);

    await query(`
      UPDATE system_applications
      SET syap_nm_application = 'users.html'
      WHERE syap_nm_application = 'users.html'
    `);

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_system_applications_name
      ON system_applications (syap_nm_application)
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_applications (
        id_funcionario UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
        syap_cd_seq INTEGER NOT NULL REFERENCES system_applications(syap_cd_seq) ON DELETE CASCADE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_funcionario, syap_cd_seq)
      )
    `);
    console.log('✅ Tabela user_applications criada/verificada');

    await query(`
      CREATE TABLE IF NOT EXISTS system_documentation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        file_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100),
        file_size BIGINT,
        uploaded_by UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
        uploaded_by_name VARCHAR(100),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_system_documentation_title ON system_documentation(title)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_system_documentation_criado ON system_documentation(criado_em DESC)`);
    await query(`ALTER TABLE system_documentation ADD COLUMN IF NOT EXISTS file_data BYTEA`);
    console.log('✅ Tabela system_documentation criada/verificada');

    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const defaultSystemSettings = [
      ['show_header_stats', 'true'],
      ['background_color', '#667eea'],
      ['background_color_end', '#764ba2']
    ];
    for (const [key, value] of defaultSystemSettings) {
      await query(
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES ($1, $2)
         ON CONFLICT (setting_key) DO NOTHING`,
        [key, value]
      );
    }
    console.log('✅ Tabela system_settings criada/verificada');

    // Criar tabela location_product (chave primária: location_code, product_code, sipr_sq_number)
    await query(`
      CREATE TABLE IF NOT EXISTS location_product (
        location_code VARCHAR(50) NOT NULL REFERENCES warehouse_locations(location) ON DELETE CASCADE,
        product_code VARCHAR(50) NOT NULL REFERENCES warehouse_items(codigo) ON DELETE CASCADE,
        entry_datetime TIMESTAMP NOT NULL,
        sipr_sq_number INTEGER NOT NULL REFERENCES situation_product(sipr_sq_number) ON DELETE RESTRICT,
        quantity_informed INTEGER DEFAULT 0,
        quantity_current INTEGER DEFAULT 0,
        stat_cd_id VARCHAR(1),
        PRIMARY KEY (location_code, product_code, sipr_sq_number)
      )
    `);
    console.log('✅ Tabela location_product criada/verificada');

    // Migração: alterar PK de (location_code, product_code, entry_datetime, sipr_sq_number) para (location_code, product_code, sipr_sq_number)
    try {
      const cols = await query(`
        SELECT a.column_name FROM information_schema.key_column_usage a
        JOIN information_schema.table_constraints t ON t.constraint_name = a.constraint_name AND t.table_schema = a.table_schema
        WHERE t.table_name = 'location_product' AND t.constraint_type = 'PRIMARY KEY'
        ORDER BY a.ordinal_position
      `);
      const pkColumns = (cols.rows || []).map(r => r.column_name || r.attribute_name);
      if (pkColumns.length === 4 && pkColumns.includes('entry_datetime')) {
        await query(`
          DELETE FROM location_product a USING location_product b
          WHERE a.location_code = b.location_code AND a.product_code = b.product_code AND a.sipr_sq_number = b.sipr_sq_number
          AND a.entry_datetime < b.entry_datetime
        `);
        await query(`ALTER TABLE location_product DROP CONSTRAINT location_product_pkey`);
        await query(`ALTER TABLE location_product ADD PRIMARY KEY (location_code, product_code, sipr_sq_number)`);
        console.log('✅ location_product: PK alterada para (location_code, product_code, sipr_sq_number)');
      }
    } catch (err) {
      console.warn('⚠️ Migração PK location_product (pode ser esperado se já estiver atualizada):', err.message);
    }

    // Renomear sta_cd_id para stat_cd_id se existir; senão adicionar stat_cd_id
    try {
      const statCol = await query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'location_product' AND column_name = 'stat_cd_id'
      `);
      const staCol = await query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'location_product' AND column_name = 'sta_cd_id'
      `);

      if ((staCol.rows || []).length > 0 && (statCol.rows || []).length === 0) {
        await query(`ALTER TABLE location_product RENAME COLUMN sta_cd_id TO stat_cd_id`);
        console.log('✅ Coluna sta_cd_id renomeada para stat_cd_id em location_product');
      } else if ((statCol.rows || []).length === 0) {
        await query(`ALTER TABLE location_product ADD COLUMN IF NOT EXISTS stat_cd_id VARCHAR(1)`);
        console.log('✅ Coluna stat_cd_id adicionada/verificada em location_product');
      }
    } catch (err) {
      console.warn('⚠️ Migração stat_cd_id location_product:', err.message);
    }

    // Atualizar todos os registros de location_product para stat_cd_id = 'A'
    await query(`
      UPDATE location_product SET stat_cd_id = 'A'
    `);
    console.log('✅ location_product: stat_cd_id atualizado para "A"');

    // Tabela location_product_log (histórico de alterações)
    await query(`
      CREATE TABLE IF NOT EXISTS location_product_log (
        location_code_log VARCHAR(50) NOT NULL,
        product_code_log VARCHAR(50) NOT NULL,
        entry_datetime_log TIMESTAMP NOT NULL,
        quantity_current_prev_log INTEGER,
        quantity_current_log INTEGER,
        sipr_sq_number INTEGER NOT NULL,
        PRIMARY KEY (location_code_log, product_code_log, sipr_sq_number, entry_datetime_log)
      )
    `);
    console.log('✅ Tabela location_product_log criada/verificada');

    // Criar índices para melhor performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_items_codigo ON warehouse_items(codigo)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_items_categoria ON warehouse_items(categoria)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_items_barcode ON warehouse_items(barcode)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_movements_item_id ON warehouse_movements(item_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_movements_data ON warehouse_movements(data_movimentacao)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_locations_location ON warehouse_locations(location)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_locations_status ON warehouse_locations(status)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_product_location ON location_product(location_code)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_product_product ON location_product(product_code)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_product_entry ON location_product(entry_datetime)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_product_log_location ON location_product_log(location_code_log)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_product_log_product ON location_product_log(product_code_log)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_product_log_entry ON location_product_log(entry_datetime_log)
    `);
    console.log('✅ Índices criados/verificados');

    // Trigger BEFORE UPDATE em location_product: gravar em location_product_log quando quantity_current mudar
    await query(`
      CREATE OR REPLACE FUNCTION location_product_log_on_update()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.quantity_current IS DISTINCT FROM NEW.quantity_current THEN
          INSERT INTO location_product_log (
            location_code_log,
            product_code_log,
            entry_datetime_log,
            quantity_current_prev_log,
            quantity_current_log,
            sipr_sq_number
          ) VALUES (
            OLD.location_code,
            OLD.product_code,
            CURRENT_TIMESTAMP,
            OLD.quantity_current,
            NEW.quantity_current,
            OLD.sipr_sq_number
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await query(`
      DROP TRIGGER IF EXISTS location_product_before_update_log ON location_product;
      CREATE TRIGGER location_product_before_update_log
        BEFORE UPDATE ON location_product
        FOR EACH ROW
        EXECUTE FUNCTION location_product_log_on_update();
    `);
    console.log('✅ Trigger location_product -> location_product_log criado/verificado');

    // Criar função para atualizar updated_at automaticamente
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.atualizado_em = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Criar triggers para atualizar updated_at
    await query(`
      DROP TRIGGER IF EXISTS update_funcionarios_updated_at ON funcionarios;
      CREATE TRIGGER update_funcionarios_updated_at
        BEFORE UPDATE ON funcionarios
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_warehouse_items_updated_at ON warehouse_items;
      CREATE TRIGGER update_warehouse_items_updated_at
        BEFORE UPDATE ON warehouse_items
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    await query(`
      DROP TRIGGER IF EXISTS update_warehouse_locations_updated_at ON warehouse_locations;
      CREATE TRIGGER update_warehouse_locations_updated_at
        BEFORE UPDATE ON warehouse_locations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Triggers criados/verificados');

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

module.exports = { initDatabase };
