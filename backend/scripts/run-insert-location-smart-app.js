require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

async function main() {
  await query(
    `INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
     SELECT 'location-smart.html', 'Location_Smart'
     WHERE NOT EXISTS (
       SELECT 1 FROM system_applications WHERE syap_nm_application = 'location-smart.html'
     )`
  );
  await query(
    `UPDATE system_applications
     SET syap_ds_detailed = 'Location_Smart'
     WHERE syap_nm_application = 'location-smart.html'`
  );
  const result = await query(
    `SELECT syap_cd_seq, syap_nm_application, syap_ds_detailed
     FROM system_applications
     WHERE syap_nm_application = 'location-smart.html'`
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
