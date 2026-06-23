require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

async function main() {
  await query(`
    ALTER TABLE warehouse_locations
    ADD COLUMN IF NOT EXISTS section VARCHAR(50) NOT NULL DEFAULT 'OTHER'
  `);

  const result = await query(`
    UPDATE warehouse_locations
    SET section = 'TAPWARE',
        atualizado_em = CURRENT_TIMESTAMP
    RETURNING id
  `);

  console.log(`✅ Updated ${result.rowCount} location(s) to section TAPWARE`);
  await closePool();
}

main().catch(async (error) => {
  console.error('❌ Error updating locations section:', error);
  await closePool();
  process.exit(1);
});
