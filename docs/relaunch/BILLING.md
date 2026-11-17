# Billing integration

The relaunch uses the existing Stripe accounts and recurring prices. This implementation is sandbox-only: the runtime rejects live keys. Existing live customers and subscriptions are untouched. Verified ownership reconciliation of legacy customers is still required before enabling live checkout; email matching alone is not sufficient.

## Provider contract

- Node SDK 23.1.0, API `2026-10-28.endive`, explicitly pinned for new calls and snapshot webhook validation. Stripe's current version was checked on 16 November 2026 in [API versioning](https://docs.stripe.com/api-versions) and the [Endive changelog](https://docs.stripe.com/changelog/endive). The live account default and existing destinations are not upgraded.
- Sandbox account `acct_1TL3EVJWYPaAvM6R`; existing £49 annual price `price_1TL3GwJWYPaAvM6RURYhXWN9`.
- Existing sandbox portal configuration `bpc_1TL7OuJWYPaAvM6R2AXnRV1S` provides payment updates, invoice history and cancellation at period end.
- Hosted Checkout, server-selected customer/price/return URLs, dynamic payment methods. No card data reaches the application.
- Snapshot endpoint `/api/v2/stripe/webhook`; subscribe only to `BILLING_EVENTS` in `src/server/stripe-gateway.ts`. Verify the untouched body and five-minute signature tolerance before processing; reject a wrong account, mode or API version.

## State and retry policy

Only the dedicated `cgt_billing` connection can write billing state. Verified server identities select an owner; the browser cannot supply a customer ID, price, subscription or return URL. Webhook ownership resolves a Stripe Customer ID to the existing database mapping, never untrusted metadata or email.

Customer and Checkout operation UUIDs are committed before provider calls. Owner row locks serialize creation and reconciliation; provider retries reuse the same key and parameters. An open Checkout is reused. A completed but unreconciled Checkout blocks another purchase. Expired sessions can start a new durable operation. An ambiguous operation older than 23 hours stops for review because Stripe can prune idempotency keys after 24 hours. No blind retry can create another subscription. Permanent ambiguous-operation recovery tooling is a production gate.

Webhook receipts and state changes commit together. Failure leaves the event retryable. Duplicates are ignored; delayed events fetch the customer's current subscriptions rather than replaying old payload state. All subscription pages are read, with a safety cap that fails closed. Browser status refresh also reconciles current state. The success URL grants no access.

For sandbox qualification, entitlement requires exactly one current subscription for the configured price/quantity, `active` status, a future period end, a paid current invoice belonging to that customer/subscription and current successful, non-refunded, undisputed payment evidence. Pending, overdue, unpaid, paused, trial and ambiguous subscriptions do not grant paid access. Scheduled cancellation keeps access through the paid period, capped at an earlier explicit cancellation date. Flexible billing portal cancellations use `cancel_at` even when `cancel_at_period_end` is false; the gateway normalizes both representations. See [Stripe billing-mode differences](https://docs.stripe.com/billing/subscriptions/billing-mode/compare#cancellations-in-the-customer-portal). Refund/dispute/fraud events place a persistent review hold, including after a later paid event; no automatic refund or cancellation is performed. Partial refunds also require review. These conservative rules must be reviewed with the business policy before live release.

The synchronous webhook reconciler uses bounded provider timeouts and returns failure for retry. Durable queue processing, periodic background reconciliation and alerting are still required for production scale/recovery. Paid report enforcement will consume the reconciled entitlement when reports are implemented; billing does not lock customers out of their investment records.

## Runtime configuration

Add to staging web only after migration `0006_billing_checkout.sql`:

| Variable | Value/purpose |
| --- | --- |
| `BILLING_ENABLED` | `true` enables sandbox billing |
| `BILLING_DATABASE_URL` | Reference to the setup job's separate billing login |
| `STRIPE_SECRET_KEY` | Existing restricted sandbox key, stored only in Railway |
| `STRIPE_ACCOUNT_ID` | Sandbox account above |
| `STRIPE_PRICE_ID` | Existing sandbox annual price above |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Existing sandbox portal configuration above |
| `STRIPE_WEBHOOK_SECRET` | New endpoint's signing secret, never in Git or logs |

The key needs account, product/price, portal configuration, subscriptions, invoices, invoice payments, payment intents and charges read permissions; Customer, Checkout Session and Portal Session creation permissions. Use the narrowest available permissions. Startup validates account identity, price currency/amount/interval/mode and portal cancellation. The ordinary readiness endpoint remains independent of optional billing.

VAT/tax registration and price tax behaviour remain unconfirmed. Automatic tax is not enabled and no live price is changed. Complete that business decision before production checkout.

## Verification

Tests cover persisted idempotency, expiry, duplicate prevention, authorization, canceled/overdue/pending states, out-of-order/duplicate webhook events, risk holds, signature tampering/replay, account/mode/version rejection, and current invoice/payment/charge validation using the real Stripe SDK against synthetic HTTP fixtures. PostgreSQL qualification adds simultaneous checkout/webhook requests through the separate billing login. Browser tests cover status/recovery, cancellation visibility, pending actions, narrow layout and accessibility. These tests do not substitute for sandbox payment/provider-delivery qualification on Railway.


### Hosted evidence

On 16 November 2026, the real staging application completed sandbox Checkout, received signed webhook deliveries, reconciled paid access, opened the Customer Portal and blocked duplicate checkout. Portal cancellation exposed a flexible-billing date mismatch; the corrected gateway was redeployed and the scheduled end was verified in the browser. A full test refund produced a persisted review hold and revoked paid access; cancelling the test subscription did not clear that hold or block access to saved investment records. See [operations evidence](ACCESS_AND_OPERATIONS.md#billing-deployment-and-release-control--16-november-2026) for revisions and remaining lifecycle gates. The authorised test account intentionally remains under billing review after this test.

## Review increment: report access and reconciliation

PDF reports call `Billing.status` server-side and reconcile current provider state on every download. CSV evidence remains available without a subscription. An unavailable provider or a risk hold never grants PDF access.

The portable image includes `jobs/reconcile-billing.cjs`. Run it hourly with only BILLING_DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_ACCOUNT_ID, STRIPE_PRICE_ID, STRIPE_PORTAL_CONFIGURATION_ID and APP_ORIGIN. It validates the billing-only role and sandbox account, processes stale accounts in bounded batches, retains risk holds, reports counts without customer details, and exits non-zero on failure/incomplete traversal. No public route exposes this operator action.

Owner confirmed PSL Digital is not VAT-registered, 17 November 2026. Retain £49/year with no VAT added; automatic tax remains off. Live keys stay locked pending production qualification and legacy-customer ownership reconciliation.
