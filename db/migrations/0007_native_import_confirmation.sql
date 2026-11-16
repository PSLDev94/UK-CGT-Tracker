BEGIN;
-- A broker export's ISIN establishes identity, not tax classification. Keep the
-- explicit user confirmation with its raw draft, including across resumed reviews.
ALTER TABLE cgt.import_drafts ADD COLUMN ordinary_shares_confirmed boolean NOT NULL DEFAULT false;
COMMIT;
