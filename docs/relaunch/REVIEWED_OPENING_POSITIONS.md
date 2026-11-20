# Professionally reviewed opening positions

Use this route when a historical disposal or missing acquisition prevents a reliable Section 104 calculation. The investor can provide missing broker records through the normal import flow. An authorised operator can instead record a position supported by an independent UK tax professional's dated calculation.

## Evidence the operator needs

Verify the portfolio owner and the ordinary share class by ISIN. The reviewer must establish the beneficial owner, capacity, residence and taxable accounts covered, the number of shares actually held, and the Section 104 allowable cost in sterling at the close of the chosen day. The physical holding and the shares represented by the opening tax pool must agree. A price quotation, market valuation or total shown on a holdings screen alone cannot establish acquisition cost.

The reviewer must account for all acquisitions and disposals that could match across the date, including the following 30 days. Choose a date with no outstanding cross-boundary matches. A documented position can start as early as the close of 5 April 2008, using the reviewed basis carried into the modern regime. Keep the signed determination and dated supporting documents in the private case system. Use opaque case and document references that the owner may see in their reports. [HMRC share identification rules](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51555) · [HMRC transition guidance](https://www.gov.uk/hmrc-internal-manuals/capital-gains-manual/cg51570)

## Preview and record

Prepare a private JSON file in the following format. The example contains fictitious identifiers and values.

```json
{
  "ownerId": "verified-owner",
  "portfolioId": "d0cbeb6b-c612-47ee-a383-da11d5474504",
  "expectedRevision": 4,
  "securityId": "US0378331005",
  "asOf": "2008-04-05",
  "quantity": "100",
  "costGBP": "100.00",
  "caseReference": "REVIEW-401",
  "sourceReference": "BASIS-401"
}
```

Use an authorised operator connection supplied as `OPERATOR_DATABASE_URL`. Run the preview, check its revision against the current portfolio and confirm the evidence in the review case. Apply only after professional review is complete.

```sh
./node_modules/.bin/tsx scripts/record-reviewed-opening-pool.ts --file /private/path/position.json
./node_modules/.bin/tsx scripts/record-reviewed-opening-pool.ts --file /private/path/position.json --professionally-reviewed --apply
```

The write locks the portfolio and advances its revision. Repeating the same case with identical evidence is safe. Each tax year uses the most recent active position for that ISIN dated before the start of the year. An independent position at a later date preserves the earlier basis for intervening years. The engine applies subsequent trades from that position onwards. Original trades and receipts remain available in History.

To correct the same opening date, create a new review case with the corrected figures. It supersedes the previous decision for that date. To replace an incorrect date, also supply `supersedesCaseReference` naming the wrong decision. To withdraw a decision pending investigation, supply `"decision": "withdraw"`, the owner, portfolio, revision and ISIN, a new case and source reference, and `supersedesCaseReference`. A withdrawal takes no quantity, cost or date. The reviewer may withdraw a stale decision even when the underlying trade record has changed. Recalculations use any earlier independent active basis or the original trade history. Superseded and withdrawn decisions never become active again.

Recalculate the affected years and check the amount and evidence against the professional's determination. A change to any active receipt for that share class through 30 days after the chosen date requires review again. An acquisition that might match a sale across the boundary blocks the operator action. Adding a reviewed position cannot resolve a short sale after its date, a change of residence, an unresolved import or an unsupported corporate action.
