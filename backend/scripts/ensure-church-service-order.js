const { query, pool } = require('../config/database');

async function main() {
  await query(`
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
    )
  `);

  await query(`
    ALTER TABLE church_service_order
    ADD COLUMN IF NOT EXISTS announcements_position INTEGER NOT NULL DEFAULT 8
  `);

  await query(`
    ALTER TABLE church_service_order
    ADD COLUMN IF NOT EXISTS scripture_position INTEGER NOT NULL DEFAULT 4
  `);

  await query(`
    INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
    SELECT 'Order_of_Service.html', 'Church_Order_of_Service'
    WHERE NOT EXISTS (
      SELECT 1 FROM system_applications WHERE syap_nm_application = 'Order_of_Service.html'
    )
  `);

  await query(`
    INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
    SELECT 'Order_of_Service_Search.html', 'Church_Order_of_Service_Search'
    WHERE NOT EXISTS (
      SELECT 1 FROM system_applications WHERE syap_nm_application = 'Order_of_Service_Search.html'
    )
  `);

  console.log('church_service_order table and applications are ready.');
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error.message);
    pool.end();
    process.exit(1);
  });
