-- Register Location Smart application (safe to re-run)
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'location-smart.html', 'Location_Smart'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications WHERE syap_nm_application = 'location-smart.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Location_Smart'
WHERE syap_nm_application = 'location-smart.html';
