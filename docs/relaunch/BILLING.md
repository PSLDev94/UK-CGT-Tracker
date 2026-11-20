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

The synchronous webhook reconciler uses bounded provider timeouts and returns failure for retry. The hourly operator job described below reconciles stale accounts independently of browser visits. Durable queue processing and alerting remain production scale/recovery work. PDF downloads reconcile entitlement on the server; billing does not lock customers out of their investment records or CSV evidence.

### Operator handling for a blocked payment

1. Open a support case and verify the owner using the account-access procedure. Record the environment, the application owner ID, the mapped Stripe customer ID if present, and the time of the attempted purchase. Keep payment details and API keys out of the case. [Account access procedure](ACCOUNT_REQUESTS.md)
2. For `BILLING_RECONCILIATION_REQUIRED` or `PAYMENT_PENDING`, use the persisted customer or checkout operation UUID to find the matching Stripe request in the correct sandbox or live account. The idempotency key begins with `cgt-customer-` or `cgt-checkout-`. Compare the request result, Checkout Session, customer, configured annual price, invoice, and subscription. An email-address match alone cannot establish ownership. Keep an ambiguous request blocked while investigating.
3. For a refund, dispute or fraud warning, record the event and charge IDs. Follow the charge through the invoice and subscription. Check the latest charge, any refund amount and the dispute outcome. A signed risk event sets the hold immediately, including during an outage in subscription lookup. Later paid events retain that hold. A paid invoice showing £0 actually paid supplies insufficient evidence for automatic PDF access under the current £49 plan.
4. Give the owner the verified status and any Stripe-hosted action they can take, such as completing authentication or updating their payment method. Retry an ordinary failed delivery from Stripe or allow the next reconciliation, then test the report using the normal application route. The owner can still download their CSV evidence while a payment is under review.
5. If a provider request succeeded before the local mapping was recorded, preserve its object ID and the original operation in the case. An authorised operator must reconcile the unique mapping before re-enabling checkout. For any proposed release of a risk hold, record the business decision, operator, time, relevant provider records and expected entitlement. The current service has no operator command for rotating ambiguous operations or releasing holds. Escalate these cases to the service owner until a reviewed recovery action is available.

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

The owner confirmed PSL Digital is not VAT-registered on 17 November 2026. Retain £49/year with no VAT added. Automatic tax is not enabled and no live price is changed.

## Verification

Tests cover persisted idempotency, expiry, duplicate prevention, authorization, canceled/overdue/pending states, out-of-order/duplicate webhook events, risk holds, signature tampering/replay, account/mode/version rejection, and current invoice/payment/charge validation using the real Stripe SDK against synthetic HTTP fixtures. PostgreSQL qualification adds simultaneous checkout/webhook requests through the separate billing login. Browser tests cover status/recovery, cancellation visibility, pending actions, narrow layout and accessibility. These tests do not substitute for sandbox payment/provider-delivery qualification on Railway.


### Hosted evidence

On 16 November 2026, the real staging application completed sandbox Checkout, received signed webhook deliveries, reconciled paid access, opened the Customer Portal and blocked duplicate checkout. Portal cancellation exposed a flexible-billing date mismatch; the corrected gateway was redeployed and the scheduled end was verified in the browser. A full test refund produced a persisted review hold and revoked paid access; cancelling the test subscription did not clear that hold or block access to saved investment records. See [operations evidence](ACCESS_AND_OPERATIONS.md#billing-deployment-and-release-control--16-november-2026) for revisions and remaining lifecycle gates. The authorised test account intentionally remains under billing review after this test.

## Review increment: report access and reconciliation

PDF reports call `Billing.status` server-side and reconcile current provider state on every download. CSV evidence remains available without a subscription. An unavailable provider or a risk hold never grants PDF access.

The portable image includes `jobs/reconcile-billing.cjs`. Run it hourly with only BILLING_DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_ACCOUNT_ID, STRIPE_PRICE_ID, STRIPE_PORTAL_CONFIGURATION_ID and APP_ORIGIN. It validates the billing-only role and sandbox account, processes stale accounts in bounded batches, retains risk holds, reports counts without customer details, and exits non-zero on failure/incomplete traversal. No public route exposes this operator action.

Owner confirmed PSL Digital is not VAT-registered, 17 November 2026. Retain £49/year with no VAT added; automatic tax remains off. Live keys stay locked pending production qualification and legacy-customer ownership reconciliation.


### 17 November provider inventory and additional test setup

Read-only inspection of live account `acct_1TKoVLJO9SvFmbaJ` returned no subscriptions and no payment intents, with `has_more=false` on both lists. No existing live subscription mapping is currently identified for migration; check again immediately before launch and do not infer ownership from email if records appear.

A separate, unmapped sandbox customer without an email was created for provider-only renewal simulation: customer `cus_Ve3laT9O1ZrkuJ`, clock `clock_1UcldiJWYPaAvM6RveQ7Qhvf`, subscription `sub_1UcleOJWYPaAvM6ROj4bVKCt`. Initial invoice `in_1UcleOJWYPaAvM6RT6Qa7zxx` is paid £49.

Clock advancement to `1826458653` produced the first annual renewal invoice `in_1Ucm3LJWYPaAvM6RHQiaaYhZ`, paid £49 with `billing_reason=subscription_cycle`; the subscription remained active. With Stripe's documented `pm_card_chargeCustomerFail` attached and selected, advancement to `1858081053` produced invoice `in_1Ucm73JWYPaAvM6RtJT0GdTx`: open, £0 paid, one attempt, and subscription `past_due`. Restoring the original successful test method and paying that invoice produced paid £49 and subscription `active`; the clock returned to `ready`.

These are **provider-level renewal, decline and recovery passes, not hosted-user entitlement passes**. No email was configured on the synthetic customer. The mapped staging user retains the previous intentional refund hold. See [Stripe test methods](https://docs.stripe.com/testing?testing-method=payment-methods) and [billing simulation](https://docs.stripe.com/billing/testing).

A second unmapped/no-email customer `cus_Ve4HG1rbFxEtHz` exercised `pm_card_authenticationRequired` through Stripe's hosted invoice and simulated bank challenge. Subscription `sub_1Ucm92JWYPaAvM6R6udpGo3U` began incomplete with invoice `in_1Ucm92JWYPaAvM6Rx3uPdQWu` open and £0 paid. Choosing FAIL in the 3DS test challenge retained that state. Retrying payment returned `invoice_payment_intent_requires_action`; completing the next browser challenge produced a paid £49 invoice and active subscription, confirmed independently through the API and the visible “Invoice paid” page. This qualifies the provider's 3DS failure/retry flow, not an application Checkout or report entitlement transition. No real payment or new email was sent. [Stripe authentication test guidance](https://docs.stripe.com/automated-testing).

### Mapped report rehearsal, 19 November 2026

Read-only inspection of the same sandbox found the original subscription and invoice events for an annual renewal, a failed renewal, successful recovery, a 3DS challenge, a rejected attempt and a successful retry. The test fixture contains the recorded event types, subscription states, invoice statuses, billing reasons and amounts. Customer IDs and payment details are omitted. [Recorded fields](../../tests/fixtures/billing-sandbox.json)

The PostgreSQL 18 test replays those states through the Stripe SDK's HTTP transport with fixture payment objects and locally signed deliveries. It creates a mapped customer through Checkout, imports the £5.25 Trading 212 example using the application database role and checks the actual summary PDF, evidence PDF and CSV after each transition. Both PDFs unlock after authentication or renewal succeeds and return HTTP 402 for incomplete authentication and overdue renewal. The CSV remains downloadable throughout. The test also covers duplicate and late events, access until scheduled cancellation, and a simulated dispute during a subscription lookup outage. The sandbox event feed had no dispute for this rehearsal. A hosted provider-delivered dispute and a full mapped-account test-clock run remain staging acceptance items. [Mapped report qualification](../../qualification/billing-lifecycle.ts)
