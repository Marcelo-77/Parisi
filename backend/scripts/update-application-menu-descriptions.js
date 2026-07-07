require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const { query, closePool } = require('../config/database');

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
  { application: 'log-location-product.html', menuName: 'Log_location' },
  { application: 'movement.html', menuName: 'Movement' },
  { application: 'movement-situation.html', menuName: 'Movement_Situation' },
  { application: 'picking.html', menuName: 'Picking' },
  { application: 'separation-picking.html', menuName: 'Separation_Picking' },
  { application: 'double-checking.html', menuName: 'Double_Checking' },
  { application: 'last-check-label.html', menuName: 'Packing' },
  { application: 'help.html', menuName: 'Help' },
  { application: 'applications.html', menuName: 'Applications' },
  { application: 'application_users.html', menuName: 'Applications_Users' },
  { application: 'change-password.html', menuName: 'Users_Change_Password' }
];

async function main() {
  for (const item of systemApplicationMenus) {
    await query(
      `UPDATE system_applications
       SET syap_ds_detailed = $2
       WHERE syap_nm_application = $1`,
      [item.application, item.menuName]
    );
  }

  const result = await query(
    `SELECT syap_cd_seq, syap_nm_application, syap_ds_detailed
     FROM system_applications
     ORDER BY syap_cd_seq`
  );

  console.table(result.rows);
  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
