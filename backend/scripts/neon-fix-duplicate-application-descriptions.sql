-- Neon Approval/Production: fix duplicate syap_ds_detailed labels in system_applications.
-- Run in Neon SQL Editor when Assigned shows the same application name twice.

-- Product duplicated by legacy/wrong registration
UPDATE system_applications
SET syap_ds_detailed = 'Double_Y_Schedule'
WHERE syap_nm_application = 'Double-Y-Schedule.html'
  AND syap_ds_detailed = 'Product';

-- Users search legacy page vs pesquisa.html
UPDATE system_applications
SET syap_ds_detailed = 'Users_Search_Legacy'
WHERE syap_nm_application = 'search-users.html'
  AND syap_ds_detailed = 'Users_search';

-- New customer page vs customer.html
UPDATE system_applications
SET syap_ds_detailed = 'Customer_New'
WHERE syap_nm_application = 'new-customer.html'
  AND syap_ds_detailed = 'Customer';

-- Improvements search vs new page
UPDATE system_applications
SET syap_ds_detailed = 'Applications_Improvements_Corrections_Search'
WHERE syap_nm_application = 'Improvements-and-Corrections-Control-Search.html'
  AND syap_ds_detailed = 'Applications_Improvements_Corrections';

-- Optional: review remaining duplicates
SELECT syap_ds_detailed,
       COUNT(*) AS total,
       array_agg(syap_nm_application ORDER BY syap_cd_seq) AS applications
FROM system_applications
GROUP BY syap_ds_detailed
HAVING COUNT(*) > 1
ORDER BY syap_ds_detailed;
