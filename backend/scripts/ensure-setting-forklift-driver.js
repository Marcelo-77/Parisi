/**
 * Ensure Setting Forklift Driver app + forklift_drivers table exist.
 * Usage: node scripts/ensure-setting-forklift-driver.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');
const forkliftDriverService = require('../services/forkliftDriverService');

const APP = 'Setting-Forklift-Driver.html';
const MENU = 'Applications_Settings_Forklift_Driver';

async function main() {
  await forkliftDriverService.ensureTable();
  console.log('✅ forklift_drivers table ready');

  await query(
    `INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
     SELECT $1::VARCHAR(100), $2::VARCHAR(150)
     WHERE NOT EXISTS (
       SELECT 1 FROM system_applications WHERE syap_nm_application = $1::VARCHAR(100)
     )`,
    [APP, MENU]
  );
  await query(
    `UPDATE system_applications
     SET syap_ds_detailed = $2
     WHERE syap_nm_application = $1`,
    [APP, MENU]
  );

  const row = await query(
    `SELECT syap_cd_seq, syap_nm_application, syap_ds_detailed
     FROM system_applications
     WHERE syap_nm_application = $1`,
    [APP]
  );
  console.log('✅ system_applications:', row.rows[0] || null);
}

main()
  .then(() => closePool())
  .catch(async (err) => {
    console.error('❌', err);
    try { await closePool(); } catch (_) { /* ignore */ }
    process.exit(1);
  });
