-- Permit the explicitly approved ten-ticket release gift; retain integer bounds.
ALTER TABLE patch_drafts DROP CONSTRAINT IF EXISTS patch_drafts_gift_check,
  ADD CONSTRAINT patch_drafts_gift_check
  CHECK (soft_currency BETWEEN 0 AND 100 AND pack_tickets BETWEEN 0 AND 10);
