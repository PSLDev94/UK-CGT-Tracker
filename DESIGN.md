---
version: alpha
name: CGT Tracker
description: A clear working ledger for UK investors checking share gains across brokers.
colors:
  ink: "#111827"
  primary: "#2563eb"
  background: "#f9fafb"
  surface: "#ffffff"
  muted: "#4b5563"
  border: "#e5e7eb"
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
  control: "0.5rem"
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

Git revision `9ded8c0` supplies the original pie-chart mark, wordmark and application branding. The approved Trade records homepage and Annual statement report treatments apply to those specific surfaces. The guides, tools, pricing, account and dashboard retain their original navigation and visual conventions.

## Colors

Original Tailwind blue/white/gray palette with green/red financial values. Public gradient sections, coloured guide callouts and original broker initial tiles are intentional user-authorised original design. Do not replace them with a new aesthetic.

## Typography

Inter, as on the original site, is self-hosted through Fontsource. Original Tailwind text sizes, weights and spacing remain canonical. New forms and pages inherit Inter and the original visual hierarchy. Financial arithmetic uses Decimal and renders decimal strings.

## Layout

The homepage opens with a charcoal field pairing the investor’s question with an interactive sale and its dated source records. Original 16rem desktop sidebar and narrow-screen menu. Dashboard content uses white bordered cards on gray-50; new account and import review screens use the same controls and card language. Document scrolling with labelled horizontal table regions.

## Elevation & Depth

Retain original shadows, gradients and borders. New screens use matching small card shadows.

## Homepage and reports

The Trade records homepage opens on the Tesla sale and its 30-day repurchase. Selecting Apple or Lloyds changes the dates, monetary figures and link to the corresponding source records. The public sample, the report screen and the PDFs use the same calculation data for their respective portfolios.

Annual statements use serif headings and a prominent annual result, fine rules and right-aligned amounts. On screen the statement typeface is the locally licensed STIX Two Text. Original blue identifies the brand and actions. Printable reports retain their source records, scope and filing guidance.

## Shapes

Original rounded-md/lg/xl controls and panels. Shared workflow controls use the mirrored runtime radii.

## Components

`src/components/public-nav.tsx`, `public-footer.tsx` and `dashboard-sidebar.tsx` own navigation. `src/ui/primitives.tsx` owns validated fields, notices and buttons used by the rebuilt workflow. Recovered educational calculators retain native date/select controls; financial history dates remain explicitly typed YYYY-MM-DD. Mobile disclosures have labelled buttons and Escape support. No financial information is written to browser storage.

Token ownership remains Model B: globals.css is canonical for named workflow tokens mirrored in frontmatter. Original Tailwind v4 utilities remain canonical for recovered page styling and override the components layer. The project check verifies all explicit named runtime tokens, including the Tailwind font adapter.

## Do's and Don'ts

- Match new screens to the original site, never introduce a parallel design language.
- Preserve every original page URL and product navigation entry.
- Amend unverified broker, trial, tax-report and security claims to the actual current behaviour.
- Retain auth verification, decimal calculations, all-or-nothing import validation and audit history.
- Label unavailable filing exports and permanent deletion honestly; never restore unsafe retired APIs to make a control appear functional.
