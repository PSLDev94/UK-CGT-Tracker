---
version: alpha
name: CGT Tracker
description: A clear working ledger for UK investors checking share gains across brokers.
colors:
  ink: "#192630"
  primary: "#2563eb"
  background: "#f8f9f8"
  surface: "#ffffff"
  muted: "#425460"
  border: "#c5cdd2"
  control-border: "#76858c"
  paper: "#f3f1eb"
  sheet: "#edf1f2"
  charcoal: "#182127"
  on-charcoal: "#f4f5f2"
  on-charcoal-muted: "#b8c1c6"
  on-charcoal-link: "#b7ceff"
  logo-light: "#afc9ff"
  charcoal-rule: "#4c575d"
  danger: "#a12d2b"
  warning: "#805300"
typography:
  sans:
    fontFamily: '"Inter Variable", ui-sans-serif, system-ui, sans-serif'
  display:
    fontFamily: '"Inter Variable", system-ui, sans-serif'
  body:
    fontFamily: '"Inter Variable", system-ui, sans-serif'
  statement:
    fontFamily: '"STIX Two Text", Georgia, serif'
  mono:
    fontFamily: 'ui-monospace, "SFMono-Regular", monospace'
rounded:
  control: "0.25rem"
  panel: "0"
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

The original blue pie-chart mark and CGT Tracker wordmark identify every part of the service. The approved Trade records homepage and Annual statement report establish the design across discovery, account access, the workspace and print.

## Colors

Charcoal anchors navigation. Ink on paper is the default for public reading pages. The workspace uses white working surfaces, pale statement sections and fine grey rules between records. Blue identifies interactive controls. Amounts carry a sign or a gain/loss label. Warnings and errors include an explanation and a recovery action where available.

## Typography

Self-hosted Inter sets navigation, public task titles, form labels and body copy. STIX Two Text gives statements, section titles and financial totals a clear hierarchy. Figures align with tabular numerals. Reference numbers and dates may use monospace. Financial arithmetic is independent of its typographic treatment.

## Layout

The homepage pairs an investor’s question with dated trade records. Guides give text a comfortable reading measure. Interactive tools place inputs together with their assumptions and results. Within the workspace, a shared navigation rail becomes a menu on small screens. Records, balances and their source documents stay connected across screen sizes.

## Elevation & Depth

Use surface changes and rules to distinguish sections. Elevation is reserved for floating controls such as an open navigation menu.

## Homepage and reports

The Trade records homepage opens on the Tesla sale and its 30-day repurchase. Selecting Apple or Lloyds changes the dates, monetary figures and link to the corresponding source records. The public sample, the report screen and the PDFs use the same calculation data for their respective portfolios.

Annual statements use serif headings and a prominent annual result, fine rules and right-aligned amounts. On screen the statement typeface is the locally licensed STIX Two Text. Original blue identifies the brand and actions. Printable reports retain their source records, scope and filing guidance.

## Shapes

Use compact corners on controls and squared edges on financial statements and tables. Keep form fields outlined, large enough for touch, and visibly focused.

## Components

`src/components/public-nav.tsx`, `public-footer.tsx` and `dashboard-sidebar.tsx` own navigation. `src/ui/primitives.tsx` owns validated fields, notices and buttons used by the rebuilt workflow. Recovered educational calculators retain native date/select controls; financial history dates remain explicitly typed YYYY-MM-DD. Mobile disclosures have labelled buttons and Escape support. No financial information is written to browser storage.

Token ownership remains Model B: globals.css is canonical for named workflow tokens mirrored in frontmatter. Scoped style modules implement each page family. Shared control styles and the runtime tokens provide the common foundation. The project check verifies all explicit named runtime tokens, including the Tailwind font adapter.

## Do's and Don'ts

- Use Trade records for public navigation and discovery, and Annual statement for records, calculations and reports.
- Preserve every original page URL and product navigation entry.
- Amend unverified broker, trial, tax-report and security claims to the actual current behaviour.
- Retain auth verification, decimal calculations, all-or-nothing import validation and audit history.
- Label unavailable filing exports and permanent deletion honestly; never restore unsafe retired APIs to make a control appear functional.
