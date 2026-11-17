# Broker support and certification

All six brokers have explicitly scoped import paths in the review build. See the [current acceptance matrix](REVIEW_READY.md#broker-acceptance-matrix) and [synthetic corpus](../../tests/fixtures/brokers/README.md). These are tested readers and assisted mappings, not certification of every native export. AJ Bell now has a GBP transaction-history assisted path based on its integration partner's field documentation, alongside the older candidate layout. Broker-issued exports still need independent validation.

### Native preview contract

All readers require an explicit ordinary-share confirmation, saved with the draft and checked again at commit. A valid ISIN alone does not establish tax classification. The accepted trade retains the original native fields and adapter version in provenance. Exact known headers may be reordered; unknown, duplicate, missing or added columns do not get silently dropped.

Freetrade reconciles account-currency prices, instrument-currency gross amounts, base/effective exchange rates, stamp duty and explicit FX fees to net cash. The supplied GBP rate must exclude the separately counted fee; the exported fee percentage and amount must reconcile on both purchases and sales. Trading 212 supports GBP/GBX prices, separately denominated GBP dealing/conversion fees and verified foreign-currency rates where the cash total is GBP. Broker-reported `Result` is never used as UK taxable gain. HL/ii/AJ Bell require contract-note evidence and reconcile quantity × price ± verified fees to net cash. IBKR requires execution-level stock rows and reconciles signed proceeds + commissions + taxes = net cash. [HMRC allowable dealing costs](https://www.gov.uk/tax-sell-shares/work-out-your-gain).

The T212 and Freetrade layouts timestamp executions in UTC; the adapters convert to Europe/London before selecting the trade date. Order/execution IDs are account-scoped. A repeated trade ID inside one native file requires review, even if the two rows look identical. Across imports, an identical normalized source row is a duplicate; changed fields under that ID are a conflict. Never use an amount-only fingerprint to collapse fills.

Freetrade monthly-statement and tax-certificate notifications are counted as explicit non-transaction exclusions only when every financial/execution field is blank; a notification carrying amounts or quantities blocks review. A file with any unresolved record cannot be partially saved. Free shares, zero-value trades, splits, transfers and unknown event types are not reclassified as ordinary purchases or ignored. [Freetrade explicitly warns that provider transfers and some corporate actions are absent from its Activity Feed](https://help.freetrade.io/en/articles/6627909-what-information-is-included-in-the-csv-download-of-my-activity-feed); successful parsing is not evidence of complete acquisition history. Check account records and do not delete unsupported rows to force acceptance.

## What verified support means

Each enabled adapter has a version, exact recognised headers/section structure, transaction-code mapping, date convention, currency and amount semantics, supported account/asset scope and reviewed fixtures. Cover buys/sells, fees/taxes, GBP/foreign currency, fractions, multiple executions, duplicates/overlaps, zero values, multi-year history and unsupported activity. Verify parser totals against the original export and calculation totals independently.

Collect current and historical anonymised samples with permission. Prefer official or openly licensed samples when suitable. Preserve schema and financial relationships during anonymisation. Never commit unredacted customer data. Limited preview adapters require documented schema evidence and tests. General certification additionally requires representative exports, reconciliation and independent review; otherwise state the exact supported subset and return clear review requirements.

Local intake directory: `.private/broker-samples/` (Git-ignored). Keep original customer exports there until anonymisation and permission review are complete. Only approved synthetic/anonymised fixtures belong in `tests/fixtures`.

100% support means every record in the explicitly certified format is accounted for and every supported trade is correctly normalised. It cannot honestly mean every future broker format or every asset type. Unknown columns, changed transaction codes and unsupported events must be caught rather than guessed.

## Canonical interchange format

The currently implemented format is an internal template, not a native broker CSV. The user or a verified adapter must provide these exact columns, in any order:

`Transaction ID,Trade date,Type,ISIN,Quantity,Consideration,Fees,Currency,GBP per unit,Asset type`

- Transaction ID: stable execution identifier within the selected broker/account. Separate executions retain separate IDs even when economics match.
- Trade date: ISO `YYYY-MM-DD`; no inferred UK/US date order.
- Type: `BUY` or `SELL`. Explicit `CASH_DEPOSIT`, `CASH_WITHDRAWAL`, `CASH_DIVIDEND` and `CASH_INTEREST` are counted as exclusions from share gains. Other codes require review.
- ISIN: uppercase identifier with a valid check digit. Instrument classification must also be confirmed; ISIN validity alone does not prove ordinary-share status.
- Quantity: positive decimal shares, up to 12 decimal places. Never encode the side using a negative quantity.
- Consideration: gross trade consideration excluding the separately specified fees, in major source-currency units. Do not paste a net cash amount without converting it to this contract.
- Fees: non-negative allowable incidental transaction costs in the same source currency; enter `0` when none. Fee eligibility must be checked by the adapter/tax specification.
- Currency: supported ISO currency code. `GBX` and pence are rejected; convert explicitly to GBP first.
- GBP per unit: the number of pounds per one major source-currency unit, using the applicable trade-date conversion; exactly `1` for GBP. No reciprocal guessing.
- Asset type: `ORDINARY_SHARE` in this first increment. Other classifications require explicit handling.

Decimal points are `.` with no currency symbols, grouping separators or exponent notation. CSV quoting and UTF-8 BOMs are supported. The limit is 10 MiB and 100,000 data records. Original monetary values, currency and exchange rate are retained in provenance. Converted GBP values use up to 12 decimal places; reporting rounds only at the documented output boundary.

The preview classifies all parsed data records as accepted, excluded, duplicate or needs review. A single unresolved record blocks committing the entire file. Duplicate IDs with conflicting contents are flagged, not overwritten. An all-duplicate file is a no-op requiring an explanatory result, never a successful new import.


## Hosted qualification

On 16 November 2026, the Freetrade and Trading 212 GBP synthetic fixtures passed the deployed browser upload → review → save → calculation journey with independently expected £74.37 and £5.25 gains. Reversal retained audit history. Foreign currency was visibly blocked, while direct commit attempts for corporate actions, mixed valid/unsupported records and duplicate-only uploads returned 409 without creating imports. See [operations](ACCESS_AND_OPERATIONS.md#native-csv-qualification--16-november-2026). This evidence is limited to the named synthetic formats; HL/ii/IBKR/AJ Bell subsequently passed the named synthetic hosted import/report/reversal checks on 17 November; see [review operations](REVIEW_OPERATIONS.md). This does not establish additional native-schema coverage.


### Trading 212 newer export (17 November 2026)

The exact 33-column public 2026 fixture layout is implemented alongside the 21-column reader. It accounts for stamp duty reserve tax, French transaction tax, transaction/conversion/FINRA fees, UTC timestamps and currency labels. Foreign trades still require independently verified conversion and dealing costs. Unexplained conversion legs/card data, unknown columns and unsupported events block the file. The new synthetic GBP fixture produces a £72.00 gain (purchase cost £504, sale proceeds £198, matched cost £126). The public schema is evidence of that variant only, not a broker certification. Re-exporting existing execution IDs in a changed format retains the same source identity and blocks for provenance conflict review; it cannot silently double-count.


## Further broker qualification — 17 November 2026

- AJ Bell: separate exact header `Date,Description,Transaction,Quantity,Price,Amount (GBP)`, documented in [Sharesight’s AJ Bell integration guide](https://www.sharesight.com/uk/partners/aj-bell/). Only Purchase/Sale with contract-note-confirmed GBP major-unit prices are accepted. Execution ID, ISIN and fees remain explicit supporting evidence. This is a documented assisted subset, not an assertion that arbitrary AJ Bell exports or foreign-price layouts are supported. The guide’s suggestions to infer tickers/rates and omit other records are not used.
- Freetrade: exact aliases `Total Amount in Account Currency` and `Total Amount in Instrument Currency` are recognised, without accepting additional or ambiguous columns. Foreign FX fees use the exported base rate, effective rate, basis points and explicit GBP fee. Buy fees increase cost; sell fees reduce proceeds. A synthetic £1,000 gross acquisition with £4.50 fee, followed by a half-sale with £600 gross and £2.70 fee, produces £95.05 gain. Changing any rate, fee or net total blocks the file. Source references and limits are in the fixture README.
- Supporting-detail fingerprints now use the fixed PostgreSQL JSONB field order. Editing/re-uploading identical evidence cannot create a false correction merely because JSON keys changed order; values and source-format provenance remain significant. Existing committed hashes are preserved, and real-PostgreSQL qualification checks compatibility explicitly.
- `broker-qualification.test.ts` applies record accounting, malformed fields, cash mismatch, unknown activity, column order/quoting, duplicate/conflict and combined matching checks to each fixture path. Generated fractional trades compare against integer-pence expectations. The persisted workspace and PostgreSQL qualification suites run upload → evidence → commit → calculation → snapshot → duplicate retry → reversal for the same corpus.
