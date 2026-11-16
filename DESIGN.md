---
version: alpha
name: CGT Tracker
description: A clear working ledger for UK investors checking share gains across brokers.
colors:
  ink: "#15324b"
  primary: "#006c67"
  background: "#f2f6f7"
  surface: "#ffffff"
  muted: "#506574"
  border: "#c7d4da"
  danger: "#a12d2b"
  warning: "#805300"
typography:
  display:
    fontFamily: '"Trebuchet MS", system-ui, sans-serif'
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
  mono:
    fontFamily: 'ui-monospace, "SFMono-Regular", monospace'
rounded:
  control: "0.375rem"
  panel: "0.75rem"
spacing:
  unit: "0.5rem"
  page-max: "76rem"
components:
  button: {}
  field: {}
  notice: {}
  ledger: {}
---

# CGT Tracker design

## Overview

The reference is an investor's reconciliation workbook: every source row has a disposition and every gain has a visible route back to acquisitions. UK individual investors compare multiple taxable broker accounts, usually on a laptop but with usable phone access. The single supported UI locale is en-GB. Japan-market rules are not applicable.

The public home explains the workflow; the workspace is a product surface. Its signature is the reconciliation strip: included, excluded, duplicate and unresolved counts always sum to the source record count. No decorative investment-performance chart or invented savings total.

The user authorised a fresh interface. The old gradient marketing site and Supabase screens are retired from active routing, recoverable at Git commit 9ded8c0. The new system prioritises readable evidence, rather than retaining obsolete marketing claims.

Token ownership is Model B: `src/app/globals.css` is canonical; this document mirrors its named tokens. `colors.X` maps directly to `--color-X`, typography roles to `--font-X`, rounded roles to `--radius-X`, and spacing roles to `--space-X`. Shared primitives consume these variables. `npm run check:design` verifies the mirrored runtime values in CI. No duplicated framework theme layer.

## Colors

Blue ink and deep teal identify navigation/actions on cool white surfaces. Danger and warning always accompany text. Light theme only for this increment; system forced-colours remain operable. Focus uses a visible primary outline with an offset. Pale backgrounds never replace a text status.

## Typography

Trebuchet display headings provide rounded, open forms without downloading fonts or leaking page requests to a font provider. Arial body text remains familiar and readable. Monospace is reserved for source record numbers, identifiers and financial evidence; tabular numerals align amounts. Body 16px/1.55; headings use a restrained 1.2 line height.

## Layout

Public content has a 76rem maximum width. The workspace uses a 14rem navigation rail and a flexible ledger; below 800px navigation becomes a wrapping row. Forms are single-column at narrow widths. Tables scroll horizontally inside their own labelled region, while page height has one main scroll owner. Comfortable rows and persistent labels support seasonal users, without a density toggle.

## Elevation & Depth

Borders and background changes establish hierarchy. Static panels have no floating shadows. A modal confirmation, when present, uses the browser dialog's modal layer and a darkened backdrop. No sticky element may cover the keyboard focus target.

## Shapes

Controls use the control radius; panels use the panel radius. Status labels have small square-rounded corners, not button styling. No pill-based navigation or ornament unrelated to reconciliation.

## Components

Shared `Button`, `Field`, `SelectField`, `Notice` and `PasswordField` live in `src/ui/primitives.tsx`. Disabled actions explain the condition nearby. Busy labels occupy stable button geometry. Server error messages persist until corrected or retried. Success uses an inline status region, not disappearing toast-only feedback.

Native select popups are intentional: the OS owns geometry and keyboard handling. History dates use a typed YYYY-MM-DD input, with explicit examples and validation. No custom calendar is implied. Tables use captions, headers, text statuses and record-level reasons. Empty states offer the next available action. Lucide icons, if used, are decorative beside labels; text actions remain primary.

Motion is limited to subtle colour feedback; reduced-motion disables transitions. Copy names actual actions: Review file, Save transactions, Reverse import, Calculate gains. Monetary strings retain decimal precision; display formatting never converts financial arithmetic to binary floating point. Engine completion is labelled separately from account coverage and filing readiness.

## Do's and Don'ts

- Show the source row counts and unresolved reasons before saving.
- Preserve safe form input when requests fail and require fresh review after conflicts.
- Never advertise unverified native broker formats, HMRC approval or a filing-ready report.
- Never put raw CSVs, passwords, tokens or financial data in browser storage or analytics.
