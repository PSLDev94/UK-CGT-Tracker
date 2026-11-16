# CGT Tracker interface contract

Visual intent is in `DESIGN.md`. Domain authority is in `docs/relaunch/API_CONTRACT.md`, `IMPLEMENTATION_PLAN.md`, `BROKER_SUPPORT.md` and the tested server/domain services.

## Canonical UI map

| Capability     | Canonical owner                | Source of truth        | Allowed variants               | Verification                           |
| -------------- | ------------------------------ | ---------------------- | ------------------------------ | -------------------------------------- |
| Form           | `src/ui/primitives.tsx`        | API contract           | account, import, calculation   | browser validation and failure tests   |
| Select/Listbox | `SelectField`                  | DESIGN.md              | native OS popup                | keyboard and narrow viewport           |
| Date           | `Field` with date hint         | API date-only contract | typed YYYY-MM-DD               | invalid date and calculation tests     |
| Scrollbar      | `src/app/globals.css`          | DESIGN.md              | global and table overflow      | computed style and viewport checks     |
| Toast          | `Notice`                       | API contract           | persistent inline status/error | live region tests                      |
| CRUD           | `src/ui/workspace.tsx` and API | API contract           | preview/commit/discard/reverse | browser workflow plus PostgreSQL tests |

Table selection and bulk edits are not offered. No local substitute for these owners is permitted.

## Flows and recovery

Authentication uses verified persisted sessions, as defined in the API contract. Signup displays a neutral check-email result; it never claims an unverified account is signed in. Invalid login remains generic. Password reset clears the token from the URL after reading it, uses no analytics, and asks the user to sign in again after success. Passwords permit paste/autofill and have labelled reveal controls.

The workspace starts with accounts, then imports, then calculations. Navigation remains available in empty/error states. All financial mutations wait for server acknowledgement. Busy actions block duplicate clicks. Uncertain completion explains that a request may have reached the server; reload before repeating account creation or upload. Commit/reversal can safely retry using stable server IDs. No automatic mutation retry.

Import: choose a taxable account, choose an explicit format, select one UTF-8 CSV (10 MiB maximum), then Review file. Preserve the selected file on recoverable failures. A server-saved preview is listed on return and expires after 24 hours. Review every category and show row reasons. Unresolved/unsupported files have no Save transactions action. Conflicts replace the preview with the server's new review and require another click. Discard removes only an uncommitted preview. Saved files can be reversed with a reason and an explicit confirmation naming the scope and effect on calculations. The modal starts focus on Cancel and restores focus on closing. Reimport is the correction workflow.

Calculations require a tax year, a history cutoff, and explicit checkboxes for each account whose full history has been imported. Incomplete coverage remains visible even if the engine has complete matching. Provisional/blocked results cannot be presented as filing ready. No payment or final report action is shown until the corresponding integration is qualified.

Account creation, file selection, calculation fields and reversal reasons are kept only in memory. No secret or financial draft is persisted in local/session storage. Reload may require selecting a local file again, which is stated near the picker. Server previews survive navigation. In-app navigation during a pending mutation is disabled; a beforeunload guard covers uncertain in-flight work. Selected files remain mounted across workspace tabs and navigating away from the workspace is guarded by an explicit leave confirmation.

Tabs and review page state are transient in-memory state in this increment because they reference private, short-lived previews; no shareable data filters are offered. Full import history is loaded with server pagination. Reload recovers persisted drafts through overview.

## Accessibility and locale

Target WCAG 2.2 AA. All forms use noValidate, field-level text errors, labelled controls, valid aria-describedby and first-invalid-field focus. Status regions are polite; errors use role alert. Keyboard focus is visible. Native select popups are accepted. The browser suite verifies 375px layouts, with overflow limited to data regions. Manual 200% browser-zoom qualification remains pending. Reduced motion and forced colours remain usable. Use en-GB copy and numeric formatting; trade dates are date-only UTC, audit timestamps display Europe/London with a zone label.

## Evidence and limits

`tests/ui.spec.ts` covers the new browser flows with controlled API responses, including interrupted requests, pending actions and guarded navigation. These complement the actual auth/PostgreSQL tests; they do not replace hosted end-to-end checks, real mail delivery, native CSV certification or Stripe lifecycle tests. Staging remains explicitly labelled a preview until the release gates in the implementation plan pass.
