BEGIN;
ALTER TABLE cgt.import_drafts ADD COLUMN supporting_details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(supporting_details)='object');
ALTER TABLE cgt.import_drafts ADD COLUMN review_version integer NOT NULL DEFAULT 0 CHECK (review_version>=0);
COMMIT;
