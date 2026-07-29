INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'changes-products-between-locations.html', 'Location_Movement_Changes_Products'
WHERE NOT EXISTS (
  SELECT 1
  FROM system_applications
  WHERE syap_nm_application = 'changes-products-between-locations.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Location_Movement_Changes_Products'
WHERE syap_nm_application = 'changes-products-between-locations.html';

INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'change-between-location-products.html', 'Location_Movement_Change_Between_Location_Products'
WHERE NOT EXISTS (
  SELECT 1
  FROM system_applications
  WHERE syap_nm_application = 'change-between-location-products.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Location_Movement_Change_Between_Location_Products'
WHERE syap_nm_application = 'change-between-location-products.html';

SELECT
  syap_cd_seq,
  syap_nm_application,
  syap_ds_detailed
FROM system_applications
WHERE syap_nm_application IN (
  'changes-products-between-locations.html',
  'change-between-location-products.html'
)
ORDER BY syap_nm_application;
