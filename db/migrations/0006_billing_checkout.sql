BEGIN;
-- Persist operation IDs before contacting Stripe so a failed DB commit can be
-- retried with the same provider idempotency key. Never infer ownership by email.
ALTER TABLE cgt.billing_accounts ALTER COLUMN stripe_customer_id DROP NOT NULL;
ALTER TABLE cgt.billing_accounts ADD COLUMN customer_operation uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE cgt.billing_accounts ADD COLUMN customer_started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE cgt.billing_accounts ADD COLUMN checkout_operation uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE cgt.billing_accounts ADD COLUMN checkout_started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE cgt.billing_accounts ADD COLUMN checkout_session_id text;
ALTER TABLE cgt.billing_accounts ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE cgt.billing_accounts ADD COLUMN entitled boolean NOT NULL DEFAULT false;
ALTER TABLE cgt.billing_accounts ADD COLUMN risk_hold boolean NOT NULL DEFAULT false;
ALTER TABLE cgt.billing_accounts ADD COLUMN risk_reason text;
ALTER TABLE cgt.billing_accounts ADD CONSTRAINT risk_reason_present CHECK (NOT risk_hold OR risk_reason IS NOT NULL);
ALTER TABLE cgt.stripe_events ADD COLUMN outcome text NOT NULL DEFAULT 'reconciled';
ALTER TABLE cgt.request_limits DROP CONSTRAINT request_limits_bucket_check;
ALTER TABLE cgt.request_limits ADD CONSTRAINT request_limits_bucket_check CHECK (bucket IN ('general','upload','calculate','billing'));
COMMIT;
