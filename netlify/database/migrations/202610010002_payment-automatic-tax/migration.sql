ALTER TABLE payment_orders
  ADD COLUMN product_id text,
  ADD COLUMN tax_code text,
  ADD COLUMN tax_amount_minor integer,
  ADD COLUMN total_amount_minor integer;
ALTER TABLE payment_orders DROP CONSTRAINT payment_orders_tax_mode_check;
ALTER TABLE payment_orders ADD CONSTRAINT payment_order_tax_snapshot CHECK (
  (tax_mode = 'none' AND product_id IS NULL AND tax_code IS NULL AND
   ((tax_amount_minor IS NULL AND total_amount_minor IS NULL) OR
    (tax_amount_minor IS NOT NULL AND total_amount_minor IS NOT NULL AND tax_amount_minor = 0 AND total_amount_minor = amount_minor)))
  OR
  (tax_mode = 'automatic' AND product_id IS NOT NULL AND tax_code IS NOT NULL AND
   ((tax_amount_minor IS NULL AND total_amount_minor IS NULL) OR
    (tax_amount_minor IS NOT NULL AND total_amount_minor IS NOT NULL AND tax_amount_minor >= 0
     AND total_amount_minor::bigint = amount_minor::bigint + tax_amount_minor::bigint)))
);