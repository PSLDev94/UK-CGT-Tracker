# Staging UI acceptance · November 2026

## What to compare

Use the original observations and financial examples in [the UI review](FINAL_UI_REVIEW.md). For each pass, start from a verified empty account, record the visible next action, use the Trading 212 fixture, resume its saved preview on another signed-in browser, confirm the row counts, and calculate 2024–25 through 5 May 2025. The result must be £10.50 proceeds, £5.25 cost and £5.25 gain. Follow the selected PDF through cancellation and payment. Reopen the same year and format, read both PDF files and check the CSV.

The historical review's 1,235 px, 2,155 px and 4,821 px measurements are single-fixture baselines at 390 × 844. Compare the position of the *correct next action* and record the remaining fields in the one-row HL repair. Changes in page height alone do not establish task completion.

## First-party event counts

The web service writes `cgt_journey` structured log events. In Railway, select staging → web → logs, filter by this event and group by stage over the same observation window. Use these counts alongside task observations. They represent operations; refreshes, repeat downloads, multiple repairs and return visits can produce more than one event.

| Step | Recorded stage |
|---|---|
| Successful email verification | `email_verified` |
| Preview can be saved or needs attention | `preview_ready`, `preview_blocked` |
| Supporting evidence checked | `repair_saved`, `repair_ready` |
| Import committed for the first time for this draft | `import_saved` |
| Calculation saved with confirmed coverage or still incomplete | `calculation_complete`, `calculation_incomplete` |
| Report list fetched for the Reports screen | `reports_opened` |
| Checkout URL issued | `checkout_opened` |
| Authorized evidence file served | `pdf_served`, `csv_served` |

Only stage names and allowlisted broker categories for import previews/repairs are emitted. The app does not add tracking cookies or a cross-session identity to these events. Compute changes in aggregate completion patterns with the same release and date boundaries; treat user-level conversion and reasons for abandonment as separate research questions. The checkout return cookie and per-tab navigation key exist to restore a requested document. They do not feed the measurement events.

## Implemented journey and observed results

| Task | Staging evidence from 18 November 2026 |
|---|---|
| Find a broker and understand the price | The guidance for all six brokers identify the export and its constraints. Public pricing, upload guidance and report cards distinguish free CSV and calculations from the £49 annual PDF subscription. |
| Verify a new account | A real signup reached the dedicated inbox screen. The owner clicked the email link. Sign-in opened the empty portfolio and its first-account action. An unauthenticated mobile visit to a specific evidence report kept the selected tax year and format through sign-in and password recovery navigation. |
| Review and save a file | Desktop created a Trading 212 taxable account and carried it into Upload. Mobile WebKit reopened the saved preview, refreshed, saved two trades and retained one excluded interest row. Desktop import history displayed the saved source rows. At 390 × 844 the Save action was 45 CSS px high and began about 610 px down the document, compared with 2,155 px in the original review. |
| Resolve a blocked record | Mobile and desktop exercised all six brokers with synthetic files. The native Trading 212 and IBKR Flex examples were ready. Freetrade FX, HL, ii and AJ Bell showed their missing evidence. The HL correction moved its row to ready. The unsupported IBKR export blocked all five records. A Freetrade stock split blocked the file even alongside a valid row. The one-row HL repair form occupied 667 CSS px, compared with 1,577 px previously. The whole page with source evidence open was 1,634 px, previously 4,821 px. Database and parser tests cover correct assisted commits plus unrecognised headers and unsupported activity across the fixtures. |
| Calculate with confirmed coverage | Mobile WebKit calculated 2024–25 with data through 5 May 2025. Proceeds of £10.50 less £5.25 allowable cost produced a £5.25 gain. Expanding the disposal exposed Section 104 matching. The result linked directly to that year's reports. |
| Cancel and complete checkout | Before payment, the new account downloaded the CSV. Cancelling from the summary PDF on desktop and the evidence PDF in phone WebKit restored the original year, document, focus and cancellation message. One £49 Stripe sandbox subscription unlocked the selected evidence report. Reopening Billing showed active access. A portal visit returned to the requested evidence report. A separate held account could reach billing support. |
| Download and read reports | Desktop Chromium and phone WebKit downloaded the summary PDF, the evidence PDF and the CSV. The gain, costs and proceeds agreed with the screen. The evidence traced the disposal to the original broker reference, sell row and matching rule. Free and paid CSV bytes matched. A separate 150-disposal stress test retained all long references within 29 pages. |
| Recover and retain context | Automated cases exercised interrupted requests and retry, expiring previews, Back and refresh, unsaved edits, incomplete account coverage, reversal and invalidated reports. A real shared-IP rate limit during intensive staging tests exposed misleading setup text. The new error shows the server's retry interval when present and offers retry. Refund holds and delayed billing confirmation have separate states. |
| Public tools | Editing a date clears the prior 30-day result. Starting a partial purchase suppresses the Section 104 total. Delaying JavaScript reproduced a lost first edit. Chromium and WebKit then passed delayed-load tests on all three corrected calculators. |

The public and account-entry audit sampled 25 routes. Fifty desktop and phone WCAG 2/2.1 A/AA axe scans found zero violations across those routes. The wider public checks sampled 74 browser, viewport and route combinations. Browser zoom at 200% covered six public pages and ten signed-in screens. A separate signed-in scan found an accessible-name mismatch on account upload links, which was corrected. Mobile tests used Playwright WebKit with iPhone geometry at the owner's request. Physical Files and PDF reader interaction, VoiceOver use and independent investor usability sessions are outside the observed evidence.

The financial records and broker exports used for this pass were synthetic. The owner-authorised staging purchase used Stripe test mode. The report fixture and its paid staging account were retained for review. Real historical broker exports, tax sign-off and the remaining production decisions are tracked in [the launch checklist](REVIEW_READY.md).

## Financial reporting and recovery rehearsal

- For an ordinary share bought for £10 and sold for £5, open the saved calculation, download the CSV and read the signed disposal and net gain columns with a decimal parser. Both must be `-5.00`. Repeat with a gain, a break-even sale and a year containing a gain and a loss. Compare the calculation with both PDF downloads.
- For AJ Bell, Hargreaves Lansdown and Interactive Investor, supply the missing fields from the synthetic contract notes. Open the evidence PDF and trace the sale to its broker, account, file row, execution reference and supporting document. Repeat with a native Trading 212 reference. Public Pricing also has synthetic examples of both PDF formats.
- Change the cutoff on a saved calculation. Identify which dates and accounts the saved total covers, then change year. Check the account confirmations before recalculating. Repeat with missing purchase history and follow the upload link back to the same year's calculation.
- For an observed usability session, give one investor a 201-record statement with a problem on its final page. Ask them to get the file ready to save. Give another investor a year containing a gain and a loss and ask them to explain the total using the spreadsheet. Record the first action, any point where they need help, and whether they can independently reproduce the result.

## Reporting corrections checked on staging, 18 November

A fresh account completed email verification, desktop Trading 212 upload, mobile WebKit preview recovery, calculation, free CSV download, cancelled checkout and one £49 Stripe sandbox subscription. Paid downloads on both browsers reproduced the original 2024–25 £5.25 gain. Returning from Stripe restored the chosen year and PDF. A fast cancel-and-purchase sequence exposed an access retry after payment. After the correction, twelve consecutive Reports visits across desktop and mobile retained access, and the last visit downloaded the evidence PDF. The sandbox customer portal also returned to the selected report.

| 2025–26 synthetic disposal | Signed gain in the export |
|---|---:|
| AJ Bell | −£5.00 |
| Hargreaves Lansdown | +£3.00 |
| Interactive Investor | £0.00 |
| Trading 212 | −£1.00 |
| **Net loss** | **−£3.00** |

The spreadsheet and both PDFs agreed with the screen on £37.00 proceeds and £40.00 allowable costs. The evidence PDF identified all four sale executions and the three assisted brokers’ supporting statements. Before the missing AJ Bell purchase was uploaded, the draft withheld the total and linked back to upload for the selected year.

A native Interactive Brokers Flex preview retained its quantities, commission and taxes across devices. Mobile WebKit repaired the last execution in a 201-record Freetrade statement from the first page and preserved £1,000.00 consideration and £4.50 fees. An unsupported corporate action remained blocked with instructions for the investor.

At 767, 768 and 800 CSS pixels the Accounts heading started 102 pixels down. At 801 it started 33 pixels down alongside the sidebar. Upload selectors measured 44.8 pixels high in mobile WebKit. Twenty-eight desktop and mobile axe scans across 14 public and signed-in routes returned zero detected WCAG A/AA violations.

## Impeccable follow-up on 18 November 2026

Staging application commits `c154f6e` and `e58daf1` implement the assessment. The second commit keeps related source references together in the PDF and removes duplicate reference blocks. The final staging sample fits on two pages and contains all seven example executions. The existing design, page URLs and £49 annual sandbox plan were retained.

| Customer task | Result |
|---|---|
| Understand the filing guidance | Desktop Chromium and mobile WebKit passed the public-tool checks, including Self Assessment registration, the £50,000 proceeds boundary, separate loss-claim guidance, fractional pool balances and partial 30-day matches. Guide lines measured a median of 74 characters on desktop and 47 on mobile. |
| Decide whether to repair a file | The real 101-row Freetrade preview showed the stock split on page two before asking for the 20 repairable FX trades. IBKR consideration, fees, cash and execution references appeared on both devices. Receipts for all six brokers opened on each browser, including reversed imports and the statement references on assisted imports. |
| Choose and buy an available report | Automated cases exercised both sides of the 5,000-group and 50,000-reference limits, the selected report, direct Billing, API checkout and the return journey. A hosted request for an unavailable year returned 409 before issuing a Stripe URL. The exercise used an existing sandbox subscription. |
| Trace a gain or loss | The older £5.25 gain retained its original amounts and gained the verified purchase and sale references on both devices. Fresh assisted and native uploads from AJ Bell, HL, ii and Trading 212 produced £37 proceeds, £40 costs, £3 gains, £6 losses and a £3 net loss. Independent readers checked the signed CSV, summary PDF and detailed PDF on both devices. The missing AJ Bell purchase withheld the total until supplied. |
| Use the workspace on a phone | The scenario price was visible without sideways scrolling at 320 and 390 pixels. Staying on Settings retained the edit and explicitly discarding it reached Billing. The review covered 35 routes and states per browser, with zero automated accessibility violations across the 70 scans. |

The rounding example and professional sign-off field are in [the tax review pack](TAX_REVIEW.md). Broker exercises used synthetic statements. Production deployment and live payments still require a separate decision.

## Selling fees, public guidance and report navigation

Application commit `98bc0c1` includes gross proceeds, selling costs, cash proceeds and total allowable costs in the workspace, CSV and both PDFs. The pricing sample includes a £5 selling fee. Its tagged headings, tables and section bookmarks expose the evidence in reading order. The synthetic fee case in [the tax review pack](TAX_REVIEW.md) explains the expected £33 gain and the comparison to HMRC’s example.

A fresh local release build passed 69 browser cases in desktop Chromium and the same 69 in mobile WebKit. The complete local application and report suite passed 407 tests, including five pool-history pagination layouts. Checks covered invalid signup, broker import and recovery, signed gains and losses, sandbox billing states, missing acquisition history, report selection and downloads. Some browser tests supply controlled network responses for exceptional states.

The public browser walkthrough checked that a 5 April sale and a 20 April purchase both belong in the history supplied to the calculator. Both broker guides requested the original activity file. A sale of 200 shares with a single repurchase of 100 showed a £20 gain before fees on the 100 matched shares and identified the remaining 100. An oversell kept the entered values and explained the quantity available. The first input in each calculator fit the initial 390 × 664 phone viewport.

The two-year workspace test confirmed that Overview, Calculations and Reports select the most recently saved year and respect an explicit year in a link. Keyboard order followed the displayed calculation and the year control preceded the result. Restoring a Settings history entry recovered the unsaved display name only in its original session. Password values stayed out of browser history and draft storage.
