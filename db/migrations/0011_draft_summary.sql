BEGIN;

-- This display metadata expires with the draft. Saved import receipts retain no filename.
ALTER TABLE cgt.import_drafts ADD COLUMN display_summary jsonb
  CHECK (jsonb_typeof(display_summary) = 'object');

COMMIT;
