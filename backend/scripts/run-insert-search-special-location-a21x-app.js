/**
 * Ensure Search Special Location A21X is registered in system_applications.
 * Safe to run multiple times.
 *
 * Usage (from backend/):
 *   node scripts/run-insert-search-special-location-a21x-app.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

const APPLICATION = 'search-special-location-a21x.html';
const MENU_NAME = 'Location_Search_Special_A21X';

async function main() {
  const inserted = await query(
    `INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
     SELECT $1::VARCHAR(100), $2::VARCHAR(150)
     WHERE NOT EXISTS (
       SELECT 1 FROM system_applications WHERE syap_nm_application = $1::VARCHAR(100)
     )
     RETURNING syap_cd_seq, syap_nm_application`,
    [APPLICATION, MENU_NAME]
  );

  await query(
    `UPDATE system_applications
     SET syap_ds_detailed = $2::VARCHAR(150)
     WHERE syap_nm_application = $1::VARCHAR(100)`,
    [APPLICATION, MENU_NAME]
  );

  const row = await query(
    `SELECT syap_cd_seq, syap_nm_application, syap_ds_detailed
     FROM system_applications
     WHERE syap_nm_application = $1`,
    [APPLICATION]
  );

  console.log(inserted.rowCount ? 'Inserted:' : 'Already existed:');
  console.log(row.rows[0]);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  try { await closePool(); } catch {}
  process.exit(1);
});
