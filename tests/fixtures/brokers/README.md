# Synthetic broker CSV qualification corpus

Created 2026-11-16. Every account, order, monetary amount and activity row here was constructed for tests. These are not customer exports and are not evidence of comprehensive current broker compatibility. Real ISINs/tickers identify the instrument in artificial examples only. Never upload these to a real portfolio or present them as broker-issued statements.

| Fixture | Evidence and purpose |
| --- | --- |
| `freetrade-gbp.csv` | Exact 29-column schema observed in the publicly published Freetrade fixture below. Synthetic GBP purchase including £2.50 stamp duty, partial sale and excluded cash dividend. |
| `freetrade-foreign-review.csv` | Same schema; USD instrument must block rather than guess FX or spread treatment. |
| `freetrade-corporate-action-review.csv` | Same schema; deliberately unsupported event mixed with a valid purchase. No partial commit. `STOCK_SPLIT` here is an adversarial test code, not a claim about the broker's code. |
| `trading212-gbp.csv` | Exact 21-column public Invest sample schema below. Synthetic fractional GBP buy/sell and cash interest. |
| `trading212-foreign-review.csv` | Same schema; USD needs further FX qualification. |
| `trading212-corporate-action-review.csv` | Same schema; split activity must block ordinary-trade import. |
| `hl-contract-note-required.csv` | Public Transaction Summary preamble/header shape below, newly constructed values. Missing ISIN and separate charges require contract-note reconciliation. Supported through the assisted HL adapter; contract-note details remain required. |
| `ibkr-transaction-history-review.csv` | Public sectioned Transaction History shape below. Not an Activity Statement or Flex Query. Missing execution ID/security classification is not inferred. |
| `ii-wallet-review.csv` | Illustrative 11-column shape documented by another parser's author as experimental. This is weaker evidence, not a verified ii export. Supported through the assisted ii adapter with verified contract-note details. |
| `ajbell-unverified-illustration.csv` | Illustrative six-column candidate from an import provider's own published interface (`date,description,type,quantity,price,amount`). NOT a verified AJ Bell layout; contradictory published layouts exist. Exercises the explicit unsupported recovery path only. |

## Sources and strength

Public source files in [cgt-calc/capital-gains-calculator](https://github.com/cgt-calc/capital-gains-calculator), inspected through GitHub on 2026-11-16:

- [Freetrade fixture](https://github.com/cgt-calc/capital-gains-calculator/blob/main/tests/freetrade/data/transactions.csv), Git blob SHA `232038e46d90570a226012b787dfecd5378f05fd`.
- [Trading 212 fixture](https://github.com/cgt-calc/capital-gains-calculator/blob/main/tests/trading212/data/2024/inputs/transactions.csv), Git blob SHA `7cd324e9b702f918219ed0bde55cd3b4a81a9305`.
- [HL fixture](https://github.com/cgt-calc/capital-gains-calculator/blob/main/tests/hl/data/inputs/hl-transaction-summary.csv), Git blob SHA `7d91c108c475d0b616b7fe098810ed085ea29045`.
- [IBKR Transaction History fixture](https://github.com/cgt-calc/capital-gains-calculator/blob/main/tests/interactive_brokers/data/test_basic.csv), Git blob SHA `d17dd672848a1f3e4c58efafbee4ccc1e8c368dc`.

These are public, author-published examples under MIT, not broker certification. Their data rows were not copied. Schema names, report structure and field interpretations informed our independently written tests/readers. See `THIRD_PARTY_NOTICE.md` for attribution. The same author's [Trading 212](https://cgt-calc.uk/brokers/trading212/) and [Freetrade](https://cgt-calc.uk/brokers/freetrade/) documentation informed the UTC-to-UK-date convention. Retain source blob IDs when replacing fixtures.

- [Freetrade's official exclusions](https://help.freetrade.io/en/articles/6627909-what-information-is-included-in-the-csv-download-of-my-activity-feed): the Activity Feed can omit provider transfers and some corporate actions. This is an independent completeness limitation even when a file parses.
- [Trading 212 official export steps](https://helpcentre.trading212.com/hc/en-us/articles/360016898917-Can-I-export-the-trading-data-from-my-account): history exports can be filtered; a readable export alone cannot establish coverage.
- [ii parser author's experimental schema description](https://github.com/alexpung/UK-Investment-tax-calculator): no real-export certification claimed by that author.
- [AJ Bell import provider's own format description](https://thewill.ai/help/assets/portfolio-import-aj-bell): evidence only for that provider's accepted shape. This does not establish actual AJ Bell field/fee/currency semantics.

## Independent expectations and release gates

Freetrade purchase: gross £500 + £2.50 stamp duty = £502.50 for 1,000 shares. Sell 250 for £200: exact allocated cost £125.625; the current engine's reporting convention displays cost £125.63 and reconciles displayed gain £74.37. Trading 212: 10.5 shares cost £10.50; 5.25 shares sold for £10.50 allocate £5.25 cost, giving £5.25 gain. These are mathematical fixtures, not personal tax advice.

Automated mutations cover amount mismatches, changed columns, classification, unknown codes, reused IDs, duplicate retries, corrected timestamps, pence/foreign currency, zero trades and date boundaries. Database tests check that the confirmation survives draft resume and commit. General release still requires representative current exports and independent tax review. Do not turn an unsupported fixture into a success by inventing missing data or deleting inconvenient records.

## Assisted-reader review fixtures (17 November 2026)

`hl-assisted.csv`, `ii-assisted.csv`, `ajbell-assisted-candidate.csv` and `ibkr-flex-gbp.csv` contain synthetic purchases and disposals. `assisted-details.json` supplies explicitly synthetic contract-note evidence for the first three. HL/ii/AJ produce £70.88; IBKR produces £71.62 after the engine's disposal rounding. No fixture contains a customer's trades.

HL/ii layouts extend the evidence described above. AJ Bell's six-column layout remains a candidate rather than a verified broker export. IBKR's configured fields and signed proceeds/net cash follow [IBKR Trades Flex documentation](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm); `ClientAccountID` and Flex field selection are corroborated by the [parser author's setup](https://github.com/tfiala/ibkr-flex-statement-rs) and [CSV integration author's setup](https://github.com/CoolONEOfficial/wealthfolio-ibkr-addon). The custom 16-column fixture is constructed, not downloaded from IBKR. General Activity Statements and extra financial columns remain blocked.


## 33-column Trading 212 variant

`trading212-2026-gbp.csv` contains newly invented trades, with £4 buy costs (including £2.50 stamp duty), £2 sale costs and a £72.00 independently calculated gain. Header source: [public 2026 fixture](https://github.com/cgt-calc/capital-gains-calculator/blob/1dd3c9073006fcebef17219f8c556bf2ae0dd9c5/tests/trading212/data/2026/inputs/transactions.csv), inspected 17 November 2026, blob `236a8a7921e91533e2111923552fff13d96e9ade`. No financial rows were copied. The existing MIT attribution applies. Tests mutate this fixture to cover foreign fees, unexplained fields, UTC boundaries and duplicate/conflicting execution IDs.


## Further exact variants and fee reconciliation

- `ajbell-history-gbp.csv`: newly invented GBP major-unit prices and cash amounts, using field names from [Sharesight’s AJ Bell guide](https://www.sharesight.com/uk/partners/aj-bell/), inspected 17 November 2026. Set the accompanying synthetic contract details to major price units. Independently expected gain £70.88. The guide establishes a documented import shape, not comprehensive broker certification. No ticker/rate inference or silent row filtering from that guide is implemented.
- `freetrade-fx-fees.csv`: newly invented USD trades with base rate 1.25 USD/GBP, verified 0.8 GBP/USD, 45 basis points and separately stated GBP fees. £1,004.50 acquisition cost for 100 shares; 50 sold for £597.30 net, allocated cost £502.25, gain £95.05. No public financial rows were copied.
- Freetrade header aliases and account-currency fee semantics were inspected in the author-published [parser](https://github.com/cgt-calc/capital-gains-calculator/blob/main/cgt_calc/parsers/freetrade.py), blob `9745735dc63f502a482b3ccac7c2a1187e32b702`. Effective/base rate direction and fee fields were checked against its existing synthetic [public CSV](https://github.com/cgt-calc/capital-gains-calculator/blob/main/tests/freetrade/data/transactions.csv), blob `232038e46d90570a226012b787dfecd5378f05fd`. Existing MIT attribution applies. Freetrade’s own [fee calculation guidance](https://help.freetrade.io/en/articles/7252897-how-much-will-my-fx-fee-be) corroborates the gross-conversion fee calculation. Rates/fees are read from each file and verified, not hard-coded to a current pricing plan.
- New test generators create synthetic trades only; they are not substitutes for genuine exports. Unknown additional columns, non-stock classifications, transfers and corporate actions continue to block rather than disappear.
