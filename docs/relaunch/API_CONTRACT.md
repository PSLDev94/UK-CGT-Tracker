# Fresh application API contract

This contract describes implemented backend behaviour. It does not imply deployment, browser qualification, native broker certification or filing-ready reports.

## Authentication

Better Auth endpoints are mounted under `/api/v2/auth`. Passwords require 12–128 characters. Verification is required before financial access. Reset links expire after 30 minutes and revoke existing sessions when used; verification links expire after one hour. Sessions are persisted, with cookie caching disabled so revocation takes immediate effect. Production cookies are Secure, HttpOnly and SameSite=Lax.

POSTs require the configured origin. Callback/reset URLs are restricted to that origin. Authentication request bodies are capped at 32 KiB. Login, signup, resend and reset endpoints have database-backed rate limits. The configured client-IP header must be proved to be overwritten by the trusted hosting ingress before deployment; accepting a client-supplied header would undermine these limits.

Self-service email changes and account deletion are disabled pending verified billing-ownership and retention workflows. Financial records reference auth users, preventing orphaned records. Existing Stripe customer ownership must be reconciled separately; an email address alone is not a paid entitlement.

## Workspace actions

`POST /api/v2/workspace`, JSON body, verified session cookie and matching Origin. Responses use `Cache-Control: private, no-store`. Owner identifiers, accepted counts and posted preview contents are never trusted.

| `action` | Other fields | Result |
| --- | --- | --- |
| `overview` | None | One shared personal portfolio, accounts, latest 100 imports, current calculations and active previews. First visit creates the portfolio. Use `import-history` for full receipt navigation. |
| `import-history` | `page` (1-based) | All owned import receipts, 25 per page, with total count and stable created-time/ID order. |
| `add-account` | `portfolioId`, `broker`, `accountType: GIA`, `label` | Adds a taxable account, advances revision and invalidates calculations. Maximum 50 accounts. |
| `prepare-import` | `accountId`, `format: native or canonical-v1`, `csv`, optional boolean `ordinarySharesConfirmed` | Stores a 24-hour preview and returns `draftId`, server-bound `accountId`, `revision`, counts, issues and first 100 records. Maximum five active drafts per user. |
| `review-import` | `draftId`, `page` (1-based) | Re-parses server evidence against current records and returns the draft’s server-bound `accountId` and 100-record pages. Total counts are always supplied; issues are bounded to 100 with `issueCount`. |
| `discard-draft` | `draftId` | Removes an uncommitted preview. Saved transactions are untouched. |
| `commit-import` | `draftId`, `revision` | Revalidates under a portfolio lock. Returns `committed`, `already_committed`, `review_changed` or `needs_review`. The latter two use HTTP 409; show the new preview (including its server-bound `accountId`) and require another confirmation. Never label the preview using the current upload form selection. |
| `reverse-import` | `importId`, `reason` | Deactivates that import's transactions, retains its receipt/history and invalidates calculations. Idempotent. |
| `calculate` | `portfolioId`, `taxYear`, `historyThrough`, `confirmedAccountIds` | Reads all active trades through the date, creates an immutable calculation run and atomically updates the current pointer. Existing pending previews block calculation. |

The request body is capped at 12 MiB and each CSV at 10 MiB. Strict UTF-8 decoding is enforced at the HTTP boundary. Review handles at most 100,000 records. Two exact native GBP variants have limited preview readers; others return `unsupported`. Native ordinary-share confirmation defaults to false, is persisted in the draft and is rechecked at commit. No columns, currencies or identifiers are inferred. All rows must be accounted for before commit. Quantity/converted amounts are checked against storage precision, pre-1982 transactions require specialist handling and server-side reviews reject future execution dates.

Unverified, expired or missing sessions fail before financial work. Cross-owner IDs produce a generic unavailable response. Unknown server failures return only a support reference; logs omit raw exceptions, SQL parameters, email links and CSV records. Shared PostgreSQL limits allow 60 general requests/minute and ten upload/review/commit or calculation requests/minute per user.

## Completeness and corrections

`coverageConfirmed` requires explicit confirmation of every account currently in the portfolio. It is a customer attestation, not proof of correct account coverage. Engine `complete` means the declared history covers the tax-year look-ahead and the engine found no missing acquisitions; it is not tax advice, a tax-liability calculation, or permission to market a filing-ready report. No paid report download is exposed; the separate sandbox billing API is documented in BILLING.md.

Changed source IDs never overwrite trades. Correct a committed file by reversing it with a reason, preparing the corrected file, reviewing it and recalculating. Active-record uniqueness permits reimport after reversal while preserving historical evidence. The new browser flow presents a reason field and explicit reversal confirmation, initially focusing Cancel.
