-- Trigger BEFORE UPDATE em location_product: grava em location_product_log quando quantity_current mudar

CREATE OR REPLACE FUNCTION location_product_log_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.quantity_current IS DISTINCT FROM NEW.quantity_current THEN
    INSERT INTO location_product_log (
      location_code_log,
      product_code_log,
      entry_datetime_log,
      quantity_current_prev_log,
      quantity_current_log,
      sipr_sq_number
    ) VALUES (
      OLD.location_code,
      OLD.product_code,
      CURRENT_TIMESTAMP,
      OLD.quantity_current,
      NEW.quantity_current,
      OLD.sipr_sq_number
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS location_product_before_update_log ON location_product;
CREATE TRIGGER location_product_before_update_log
  BEFORE UPDATE ON location_product
  FOR EACH ROW
  EXECUTE PROCEDURE location_product_log_on_update();
