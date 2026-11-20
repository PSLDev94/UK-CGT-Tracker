BEGIN;
CREATE ROLE cgt_auth NOLOGIN;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO cgt_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO cgt_auth;

-- Financial and authentication connections cannot read each other's tables.
-- User deletion is disabled in the auth API pending the retention workflow.
-- Restrict deletion here too: financial history must never become orphaned.
ALTER TABLE cgt.portfolios ADD CONSTRAINT portfolio_verified_owner
  FOREIGN KEY(owner_id) REFERENCES auth."user"(id) ON DELETE RESTRICT;
ALTER TABLE cgt.billing_accounts ADD CONSTRAINT billing_verified_owner
  FOREIGN KEY(owner_id) REFERENCES auth."user"(id) ON DELETE RESTRICT;
COMMIT;
