require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

async function main() {
  await query(
    `INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
     SELECT 'change-between-location-products.html', 'Location_Movement_Change_Between_Location_Products'
     WHERE NOT EXISTS (
       SELECT 1 FROM system_applications WHERE syap_nm_application = 'change-between-location-products.html'
     )`
  );
  await query(
    `UPDATE system_applications
     SET syap_ds_detailed = 'Location_Movement_Change_Between_Location_Products'
     WHERE syap_nm_application = 'change-between-location-products.html'`
  );
  const result = await query(
    `SELECT syap_cd_seq, syap_nm_application, syap_ds_detailed
     FROM system_applications
     WHERE syap_nm_application = 'change-between-location-products.html'`
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
