-- Register Improvements and Corrections Control (Search page)
INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Improvements-and-Corrections-Control-Search.html', 'Applications_Improvements_Corrections'
WHERE NOT EXISTS (
  SELECT 1 FROM system_applications
  WHERE syap_nm_application = 'Improvements-and-Corrections-Control-Search.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Applications_Improvements_Corrections'
WHERE syap_nm_application = 'Improvements-and-Corrections-Control-Search.html';

