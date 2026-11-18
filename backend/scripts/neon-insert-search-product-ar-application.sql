INSERT INTO system_applications (syap_nm_application, syap_ds_detailed)
SELECT 'Search-Product-AR.html', 'Product_Search_AR'
WHERE NOT EXISTS (
  SELECT 1
  FROM system_applications
  WHERE syap_nm_application = 'Search-Product-AR.html'
);

UPDATE system_applications
SET syap_ds_detailed = 'Product_Search_AR'
WHERE syap_nm_application = 'Search-Product-AR.html';

SELECT
  syap_cd_seq,
  syap_nm_application,
  syap_ds_detailed
FROM system_applications
WHERE syap_nm_application = 'Search-Product-AR.html';
