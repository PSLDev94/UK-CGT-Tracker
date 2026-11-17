# November 2026 development review

## Scope for this review

Original CGT Tracker UI, page routes, logos and styling are retained. This increment adds six broker import paths for explicitly recognised layouts, supporting-detail review, downloadable calculation summary/evidence PDFs and full calculation CSV evidence, server-side PDF subscription checks, support email submission, an operator billing reconciliation job and a database restore rehearsal.

The review is a staging release, not a claim that all production launch gates have passed.

## Broker acceptance matrix

| Broker | Implemented path | Important boundary |
| --- | --- | --- |
| Trading 212 | 21-column Invest history; GBP and GBX prices, separately identified GBP fees; foreign trades with verified rate and GBP totals | Other headers, non-GBP cash totals and unexplained activity block the file |
| Freetrade | 29-column Activity; GBP account; GBP trades and verified foreign trades | Non-zero FX fees, transfers/free shares and corporate actions block the file |
| Hargreaves Lansdown | Transaction Summary including known preamble; pence prices and signed GBP cash | Requires ISIN and verified dealing fees from contract notes |
| Interactive Investor | 11-column transactions with debit/credit and execution reference | Requires ISIN, wallet currency, price units and verified fees |
| Interactive Brokers | Configured 16-column Flex executions with ISIN, signed proceeds, commission, taxes and net cash | One account per file; stock executions only; foreign conversion must be verified against a GBP-base statement. Regular sectioned Activity Statements remain unsupported |
| AJ Bell | Assisted six-column candidate layout | No broker-issued schema has been verified. Requires contract-note execution ID, ISIN, currency, units, net-cash confirmation and fees. Do not advertise universal native support |

All examples are synthetic. Four new buy/sell fixtures derive independently checked £70.88 (HL/ii/AJ Bell) and £71.62 (IBKR) gains. Existing T212/Freetrade fixtures retain £5.25/£74.37 expected results. Unknown activity still blocks the entire file. No imported row is silently discarded to make a file pass.

Supporting details are stored with the draft, reviewed again at commit and retained in transaction provenance. Portfolio revisions and a separate draft review version prevent stale confirmations and concurrent supporting-detail overwrites.

## Report review

- Reports use immutable saved results, with calculation ID, input fingerprint, engine version, history cutoff and account coverage.
- CSV includes disposals, matching details, pools and unresolved issues; no subscription is required.
- Summary and detailed evidence PDFs check current Stripe entitlement on the server. Failed billing lookups do not grant access.
- Current ownership, published revision and absence of pending previews are checked before export.
- Incomplete results remain downloadable as explicitly marked drafts; unresolved values are never replaced with zero.
- Over 5,000 disposal groups: use the full CSV and summary PDF instead of an unbounded evidence PDF.
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
- Hosted mailbox delivery to the support inbox, billing renewal/3DS/dispute/provider-recovery qualification, live legacy-customer reconciliation, monitoring and provider backup schedule/restore verification.
- Production DNS, live Stripe enablement and launch approval.

Sources: [UK online-selling guidance](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling), [consumer pre-contract information](https://www.legislation.gov.uk/uksi/2013/3134/schedule/2), [IBKR Flex trade semantics](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm). The implementation evidence and remaining gates must be reviewed together.
