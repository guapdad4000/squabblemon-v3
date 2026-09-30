-- Netlify owns this transaction. Previously applied files stay byte-identical.
-- Optional catalog character whose original artwork headlines a patch note.
ALTER TABLE patch_drafts ADD COLUMN IF NOT EXISTS art_card_id text;
