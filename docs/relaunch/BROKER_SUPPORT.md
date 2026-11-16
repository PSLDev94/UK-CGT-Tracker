# Broker support and certification

All six brokers named on the previous website remain in the relaunch scope. No native adapter is enabled in this increment. The old generic AI mapper and marketing claims do not establish reliable export compatibility.

| Broker | Export variants to verify | Current evidence |
| --- | --- | --- |
| Trading 212 | Invest history CSV; historical schema variants | Official CSV availability confirmed; representative fixtures needed |
| Freetrade | Activity CSV; historical schema variants | Fixtures needed |
| Hargreaves Lansdown | Fund and Share Account transactions | Fixtures needed; verify pence, fees and gross/net semantics |
| Interactive Investor | Trading account transactions | Fixtures needed |
| Interactive Brokers | Activity Statement CSV and Activity Flex Query CSV | Official formats confirmed; sectioned/custom layouts require separate adapters |
| AJ Bell | Dealing account transactions | Fixtures needed |

Primary export documentation: [Trading 212 documents](https://helpcentre.trading212.com/hc/en-us/articles/11700508002845-What-documents-can-I-get-from-Trading-212), [Interactive Brokers statements](https://ibkrguides.com/ipad/statements.htm). These establish export availability, not a complete field mapping.

## What verified support means

Each enabled adapter has a version, exact recognised headers/section structure, transaction-code mapping, date convention, currency and amount semantics, supported account/asset scope and reviewed fixtures. Cover buys/sells, fees/taxes, GBP/foreign currency, fractions, multiple executions, duplicates/overlaps, zero values, multi-year history and unsupported activity. Verify parser totals against the original export and calculation totals independently.

Collect current and historical anonymised samples with permission. Prefer official or openly licensed samples when suitable. Preserve schema and financial relationships during anonymisation. Never commit unredacted customer data. An adapter is enabled only when evidence and tests are in place; otherwise return a clear review requirement without importing partial data.

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
