# Original UI restoration — 17 November 2026

The user requested the original CGT Tracker UI, including logos and all pages, with new functionality following the same UI/UX. Source revision: `9ded8c0`. This supersedes the November redesign.

## Recovered surface

All 24 original page paths are present: home, pricing, contact; login/signup/password recovery/reset; guide index and seven articles; three free calculators; dashboard overview, upload, reports, settings, tax-loss harvesting and contact. Additional account, import-history, broker-support and billing screens retain the rebuilt functionality with original Inter, blue/white/gray styling and sidebar/card/control patterns. `/workspace` and `/account/*` remain compatible entry points.

The original logo.svg, og-image.png, icon.svg and favicon.ico are byte-identical to source. Public page sections, original pie-chart branding, broker initial tiles, navigation/footer, guide layout and calculator layouts were recovered from source. The old signup testimonial was replaced with factual product copy inside the same panel because its provenance and filing-ready claims were not established. Red/green text, small gray text and inline links received accessibility fixes without changing their layout.

## Functional adaptations

- Retain verified authentication, strict row review, unresolved-import blocking, account coverage, audit history, reversal confirmation and sandbox Stripe flow. No retired Supabase or permissive parser API is restored.
- Dashboard: four result cards, disposal evidence and Section 104 pool table, backed by the current calculation result. Allowable costs replaces the old allowance-used card because this engine calculates share gains, not final personal tax liabilities.
- Settings: authenticated profile and password changes, validation, pending state and failure recovery. Permanent data deletion remains disabled pending retention/billing qualification.
- Reports: download saved disposal/matching evidence as escaped CSV marked preview; PDF/SA108 exports remain explicitly in qualification.
- Harvesting: manually entered price scenarios against saved historical complete pools; no unsupported current-holdings, trading or tax-saving claims.
- Contact: validated email-draft composition, explicitly requiring the user to send from their email application. No false delivery confirmation.
- Free tools: Decimal arithmetic, bounded values, no silently capped oversells, basic-rate-band split, same-day distinction. They remain educational illustrations, separate from the portfolio engine.
- Public copy reflects limited Trading 212/Freetrade ordinary-share GBP qualification, four brokers still pending and sandbox-only payments.

## Financial source corrections

The old SA108 article assigned residential-property box numbers to listed shares. It now identifies the listed-share section for the 2025–26 form and links to HMRC's year-specific form and notes. The old £12,000 reporting threshold was replaced with HMRC's £50,000 threshold for Self Assessment registrants for 2023–24 onwards. Old broker-conversion, instant-filing and automatic-alert claims were corrected.

Sources checked 17 November 2026:

- https://www.gov.uk/government/publications/self-assessment-capital-gains-summary-sa108
- https://assets.publishing.service.gov.uk/media/69bd8990cfa346b9d47049e4/SA108-2026.pdf
- https://www.gov.uk/capital-gains-tax/work-out-need-to-pay
- https://www.gov.uk/capital-gains-tax/rates
- https://www.gov.uk/government/publications/shares-and-capital-gains-tax-hs284-self-assessment-helpsheet/hs284-shares-and-capital-gains-tax-2026

## Verification

Core suite: 203 passing tests. Browser suite expands the existing import/billing/auth coverage to restored public routes, mobile accessibility, calculator boundaries, saved-evidence download, settings failure recovery and keyboard focus. Build, TypeScript, lint, design-token parity, DESIGN.md schema and strict premium audit are required before deployment. Browser mocks verify UI behaviour, not live account delivery or independent tax certification.

Original guide accent borders and gradients are preserved as specifically requested original design. No blanket hook suppression is introduced. Production DNS, live payments, final filing exports and the broader relaunch gates remain outside this staging UI release.
