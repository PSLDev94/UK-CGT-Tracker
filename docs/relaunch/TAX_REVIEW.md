# Calculation review pack

Prepared 17 November 2026 for an independent UK tax reviewer. This is implementation evidence, not an accountant's approval. The application reports share gains/losses and matching evidence; it does not calculate a complete tax liability or submit a return.

## External reference cases

`tests/hmrc-reference.test.ts` adapts the quantities and calendar intervals in [HMRC CG51560 examples 1–3](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51560). Dates move into supported years. Monetary values below are independently invented for tests, not figures from HMRC. All three tests pass.

| Case | Input | Expected result |
| --- | --- | --- |
| Day 30 | Pool: 1,000 shares / £1,000. Sell 1,000 on 1 July for £3,000; buy 1,000 on 31 July for £2,000. | Entire sale matches the later purchase. Gain £1,000; original pool unchanged. |
| Partial future matching | Pool: 2,500 / £5,000. Sell 1,700 on 27 March for £6,800; buy 500 on 30 March for £1,500. | 500 match future acquisition, 1,200 match pool. Cost £3,900; gain £2,900; remaining pool 1,300 / £2,600. |
| Day 31 | Pool: 10,000 / £10,000. Sell 2,000 on 28 February for £6,000; buy 3,000 on 31 March in a non-leap year for £6,000. | Sale matches pool. Gain £4,000; closing pool 11,000 / £14,000. |

[HMRC CG51575](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51575) describes the pooled expenditure and quantity-based part-disposal approach. Our separate regression suite covers fees, multiple same-day buys/sells, all three matching priorities, competing later purchases, cross-year matches and year-end pool presentation. Property tests cover input-order invariance and conservation of pool cost/quantity.

## Reviewer questions and required evidence

- Confirm the supported legal/tax scope: one UK-resident individual, acting in one personal capacity, holding taxable ordinary shares. Check how that scope is communicated and attested in the product before launch. Same ISIN across that person's taxable broker accounts shares one pool; trusts, joint ownership/capacity changes and residency changes need separate handling.
- Review share class identification, ISIN validation and explicit ordinary-share classification. A ticker or valid ISIN alone does not establish tax treatment. ISA/SIPP activity does not belong in taxable pools.
- Review purchase/sale incidental costs and source currency treatment, including stamp duty, foreign transaction taxes, dealing and FX fees. Decide whether each supported fee is allowable and confirm rounding against actual statements; arithmetic reconciliation alone cannot establish deductibility.
- Review missing acquisition history, post-year-end 30-day coverage, opening pools and corporate-action recovery. A declaration of completeness is customer evidence, not proof an export includes all events. Missing costs remain unresolved, never zero-filled.
- Compare full CSV evidence, summary PDF and detailed PDF for the same immutable saved calculation, including incomplete/draft labels. Confirm report wording and users' mapping to their return; the PDF is not an SA108 form.
- Review loss presentation, output precision, rounding aggregation, current allowances and historical acquisitions. Allowance information must not imply every user qualifies or that their total tax liability has been computed.

Files for inspection: `src/domain/cgt/calculate.ts`, `src/domain/cgt/types.ts`, `src/domain/values.ts`, `src/domain/imports/{review,native,additional-brokers}.ts`, `src/domain/reports/`, `tests/{cgt,hmrc-reference,native-imports,additional-brokers,broker-variants,reports}.test.ts` and the explicitly synthetic broker corpus.

## Explicit scope exclusions

Pre-1982 basis adjustments, employee share schemes, funds/ETFs with distributions or reporting-income adjustments, reorganisations/splits/rights issues, short positions, options and other derivatives, crypto, gifts/transfers requiring market valuation and specialist residency/capacity cases have not been certified. Unknown source activity blocks the file; removing an inconvenient row is not an approved repair. AJ Bell's documented assisted history and older candidate headers still require broker-issued export validation; configured IBKR Flex support does not cover arbitrary sectioned Activity Statements.

## Fractional pool rounding decision for review

The staging evidence PDF, CSV and Reports screen include an annual reconciliation when summing the individual rounded disposals differs from rounding once for the year. The pool ledger retains its calculation precision. This example is reproducible in `tests/reports.test.ts` in the test “reconstructs partial and closed pools and explains every penny of disposal rounding”.

Buy three shares for £10 in one purchase. After the 30-day window, sell one share on each of three separate days for £5 each, with no fees and no other trades. The reported cost for each disposal is £3.33. The pool closes with zero shares and zero cost.

| Measure | Rounded once for the year | Effect of rounding each disposal | Published total |
|---|---:|---:|---:|
| Proceeds | £15.00 | £0.00 | £15.00 |
| Allowable costs | £10.00 | −£0.01 | £9.99 |
| Net gain | £5.00 | +£0.01 | £5.01 |

The reviewer should record which figure the investor should use for UK reporting, the authority for that treatment and any required change to the annual or per-disposal presentation. Review the same decision for losses, partial disposals and transactions spanning a tax-year boundary. HMRC's worked example illustrates how to carry the remaining pooled cost forward after a partial disposal. [HMRC HS284, example 3](https://assets.publishing.service.gov.uk/media/69c14ad87e02b81c0d1c7669/HS284-Example-3-2026.pdf)

## Selling costs and the accountant’s report

Buy one ordinary share for £60 with £2 in allowable dealing costs. Sell it for £100 with a £5 selling cost. Gross disposal proceeds are £100, cash after selling costs is £95, matched acquisition cost is £62, total allowable costs are £67 and the gain is £33. The reports show the components separately. For a sale at £55 with zero selling costs against the same £62 acquisition cost, the loss is £7.

The 2025–26 listed-share section of SA108 separates disposal proceeds and allowable costs. HMRC’s worked example deducts selling costs alongside the matched acquisition cost. The synthetic examples above use the same presentation. [2025–26 SA108](https://assets.publishing.service.gov.uk/media/69bd8990cfa346b9d47049e4/SA108-2026.pdf) · [HMRC worked example](https://assets.publishing.service.gov.uk/media/69c14ad87e02b81c0d1c7669/HS284-Example-3-2026.pdf)

For fractional cash values, check the separately disclosed adjustment between the rounded net proceeds and gross proceeds less selling costs. For a historic calculation, check that reconstructed evidence agrees with the original input fingerprint and saved result. Where that comparison cannot be made, the reader is told which figures are unavailable and can recalculate the year.

## Sign-off record (open)

Record reviewer name/qualification, exact commit, source statements reviewed, independently calculated results, identified exceptions and release decision. No independent tax review has been obtained yet. Do not replace this with a test-suite pass or describe the product as HMRC-approved.


## Additional independent arithmetic checks

`tests/cgt-model.test.ts` compares 500 seeded generated histories against an independently written exact BigInt rational model that allocates individual quarter-share tokens. It covers competing purchases/disposals, same-day reservation, 30-day identification, pooled allocations, pre-year and post-year activity, fees, output rounding and export-order invariance. The broker corpus separately checks generated fractional acquisitions against integer-pence arithmetic and routes combined matching cases through each native reader. These are differential arithmetic tests within the existing scope, not independent professional tax sign-off.

## Corrected calculation and recovery procedure

Engine 2.0.0-alpha.5 preserves rational quantities and costs until a reporting boundary. Two twelve-decimal currency operands are multiplied exactly, and sterling trade values retain up to 24 decimal places. A pre-upgrade receipt with retained original amount and exchange rate can recover its precise conversion when it agrees with its saved twelve-place value. A known foreign-currency receipt with missing or contradictory FX operands requires review against the original statement before it can supply a result. Historical snapshots and receipt records remain intact. Prices, fees, closing positions, individual rounded disposal groups and the annual reconciliation are covered separately. A reported zero requires the stated history cutoff. A saved report records the investor’s declaration of UK residence, personal ownership in one capacity and arm’s-length ordinary market transactions. Private sales to family, gifts, transfers and other special-basis events go to specialist review. The previous residence-only declaration requires reconfirmation. The cutoff must reach the first day of the selected tax year. Reports from an earlier engine must be recalculated. The original receipts and historical runs remain available to an authorised reviewer.

A historical disposal before 6 April 2008 can leave a pool cost unresolved even when the holding quantity is evidenced. If that security has no disposal in the assessed period and no recorded ownership shortfall, the report can include independently evidenced gains on other securities and identify the unresolved pool separately. A sale of the affected security in the assessed period continues to block the annual total. The taxpayer must still confirm the history of each included account. [HMRC pooled holdings](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51575) · [HMRC connected-party treatment](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg14560)

For an unexplained sale, check the date, share class, transfers and acquisition evidence across every taxable account. Import the actual earlier purchases, then confirm the corrected history. For an affected pre-6-April-2008 disposal with continuing holdings, a residence or ownership change, or a genuine short sale, refer the case to a qualified reviewer. Supply original contracts, transfers, corporate actions and any reconciled opening quantity and cost. The self-service import accepts original trades. Do not invent a purchase to simulate opening basis. For a reviewed ordinary-share opening position, an authorised operator can record the reconciled basis and case/source references using the reviewed-opening procedure. The workspace then applies it to eligible later years. Changes to reviewed receipts or possible matching across its cutoff require renewed review. Other specialist cases remain with the reviewer.

[Professionally reviewed opening position procedure](REVIEWED_OPENING_POSITIONS.md)

The operator can run the following aggregate audit against a restored database or an approved administrative read connection after migrations through 0015. Supply OPERATOR_DATABASE_URL from the secret manager. It compares the saved annual status and net amount with a recalculation at the original cutoff when the portfolio revision still matches. Revised portfolios and unsafe imports have separate counts. It uses a read-only transaction, reports counts by year and never publishes a result or supplies a customer's scope declaration.

```sh
node_modules/.bin/tsx scripts/audit-published-reports.ts
```
