-- Register Change Between Location Products as a separate Location Movement application
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'change-between-location-products.html', 'Location_Movement_Change_Between_Location_Products'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'change-between-location-products.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Location_Movement_Change_Between_Location_Products'
WHERE syap_nm_application = 'change-between-location-products.html';
