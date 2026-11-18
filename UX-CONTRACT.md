# CGT Tracker interface contract

Visual intent is in `DESIGN.md`. Domain authority is in `docs/relaunch/API_CONTRACT.md`, `IMPLEMENTATION_PLAN.md`, `BROKER_SUPPORT.md` and the tested server/domain services.

## Canonical UI map

| Capability     | Canonical owner                | Source of truth        | Allowed variants               | Verification                           |
| -------------- | ------------------------------ | ---------------------- | ------------------------------ | -------------------------------------- |
| Form           | `src/ui/primitives.tsx`        | API contract           | account, import, calculation   | browser validation and failure tests   |
| Select/Listbox | `SelectField`                  | DESIGN.md              | native OS popup                | keyboard and narrow viewport           |
| Date | `Field` with date hint; recovered public calculators use native date inputs | API date-only contract | typed YYYY-MM-DD for history; native dates for examples | invalid date and calculation tests |
| Scrollbar      | `src/app/globals.css`          | DESIGN.md              | global and table overflow      | computed style and viewport checks     |
| Toast          | `Notice`                       | API contract           | persistent inline status/error | live region tests                      |
| CRUD           | `src/ui/workspace.tsx` and API | API contract           | preview/commit/discard/reverse | browser workflow plus PostgreSQL tests |

Table selection and bulk edits are not offered. No local substitute for these owners is permitted.

## Flows and recovery

Authentication uses verified persisted sessions, as defined in the API contract. Signup replaces its form with a neutral check-email screen, resend, correction and sign-in actions; it never claims an unverified account is signed in. Invalid login remains generic. Password reset clears the token from the URL after reading it, uses no analytics, and asks the user to sign in again after success. Passwords permit paste/autofill and have labelled reveal controls.

The workspace overview chooses the next step from saved accounts, previews, imports and calculations. Each core destination has a URL. Saved preview IDs, account choices, selected tax years and requested report formats can survive navigation and sign-in through bounded internal return destinations. Navigation remains available in empty/error states. All financial mutations wait for server acknowledgement. Busy actions block duplicate clicks. Uncertain completion explains that a request may have reached the server; reload before repeating account creation or upload. Commit/reversal can safely retry using stable server IDs. No automatic mutation retry.

Import: choose a taxable account, use the selected broker’s native format or choose the reviewed template, select one UTF-8 CSV (10 MiB maximum), then Review file. Preserve the selected file on recoverable failures. A server-saved preview is listed on return and expires after 24 hours. For native imports, offer an unchecked ordinary-share classification checkbox; the server persists this attestation and unresolved classification blocks saving. Reset the checkbox when file, account or format changes, and after successful upload, so it cannot carry over to another file. Explain incomplete-history risks and broker-specific limitations before upload. Review every category and show row reasons. Unresolved/unsupported files have no Save transactions action. Conflicts replace the preview with the server's new review and require another click. Discard removes only an uncommitted preview. Saved files can be reversed with a reason and an explicit confirmation naming the scope and effect on calculations. The modal starts focus on Cancel and restores focus on closing. Reimport is the correction workflow.

Calculations require a tax year, a history cutoff, and explicit checkboxes for each account whose full history has been imported. Incomplete coverage remains visible even if the engine has complete matching. Provisional/blocked results cannot be presented as filing ready. The result links to the selected year in Reports. CSV evidence stays free. PDF actions reflect server-verified subscription access and return to the selected document after sandbox checkout.

Billing's source contract is `docs/relaunch/BILLING.md`. The separate `/billing` preview is explicitly labelled a test with no real charges. It reuses `Button`, `Notice`, the shared API client and signed-in dashboard shell. Initial load and refresh show progress; failures retain a refresh action; expired sessions show a sign-in link. Checkout and portal actions wait for the server, prevent duplicate clicks, and navigate only to the expected Stripe host. A checkout return does not claim payment success. Current payment state, review holds and scheduled cancellation come from reconciliation. Saved investment records remain accessible independently of payment. Live charging stays disabled.

Account creation, file selection, calculation fields and reversal reasons are kept only in memory. No secret or financial draft is persisted in local/session storage. Reload may require selecting a local file again, which is stated near the picker. Server previews survive navigation. In-app navigation during a pending mutation is disabled; a beforeunload guard covers uncertain in-flight work. Navigating away from an unsaved file or an edited form prompts for confirmation. Saved previews can be reopened by URL, including from a different signed-in device.

The URL identifies the workspace view and saved preview. Broker and account access are checked on the server when reopening a preview. Import history and the saved records in each import use server pagination.

## Accessibility and locale

Target WCAG 2.2 AA. All forms use noValidate, field-level text errors, labelled controls, valid aria-describedby and first-invalid-field focus. Status regions are polite; errors use role alert. Keyboard focus is visible. Native select popups are accepted. The browser suite verifies 375px layouts, with overflow limited to data regions. The staging acceptance record tracks the widths, browser zoom and assistive technology actually tested. Reduced motion and forced colours remain usable. Use en-GB copy and numeric formatting; trade dates are date-only UTC, audit timestamps display Europe/London with a zone label.

## Evidence and limits

`tests/ui.spec.ts` covers the new browser flows with controlled API responses, including interrupted requests, pending actions and guarded navigation. These complement the actual auth/PostgreSQL tests; they do not replace hosted end-to-end checks, real mail delivery, native CSV certification or Stripe lifecycle tests. Staging remains explicitly labelled a preview until the release gates in the implementation plan pass.

## Original interface restoration — 17 November 2026

The user requested the original website and all its pages, with every new screen following the existing UI/UX. Revision `9ded8c0` is the visual source. Original public markup, pie-chart logo, Inter typography, blue/white/gray palette, pricing, guide articles, calculators and sidebar navigation are restored. Original gradients and guide callouts are intentional user-approved design, not new decoration. New accounts, import review, history, broker support and sandbox billing use the same controls and card styling.

`/dashboard` opens the portfolio overview and its Calculations link opens the tax-year calculation; `/dashboard/upload`, `/dashboard/accounts` and `/dashboard/history` open their matching workspace views. `/workspace` retains account-first setup. `/dashboard/settings`, `/dashboard/reports`, `/dashboard/tax-loss-harvesting` and `/dashboard/contact` restore the other original pages. `/login`, `/signup`, `/forgot-password` and `/reset-password` preserve original entry points alongside the existing `/account/*` routes.

Settings uses authenticated Better Auth profile and password endpoints and retains edits on error. Email is read-only. Settings links to billing and to the account-deletion support request. Historical price scenarios use saved complete pools and user-entered prices.

Public educational calculators retain their original layouts with Decimal arithmetic and explicit bounded input checks. The allowance example models the standard basic-rate band rather than treating all gains of a basic-rate taxpayer as 18%. Oversells produce no pool result; same-day purchases are distinguished from 30-day matches. Tax articles link to official year-specific HMRC sources. Mobile menus support keyboard Escape and restore focus. Original source content does not override validated product support or current financial facts.

## Import/report review increment — 17 November 2026

Recognised native trade rows can expose `ImportDetailsForm`, extending the canonical Field/SelectField/Button/Notice controls. Original source fields remain visible beside verified ISIN, currency, units, fees and contract-note reference. Unsaved details prevent page changes/commit and participate in the shared navigation guard. Server review-version conflicts require reopening the preview. Neither UI nor API offers a skip-unknown-row action.

Reports retain the original card layout. A single tax-year selector governs summary PDF, evidence PDF and CSV; downloads have bounded waits, persistent failures and explicit subscription links. Reports always use server-owned snapshots; client-side state cannot grant paid access. Source: `src/server/reports-api.ts` and `docs/relaunch/REVIEW_READY.md`.

Contact now submits through the server mail service, preserving failed input and its idempotency reference on retry. Success means provider acceptance, not confirmed inbox delivery. Account deletion remains a verified support request, with no misleading disabled delete button. Production retention decisions remain open. Business identity is PSL Digital; the owner confirmed no VAT registration and requested no published contact address in this review version.
