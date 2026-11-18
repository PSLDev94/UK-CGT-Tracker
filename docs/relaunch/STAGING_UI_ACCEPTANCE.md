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
