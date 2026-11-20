BEGIN;
-- Anonymous contact throttling stores a keyed IP digest, never message contents.
CREATE TABLE cgt.contact_limits (
  key text PRIMARY KEY CHECK (key ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count>0)
);
ALTER TABLE cgt.contact_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt.contact_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY contact_service_limit ON cgt.contact_limits TO cgt_app USING (true) WITH CHECK (true);
GRANT SELECT,INSERT,UPDATE ON cgt.contact_limits TO cgt_app;
CREATE POLICY contact_expiry ON cgt.contact_limits FOR DELETE TO cgt_maintenance USING (window_start<now()-interval '1 day');
CREATE POLICY contact_expiry_read ON cgt.contact_limits FOR SELECT TO cgt_maintenance USING (window_start<now()-interval '1 day');
GRANT SELECT(window_start),DELETE ON cgt.contact_limits TO cgt_maintenance;
COMMIT;
