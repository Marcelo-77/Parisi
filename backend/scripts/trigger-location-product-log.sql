-- Log de location_product e feito pela aplicacao (INSERT, UPDATE, DELETE).
-- Remove o trigger legado que gravava apenas UPDATE de quantity_current.

DROP TRIGGER IF EXISTS location_product_before_update_log ON location_product;
