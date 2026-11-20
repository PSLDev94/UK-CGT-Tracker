BEGIN;
CREATE ROLE cgt_maintenance NOLOGIN;
GRANT USAGE ON SCHEMA cgt TO cgt_maintenance;
GRANT SELECT (id, expires_at), DELETE ON cgt.import_drafts TO cgt_maintenance;
-- Even the cleanup connection cannot delete unexpired drafts or read CSV data.
CREATE POLICY expired_draft_cleanup ON cgt.import_drafts TO cgt_maintenance
  USING (expires_at <= now());

CREATE TABLE cgt.request_limits (
  owner_id text NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  bucket text NOT NULL CHECK (bucket IN ('general', 'upload', 'calculate')),
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (owner_id, bucket)
);
ALTER TABLE cgt.request_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt.request_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON cgt.request_limits TO cgt_app
  USING (owner_id = nullif(current_setting('cgt.owner_id', true), ''))
  WITH CHECK (owner_id = nullif(current_setting('cgt.owner_id', true), ''));
GRANT SELECT, INSERT, UPDATE ON cgt.request_limits TO cgt_app;
COMMIT;
