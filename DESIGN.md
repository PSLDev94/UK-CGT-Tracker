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

The user explicitly requested restoration of the original website and every original page, including logos, and specified that all new functionality must follow that original UI/UX. Git revision `9ded8c0` is the visual source of truth. The November redesign is superseded. Restore original source markup, layouts, blue pie-chart branding, public navigation/footer, guides, tools, pricing and dashboard. Preserve rebuilt business rules, authentication, strict import review and sandbox Stripe integration.

## Colors

Original Tailwind blue/white/gray palette with green/red financial values. Public gradient sections, coloured guide callouts and original broker initial tiles are intentional user-authorised original design. Do not replace them with a new aesthetic.

## Typography

Inter, as on the original site, is self-hosted through Fontsource. Original Tailwind text sizes, weights and spacing remain canonical. New forms and pages inherit Inter and the original visual hierarchy. Financial arithmetic uses Decimal and renders decimal strings.

## Layout

Original centred landing-page hero, dashboard illustration, feature grids and footer. Original 16rem desktop sidebar and narrow-screen menu. Dashboard content uses white bordered cards on gray-50; new account and import review screens use the same controls and card language. Document scrolling with labelled horizontal table regions.

## Elevation & Depth

Retain original shadows, gradients and borders. New screens use matching small card shadows.

## Staging design study

The three review views under `/design-preview` share the public sample portfolio. The homepage introduces one sale, Calculations opens its matching and source records, and the A4 statement presents the year followed by the evidence. The original pie mark, Inter web typography and blue actions tie the views together. At phone widths, group the asset, signed result and rule before the optional cost breakdown. These layouts are awaiting review for broader use.

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
