BEGIN;
-- Players who join after publication receive patch letters as "late" ledger rows.
ALTER TABLE patch_delivery_targets DROP CONSTRAINT IF EXISTS patch_delivery_status_check,
  ADD CONSTRAINT patch_delivery_status_check
  CHECK (status IN ('pending', 'delivered', 'failed', 'missing', 'late'));
COMMIT;
