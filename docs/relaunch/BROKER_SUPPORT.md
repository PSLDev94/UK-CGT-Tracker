# Broker support and certification

All six brokers named on the previous website remain in the relaunch scope. Two narrowly defined GBP native readers are now available for preview testing. They are not general broker certification. Public schema evidence and newly constructed fixtures are recorded in [the synthetic corpus](../../tests/fixtures/brokers/README.md).

| Broker | Current implementation | Remaining evidence or handling |
| --- | --- | --- |
| Trading 212 | 21-column Invest history layout; GBP price and total; positive buy/sell trades with zero fees; explicit cash/income exclusions | Other schemas, GBX, foreign currencies, non-zero fees, reused execution IDs and corporate actions stay in review |
| Freetrade | 29-column Activity layout; GBP account and instrument; gross/cash/stamp-duty reconciliation; explicit cash/income exclusions | Other schemas, foreign currency, free shares, pending orders and corporate actions stay in review; export can omit transfers/events |
| Hargreaves Lansdown | Specific recovery guidance and a synthetic Transaction Summary fixture | Need ISIN and fee/contract-note reconciliation; no native import enabled |
| Interactive Investor | Specific wallet/security guidance and an illustrative candidate fixture | Public third-party schema remains experimental; currency and SEDOL/ISIN resolution needed |
| Interactive Brokers | Specific guidance and a sectioned Transaction History fixture | Activity Statements, Flex Queries and Transaction History are distinct; no native importer enabled |
| AJ Bell | Specific security/units/fee guidance and a clearly unverified illustration | Reliable representative schema and contract-note reconciliation still required |

### Native preview contract

Both readers require an explicit ordinary-share confirmation, saved with the draft and checked again at commit. A valid ISIN alone does not establish tax classification. The accepted trade retains the original native fields and adapter version in provenance. Exact known headers may be reordered; unknown, duplicate, missing or added columns do not get silently dropped.

Freetrade's supported trade mapping reconciles quantity × GBP unit price to gross, then gross plus purchase stamp duty to cash total. Sale stamp duty, non-zero FX costs and inconsistent prices block import. Trading 212's initial mapping accepts only GBP/GBP, exchange rate 1, positive consideration and no non-zero fee/tax fields; it reconciles quantity × price to the penny. Broker-reported `Result` is not used as UK taxable gain. Non-zero fees are blocked until their semantics are qualified. [HMRC documents allowable share dealing costs and purchase SDRT](https://www.gov.uk/tax-sell-shares/work-out-your-gain).

These observed layouts timestamp executions in UTC; the adapters convert to Europe/London before selecting the trade date. Order/execution IDs are account-scoped. A repeated trade ID inside one native file requires review, even if the two rows look identical. Across imports, an identical normalized source row is a duplicate; changed fields under that ID are a conflict. Never use an amount-only fingerprint to collapse fills.

A file with any unresolved record cannot be partially saved. Free shares, zero-value trades, splits, transfers and unknown event types are not reclassified as ordinary purchases or ignored. [Freetrade explicitly warns that provider transfers and some corporate actions are absent from its Activity Feed](https://help.freetrade.io/en/articles/6627909-what-information-is-included-in-the-csv-download-of-my-activity-feed); successful parsing is not evidence of complete acquisition history. Check account records and do not delete unsupported rows to force acceptance.

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

On 16 November 2026, the Freetrade and Trading 212 GBP synthetic fixtures passed the deployed browser upload → review → save → calculation journey with independently expected £74.37 and £5.25 gains. Reversal retained audit history. Foreign currency was visibly blocked, while direct commit attempts for corporate actions, mixed valid/unsupported records and duplicate-only uploads returned 409 without creating imports. See [operations](ACCESS_AND_OPERATIONS.md#native-csv-qualification--16-november-2026). This evidence is limited to the named synthetic formats; HL, ii, IBKR and AJ Bell remain unverified and disabled for native import.
