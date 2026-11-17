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

Pre-1982 basis adjustments, employee share schemes, funds/ETFs with distributions or reporting-income adjustments, reorganisations/splits/rights issues, short positions, options and other derivatives, crypto, gifts/transfers requiring market valuation and specialist residency/capacity cases have not been certified. Unknown source activity blocks the file; removing an inconvenient row is not an approved repair. AJ Bell's candidate header remains unverified by a broker-issued export; configured IBKR Flex support does not cover arbitrary sectioned Activity Statements.

## Sign-off record (open)

Record reviewer name/qualification, exact commit, source statements reviewed, independently calculated results, identified exceptions and release decision. No independent tax review has been obtained yet. Do not replace this with a test-suite pass or describe the product as HMRC-approved.
