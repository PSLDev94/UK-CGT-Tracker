# November 2026 development review

## Scope for this review

Original CGT Tracker UI, page routes, logos and styling are retained. This increment adds six broker import paths for explicitly recognised layouts, supporting-detail review, downloadable calculation summary/evidence PDFs and full calculation CSV evidence, server-side PDF subscription checks, support email submission, an operator billing reconciliation job and a database restore rehearsal.

The review is a staging release, not a claim that all production launch gates have passed.

## Broker acceptance matrix

| Broker | Implemented path | Important boundary |
| --- | --- | --- |
| Trading 212 | 21-column and 33-column Invest history; GBP and GBX prices, separately identified GBP fees; foreign trades with verified rate and GBP totals | Other headers, non-GBP cash totals and unexplained activity block the file |
| Freetrade | 29-column Activity including documented renamed amount columns; GBP account; GBP and verified foreign trades | FX fees/base/effective rates/net cash must reconcile; transfers/free shares and corporate actions block the file |
| Hargreaves Lansdown | Transaction Summary including known preamble; pence prices and signed GBP cash | Requires ISIN and verified dealing fees from contract notes |
| Interactive Investor | 11-column transactions with debit/credit and execution reference | Requires ISIN, wallet currency, price units and verified fees |
| Interactive Brokers | Configured 16-column Flex executions with ISIN, signed proceeds, commission, taxes and net cash | One account per file. Stock executions only. Foreign conversion needs a verified GBP-base statement or a template with independently supported per-trade GBP rates. Regular sectioned Activity Statements remain unsupported |
| AJ Bell | Documented GBP transaction-history assisted layout plus six-column candidate | Requires contract-note execution ID, ISIN, currency, units, net-cash confirmation and fees. Representative broker-issued exports still need validation; no universal native-support claim |

The synthetic buy/sell fixtures produce £70.88 for HL, ii and AJ Bell, £71.63 for IBKR, £5.25 for Trading 212 and £74.38 for Freetrade. Separately, the [broker evidence register](BROKER_SUPPORT.md) lists original public files, the rows that reconciled, and the documents needed to resolve the others. A file with unresolved activity stays in review.

Supporting details are stored with the draft, reviewed again at commit and retained in transaction provenance. Portfolio revisions and a separate draft review version prevent stale confirmations and concurrent supporting-detail overwrites.

## Report review

The [year-by-year specialist assessment](TAX_RULES_BY_YEAR.md) covers the six supported years, HMRC worked examples, the 30 October 2024 rate change and cases that need an individual review. The current engine calculates each annual total from unrounded transactions. The paid reports and free CSV explain any difference from adding displayed pennies. The earlier calculation and its declaration remain in the audit history. To download current figures, the investor must reconfirm their basis and recalculate.

- Reports use immutable saved results, with calculation ID, input fingerprint, engine version, history cutoff and account coverage.
- CSV includes disposals, matching details, pools and unresolved issues; no subscription is required.
- Summary and detailed evidence PDFs check current Stripe entitlement on the server. Failed billing lookups do not grant access.
- Current ownership, published revision and absence of pending previews are checked before export.
- Incomplete results remain downloadable as explicitly marked drafts; unresolved values are never replaced with zero.
- Over 5,000 disposal groups: use the full CSV and summary PDF instead of an unbounded evidence PDF.
- All nine supported broker-format fixtures now exercise persisted CSV and both PDF export paths, including blocked/stale/reversed states. A verified staging account also completed sandbox checkout and downloaded both PDFs showing the expected £5.25 net gain.
- These are calculation reports, not completed SA108 forms or a personal tax-liability calculation. Independent UK tax review remains required.

## Business decisions supplied by the owner

PSL Digital; support@cgttracker.com; not VAT-registered; retain £49/year, no VAT added. Do not publish a contact address in the review version. Live Stripe keys remain rejected. The existing live account, price and customer history are preserved.

## Review walkthrough

1. Sign in, open Accounts and add the relevant taxable GIA.
2. Upload a named synthetic broker fixture with ordinary-share classification confirmed.
3. For HL/ii/AJ Bell supply the matching `assisted-details.json` values; verify an incorrect fee is rejected before correcting it.
4. Commit, confirm account coverage and calculate 2024–25 with history through 2025-05-05.
5. Download CSV evidence. In a paid sandbox account, download summary and detailed PDFs. Verify an unpaid account receives the subscription explanation.
6. Create another preview; report downloads must be blocked until it is resolved/discarded. Reverse an import; its old published report must become unavailable.
7. Review mobile layout, keyboard controls, contact-form recovery and the data/privacy information.

## External production gates still open

- Real or anonymised broker exports covering historical/current variants, especially AJ Bell and IBKR sectioned statements; synthetic tests cannot establish 100% broker compatibility.
- Independent UK tax review of engine, unsupported scope, rounding and report interpretation.
- Final privacy/retention/consumer terms, business-address disclosure and cancellation/refund review. Owner asked to omit the address; UK online-selling guidance generally requires an address before sales. This is unresolved, not silently waived.
- Mapped-user renewal, 3DS, disputes and provider recovery. Provider-only sandbox tests covered annual renewal, decline and recovery, and rejected and completed 3DS challenges. The verified staging account passed initial checkout and paid PDF downloads on 18 November.
- Configure equivalent monitoring for production and qualify the separate read-only R2 freshness check. Staging passed a scheduler-triggered backup, encrypted readback and isolated restore. On 18 November the daily staging monitor received a real backup heartbeat, and the operator confirmed receipt of the failed-worker and missed-run emails.
- Production DNS, live Stripe enablement and launch approval.

Sources: [UK online-selling guidance](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling), [consumer pre-contract information](https://www.legislation.gov.uk/uksi/2013/3134/schedule/2), [IBKR Flex trade semantics](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm). The implementation evidence and remaining gates must be reviewed together.

## Customer information before live checkout

Confirm the business's publishable contact details, the production retention/transfer arrangements and the applicable cancellation rights for the subscription and downloadable reports. The owner has supplied PSL Digital and support@cgttracker.com and asked to omit a contact address from staging. Provide the applicable business address, pre-contract information and a durable confirmation before accepting live orders. Confirm the legal treatment of immediate access and refunds; the staging service makes no decision on a customer's statutory rights. [GOV.UK distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses) · [GOV.UK online selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling) · [ICO privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/)


### Subscription and report review, 19 November 2026

Before enabling live checkout, review the annual service and immediately accessible PDFs together. Show the legal trader identity and geographical contact address, total recurring price, billing period, renewal, cancellation route and the applicable cooling-off information before the order. Send a confirmation the customer can keep. Where relying on an early start or an instant digital download, determine which express request, consent and acknowledgement applies and retain its date and wording. Cancelling future renewal in Stripe is distinct from exercising a statutory cancellation right. The sandbox has no live consumer order and cannot verify that the production communications or refund process deliver those rights. [Consumer Contracts Regulations, Schedule 2](https://www.legislation.gov.uk/uksi/2013/3134/schedule/2) · [GOV.UK online selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling)

Customers can check their figures, notify support of discrepancies and obtain personal tax advice. Confirmation of source records does not transfer the trader’s obligations for the supplied digital content and services to the customer. Use clear scope descriptions and keep access to applicable consumer remedies. Check commencement and current guidance on subscription contracts against the actual date live orders will open. [Consumer Rights Act, sections 47 and 57](https://www.legislation.gov.uk/ukpga/2015/15/part/1) · [CMA fair contracts](https://www.gov.uk/guidance/writing-a-fair-contract-for-customers) · [Government subscription guidance](https://www.gov.uk/government/publications/subscription-contracts)
