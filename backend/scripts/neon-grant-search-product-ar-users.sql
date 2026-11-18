-- Grant Search Product AR to users who already have Product / Tablet / Special Search.
INSERT INTO user_applications (id_funcionario, syap_cd_seq, access_mode)
SELECT DISTINCT ua.id_funcionario, ar.syap_cd_seq, COALESCE(ua.access_mode, 'all')
FROM user_applications ua
INNER JOIN system_applications src
  ON src.syap_cd_seq = ua.syap_cd_seq
 AND src.syap_nm_application IN (
   'warehouse.html',
   'Search-Product-Tablet.html',
   'special-search-product.html'
 )
INNER JOIN system_applications ar
  ON ar.syap_nm_application = 'Search-Product-AR.html'
WHERE NOT EXISTS (
  SELECT 1
  FROM user_applications x
  WHERE x.id_funcionario = ua.id_funcionario
    AND x.syap_cd_seq = ar.syap_cd_seq
);

SELECT
  COUNT(*)::int AS users_with_search_product_ar
FROM user_applications ua
JOIN system_applications sa ON sa.syap_cd_seq = ua.syap_cd_seq
WHERE sa.syap_nm_application = 'Search-Product-AR.html';
