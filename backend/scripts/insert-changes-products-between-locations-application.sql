-- Register Changes Between Locations under Location Movement
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'changes-products-between-locations.html', 'Location_Movement_Changes_Products'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'changes-products-between-locations.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Location_Movement_Changes_Products'
WHERE syap_nm_application = 'changes-products-between-locations.html';
