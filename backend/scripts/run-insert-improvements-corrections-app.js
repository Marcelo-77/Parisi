require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');
const improvementsCorrectionsService = require('../services/improvementsCorrectionsService');

async function main() {
  await improvementsCorrectionsService.ensureTable();

  await query(
    `INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
     SELECT 'Improvements-and-Corrections-Control.html', 'Applications_Improvements_Corrections'
     WHERE NOT EXISTS (
       SELECT 1 FROM system_applications
       WHERE syap_nm_application = 'Improvements-and-Corrections-Control.html'
     )`
  );
  await query(
    `UPDATE system_applications
     SET syap_ds_detailed = 'Applications_Improvements_Corrections'
     WHERE syap_nm_application = 'Improvements-and-Corrections-Control.html'`
  );

  const result = await query(
    `SELECT syap_cd_seq, syap_nm_application, syap_ds_detailed
     FROM system_applications
     WHERE syap_nm_application = 'Improvements-and-Corrections-Control.html'`
  );
  console.log(result.rows);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
