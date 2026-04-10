# UK CGT Tracker — Full Product Build Specification

## Product Overview

A UK-focused capital gains tax (CGT) tracking SaaS for self-directed investors. Users upload
transaction history CSVs from any UK broker. The app applies all three HMRC share matching rules
correctly, shows a real-time tax dashboard, alerts users to tax-loss harvesting opportunities, and
exports a self-assessment ready report. Monetised via annual subscription.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript throughout — no JavaScript files
- **Database**: Supabase (Postgres + Auth + Storage)
- **Styling**: Tailwind CSS
- **Payments**: Stripe (annual subscription, £49/yr)
- **AI (CSV parsing)**: Gemini 3.1 Pro (High)
- **Email**: Resend
- **Deployment**: Vercel
- **PDF export**: @react-pdf/renderer

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ANNUAL_PRICE_ID=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

---

## Database Schema (Supabase / Postgres)

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  -- 'trialing' | 'active' | 'canceled' | 'past_due'
  subscription_end_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw transactions (one row per buy/sell/dividend)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'BUY' | 'SELL' | 'DIVIDEND' | 'CORPORATE_ACTION'
  ticker TEXT NOT NULL, -- e.g. 'AAPL', 'LLOY'
  security_name TEXT,
  quantity NUMERIC(20, 8) NOT NULL,
  price_gbp NUMERIC(20, 8) NOT NULL, -- always stored in GBP
  total_gbp NUMERIC(20, 8) NOT NULL, -- quantity * price + fees
  fees_gbp NUMERIC(20, 8) DEFAULT 0,
  original_currency TEXT DEFAULT 'GBP',
  fx_rate NUMERIC(20, 8) DEFAULT 1,
  broker TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CSV upload records
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  broker_detected TEXT,
  row_count INTEGER,
  transactions_imported INTEGER,
  status TEXT DEFAULT 'processing', -- 'processing' | 'complete' | 'error'
  error_message TEXT,
  schema_mapping JSONB, -- cached AI-detected schema
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CGT computations (computed and cached per tax year)
CREATE TABLE cgt_computations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tax_year TEXT NOT NULL, -- e.g. '2024-25'
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  total_proceeds_gbp NUMERIC(20, 8) DEFAULT 0,
  total_allowable_cost_gbp NUMERIC(20, 8) DEFAULT 0,
  total_gain_gbp NUMERIC(20, 8) DEFAULT 0,
  total_loss_gbp NUMERIC(20, 8) DEFAULT 0,
  net_gain_gbp NUMERIC(20, 8) DEFAULT 0,
  annual_exempt_amount_gbp NUMERIC(20, 8) DEFAULT 3000,
  taxable_gain_gbp NUMERIC(20, 8) DEFAULT 0,
  UNIQUE(user_id, tax_year)
);

-- Individual disposal records (output of CGT engine)
CREATE TABLE disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tax_year TEXT NOT NULL,
  date DATE NOT NULL,
  ticker TEXT NOT NULL,
  security_name TEXT,
  quantity NUMERIC(20, 8) NOT NULL,
  proceeds_gbp NUMERIC(20, 8) NOT NULL,
  allowable_cost_gbp NUMERIC(20, 8) NOT NULL,
  gain_gbp NUMERIC(20, 8) NOT NULL, -- negative = loss
  matching_rule TEXT NOT NULL, -- 'SAME_DAY' | 'BED_AND_BREAKFAST' | 'SECTION_104'
  notes TEXT -- e.g. "Matched against 14 Mar 2024 acquisition (30-day rule)"
);

-- Section 104 pools (state per security, updated on each import)
CREATE TABLE section_104_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  total_shares NUMERIC(20, 8) DEFAULT 0,
  total_allowable_cost_gbp NUMERIC(20, 8) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- Email alerts log
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'TAX_LOSS_HARVEST' | 'YEAR_END_REMINDER' | 'ALLOWANCE_WARNING'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
```

---

## Authentication

Use Supabase Auth. Implement:

- Email/password sign up with email confirmation
- Magic link login (passwordless)
- Password reset flow
- Google OAuth (optional, add if time permits)
- Protected routes: all `/dashboard/*` routes require active session
- Middleware in `middleware.ts` that redirects unauthenticated users to `/login`

On first sign up, create a corresponding row in `profiles` via a Supabase trigger or API route.

---

## Subscription & Payments (Stripe)

### Plan
- **Free trial**: 14 days, full access, no card required
- **Paid plan**: £49/year, billed annually

### Stripe Integration
- On checkout: create Stripe customer, redirect to Stripe Checkout with `STRIPE_ANNUAL_PRICE_ID`
- Webhook endpoint at `/api/webhooks/stripe` handles:
  - `checkout.session.completed` → set `subscription_status = 'active'`
  - `invoice.payment_succeeded` → extend `subscription_end_date`
  - `invoice.payment_failed` → set `subscription_status = 'past_due'`, send email
  - `customer.subscription.deleted` → set `subscription_status = 'canceled'`
- Subscription gate: users with `subscription_status` of `canceled` or `past_due`
  AND `trial_end_date` in the past cannot access dashboard — redirect to `/pricing`

### Pricing Page (`/pricing`)
Show a single plan card: £49/year. List of features. "Start free trial" CTA.
Show comparison: "vs £300–800/year to an accountant."

---

## CSV Upload & AI-Powered Schema Detection

### Upload Flow

1. User visits `/dashboard/upload`
2. Drags and drops or selects a CSV file (max 10MB)
3. Frontend reads the file and sends to `/api/upload/detect-schema`
4. API extracts header row + first 15 data rows, sends to Gemini API
5. Gemini returns a JSON schema mapping
6. Frontend shows a preview table of first 10 detected transactions
7. User confirms or manually corrects any fields
8. On confirmation, frontend sends full CSV + confirmed schema to `/api/upload/process`
9. Backend parses all rows, inserts into `transactions`, runs CGT engine
10. User redirected to dashboard

### API Route: `/api/upload/detect-schema` (POST)

Accepts: `{ csvSample: string }` — the header row plus first 15 rows as raw CSV text.

Send this prompt to Gemini API:

```
You are a financial data parser. You will receive the first rows of a CSV export from a
UK stock broker. Analyse the headers and sample rows, then return ONLY valid JSON with no
other text, markdown, or explanation.

Return this exact JSON structure:
{
  "broker_name": "string or null — detected broker name if recognisable",
  "date_column": "exact column header name for transaction date",
  "date_format": "DD/MM/YYYY or YYYY-MM-DD or MM/DD/YYYY or other",
  "type_column": "column header that indicates buy/sell/dividend, or null if inferred from description",
  "type_source": "column" or "description_prefix" or "amount_sign",
  "buy_indicator": "exact string that indicates a buy, e.g. 'BUY' or 'Purchase'",
  "sell_indicator": "exact string that indicates a sell, e.g. 'SELL' or 'Sale'",
  "dividend_indicator": "exact string for dividends, or null",
  "ticker_column": "column for stock ticker/symbol, or null",
  "ticker_from_description": true or false,
  "description_column": "column containing full description text, or null",
  "quantity_column": "column for number of shares, or null",
  "quantity_from_description": true or false,
  "price_column": "column for price per share, or null",
  "price_from_description": true or false,
  "amount_column": "column for total transaction amount",
  "amount_is_split": false or true (true if buys and sells are in separate debit/credit columns),
  "debit_column": "column for money out (buys), if split",
  "credit_column": "column for money in (sells/dividends), if split",
  "fees_column": "column for fees/commission, or null",
  "currency_column": "column for currency, or null",
  "default_currency": "GBP" (assume GBP if not found),
  "notes": "any important observations about this CSV format"
}
```

Cache the returned schema in the `uploads` table `schema_mapping` column, keyed by broker name.
On future uploads from the same detected broker, skip the AI call and reuse cached schema.

### API Route: `/api/upload/process` (POST)

Accepts: `{ uploadId: string, csvContent: string, schema: SchemaMapping }`

Processing logic:

```typescript
function parseCSVWithSchema(csvContent: string, schema: SchemaMapping): RawTransaction[] {
  const rows = parseCSVRows(csvContent) // standard CSV parsing, handle quoted fields
  const transactions: RawTransaction[] = []

  for (const row of rows) {
    // Skip header row and empty rows
    if (isHeaderRow(row) || isEmptyRow(row)) continue

    // Determine transaction type
    let type = detectType(row, schema)
    if (!type) continue // skip unrecognised rows

    // Extract ticker
    let ticker = schema.ticker_column
      ? row[schema.ticker_column]?.trim().toUpperCase()
      : extractTickerFromDescription(row[schema.description_column], schema)

    // Extract quantity — ALWAYS parse as absolute value, type determines direction
    let quantity = Math.abs(parseFloat(
      schema.quantity_column ? row[schema.quantity_column] : extractQtyFromDescription(...)
    ))

    // Extract price per share
    let price = schema.price_column
      ? Math.abs(parseFloat(row[schema.price_column]))
      : null

    // Extract total amount in GBP
    let totalGBP = extractAmount(row, schema) // handles split debit/credit columns

    // Extract fees
    let fees = schema.fees_column ? Math.abs(parseFloat(row[schema.fees_column] || '0')) : 0

    // Parse date
    let date = parseDate(row[schema.date_column], schema.date_format)

    // If price is null but we have total and quantity, derive it
    if (!price && quantity > 0) price = totalGBP / quantity

    // Skip rows with missing critical fields
    if (!date || !ticker || quantity <= 0) continue

    transactions.push({ date, type, ticker, quantity, priceGBP: price, totalGBP, feesGBP: fees })
  }

  return transactions
}
```

After parsing, insert all transactions into the `transactions` table, then trigger the CGT engine.

---

## HMRC CGT Calculation Engine

This is the core of the product. It must be implemented exactly as described.
Run this engine every time new transactions are imported, or when the user requests a recalculation.

### Tax Years

UK tax year runs 6 April to 5 April. Define all supported years:
```typescript
const TAX_YEARS = {
  '2021-22': { start: '2021-04-06', end: '2022-04-05', annualExemption: 12300, basicRate: 0.10, higherRate: 0.20 },
  '2022-23': { start: '2022-04-06', end: '2023-04-05', annualExemption: 12300, basicRate: 0.10, higherRate: 0.20 },
  '2023-24': { start: '2023-04-06', end: '2024-04-05', annualExemption: 6000,  basicRate: 0.10, higherRate: 0.20 },
  '2024-25': { start: '2024-04-06', end: '2025-04-05', annualExemption: 3000,
    rates: [
      { from: '2024-04-06', to: '2024-10-29', basicRate: 0.10, higherRate: 0.20 },
      { from: '2024-10-30', to: '2025-04-05', basicRate: 0.18, higherRate: 0.24 }
      // Rates changed in the October 2024 budget
    ]
  },
  '2025-26': { start: '2025-04-06', end: '2026-04-05', annualExemption: 3000, basicRate: 0.18, higherRate: 0.24 },
}
```

### The Three HMRC Matching Rules

For each SELL transaction, gains must be calculated by matching against acquisitions in this
exact order. Do NOT skip steps.

**Rule 1 — Same-Day Rule**
If the user bought and sold the same security on the same date, match those first.
The acquisition cost for the matched quantity is the actual purchase price on that day.

**Rule 2 — 30-Day Rule (Bed and Breakfast)**
If the user sold a security and then bought the same security again within the following
30 calendar days, match the disposal against those subsequent acquisitions (FIFO order
within the 30-day window). This prevents artificial loss harvesting.

**Rule 3 — Section 104 Pool**
Any remaining unmatched quantity from the disposal is matched against the Section 104 pool.
The allowable cost is: (quantity disposed ÷ total pool shares) × total pool cost.

### Section 104 Pool Maintenance

The pool for each security must be updated in chronological order:
- BUY: add quantity and cost (including fees) to the pool
- SELL matched to pool: reduce pool shares and cost proportionally
- SELL matched to same-day or 30-day: do NOT affect the pool (those are matched separately)

Pool cost per share = totalCost / totalShares (recomputed after every transaction)

### CGT Engine Algorithm

```typescript
async function runCGTEngine(userId: string, taxYear: string): Promise<void> {

  // 1. Fetch all transactions for this user, ALL years, sorted chronologically
  //    (We need full history to maintain the S104 pool correctly)
  const allTransactions = await fetchAllTransactions(userId)

  // 2. Group by ticker
  const byTicker = groupBy(allTransactions, t => t.ticker)

  const allDisposals: Disposal[] = []

  for (const [ticker, txns] of Object.entries(byTicker)) {

    // Sort chronologically
    txns.sort((a, b) => a.date.localeCompare(b.date))

    // Track the S104 pool for this security
    let pool = { shares: 0, totalCost: 0 }

    // Process transactions in date order
    let i = 0
    while (i < txns.length) {
      const txn = txns[i]

      if (txn.type === 'BUY') {
        // Add to S104 pool (unless this buy is within 30 days AFTER a sell —
        // handled when we process the sell)
        pool.shares += txn.quantity
        pool.totalCost += txn.totalGBP // includes fees
        i++
        continue
      }

      if (txn.type === 'SELL') {
        let remainingQty = txn.quantity
        let totalAllowableCost = 0
        const disposalParts: DisposalPart[] = []

        // --- RULE 1: Same-day matching ---
        const sameDayBuys = txns.filter(t =>
          t.type === 'BUY' &&
          t.date === txn.date &&
          t.ticker === ticker &&
          !t.matched
        )
        for (const buy of sameDayBuys) {
          if (remainingQty <= 0) break
          const matchQty = Math.min(remainingQty, buy.quantity)
          const matchCost = (matchQty / buy.quantity) * buy.totalGBP
          remainingQty -= matchQty
          totalAllowableCost += matchCost
          buy.matched = (buy.matched || 0) + matchQty
          disposalParts.push({ qty: matchQty, cost: matchCost, rule: 'SAME_DAY', matchDate: buy.date })
          // Same-day buys do NOT go into the S104 pool
          pool.shares -= matchQty   // reduce pool if it was already added
          pool.totalCost -= matchCost
        }

        // --- RULE 2: 30-day (Bed and Breakfast) matching ---
        const thirtyDayEnd = addDays(txn.date, 30)
        const bbBuys = txns.filter(t =>
          t.type === 'BUY' &&
          t.date > txn.date &&
          t.date <= thirtyDayEnd &&
          t.ticker === ticker &&
          (t.matched || 0) < t.quantity
        ).sort((a, b) => a.date.localeCompare(b.date)) // FIFO within 30-day window

        for (const buy of bbBuys) {
          if (remainingQty <= 0) break
          const availableQty = buy.quantity - (buy.matched || 0)
          const matchQty = Math.min(remainingQty, availableQty)
          const matchCost = (matchQty / buy.quantity) * buy.totalGBP
          remainingQty -= matchQty
          totalAllowableCost += matchCost
          buy.matched = (buy.matched || 0) + matchQty
          disposalParts.push({ qty: matchQty, cost: matchCost, rule: 'BED_AND_BREAKFAST', matchDate: buy.date })
          // B&B buys: remove from S104 pool (they'll be added when we process that buy txn)
          pool.shares -= matchQty
          pool.totalCost -= matchCost
        }

        // --- RULE 3: Section 104 Pool ---
        if (remainingQty > 0 && pool.shares > 0) {
          const matchQty = Math.min(remainingQty, pool.shares)
          const poolCostPerShare = pool.totalCost / pool.shares
          const matchCost = matchQty * poolCostPerShare
          remainingQty -= matchQty
          totalAllowableCost += matchCost
          pool.shares -= matchQty
          pool.totalCost -= matchCost
          disposalParts.push({ qty: matchQty, cost: matchCost, rule: 'SECTION_104' })
        }

        // Calculate proceeds for this disposal
        const proceeds = txn.totalGBP // net of fees already deducted by broker, or add fees here

        // Calculate gain/loss
        const gain = proceeds - totalAllowableCost

        // Only record disposals that fall within the target tax year
        if (isInTaxYear(txn.date, taxYear)) {
          allDisposals.push({
            date: txn.date,
            ticker,
            securityName: txn.securityName,
            quantity: txn.quantity,
            proceedsGBP: proceeds,
            allowableCostGBP: totalAllowableCost,
            gainGBP: gain,
            parts: disposalParts
          })
        }

        i++
        continue
      }

      i++
    }
  }

  // Aggregate for the tax year summary
  const taxYearDisposals = allDisposals.filter(d => isInTaxYear(d.date, taxYear))
  const totalProceeds = sum(taxYearDisposals.map(d => d.proceedsGBP))
  const totalCost = sum(taxYearDisposals.map(d => d.allowableCostGBP))
  const totalGain = sum(taxYearDisposals.filter(d => d.gainGBP > 0).map(d => d.gainGBP))
  const totalLoss = sum(taxYearDisposals.filter(d => d.gainGBP < 0).map(d => Math.abs(d.gainGBP)))
  const netGain = totalGain - totalLoss
  const exemption = TAX_YEARS[taxYear].annualExemption
  const taxableGain = Math.max(0, netGain - exemption)

  // Save to database
  await upsertCGTComputation(userId, taxYear, {
    totalProceeds, totalCost, totalGain, totalLoss, netGain,
    annualExemptAmount: exemption, taxableGain
  })
  await saveDisposals(userId, taxYear, taxYearDisposals)
  await updateSection104Pools(userId, byTicker)
}
```

---

## Pages & UI

### Public Pages

**`/` — Landing page**
- Hero: "Calculate your UK capital gains tax in minutes"
- Sub-headline: "Built for UK self-directed investors. Connects to any broker via CSV. Follows all HMRC rules."
- Three feature highlights: Accurate calculations / Tax-loss harvesting alerts / Self-assessment ready reports
- "How it works" section: 3 steps (Upload → Calculate → Export)
- Testimonial placeholder
- Pricing section: single plan, £49/year, 14-day free trial, no card needed
- FAQ: 5 questions covering accuracy, data security, which brokers, what happens if I have losses, does it cover crypto (answer: no, stocks and ETFs only for now)
- CTA: "Start free trial"

**`/pricing`** — Full pricing page with feature list and Stripe checkout

**`/guide`** — Educational page explaining UK CGT rules in plain English
  - What is CGT
  - The Section 104 pool explained with an example
  - The 30-day rule with an example
  - The annual exempt amount
  - How to report on self-assessment

### Auth Pages

**`/login`** — Email/password login form + magic link option
**`/signup`** — Email/password signup (name, email, password)
**`/forgot-password`** — Request reset email
**`/reset-password`** — New password entry (linked from email)

### Dashboard Pages (all require auth)

**`/dashboard`** — Main dashboard

Sections:
1. **Tax year selector**: Dropdown to switch between tax years (default: current tax year)
2. **Summary cards** (4 cards in a grid):
   - Total gains: £X,XXX
   - Total losses: £X,XXX
   - Annual exemption used: £X,XXX / £3,000
   - Estimated tax owed: £X,XXX
3. **Disposals table**: All sell transactions for the selected tax year, columns:
   Date | Security | Quantity | Proceeds | Allowable Cost | Gain/Loss | Matching Rule
   Colour code: green rows for gains, red rows for losses
4. **Section 104 pool summary**: Current pool for each security held — ticker, shares, total cost, cost per share
5. **Alert banner** (shown conditionally):
   - If within 30 days of 5 April: "Tax year ends in X days — review your positions"
   - If harvestable losses exist: "You have unrealised losses that could offset your gains"
6. **Quick actions**: "Upload transactions" button, "Export report" button

**`/dashboard/upload`** — CSV upload page

Steps rendered as a wizard:
1. Drag and drop file input area (accept .csv only)
2. Processing state: spinner with "Detecting your broker format..."
3. Preview table: shows first 10 parsed transactions with columns auto-detected
4. Confirmation: "We found X transactions. Does this look correct?"
5. If anything looks wrong, show manual field mapping UI where user can reassign columns
6. Confirm button → processing → redirect to dashboard with success toast

**`/dashboard/tax-loss-harvesting`** — Tax-loss harvesting tool

For each security in the user's portfolio:
- Current market value (user enters this manually or we note it is manually updated)
- Purchase cost from S104 pool
- Unrealised gain or loss
- Suggested action if in loss: "Selling this position would realise a £X loss, reducing your taxable gain to £Y"
- 30-day rule warning: show if the user has sold this security in the past 30 days (repurchase would be matched)

Note: We do not pull live market prices in v1 — user enters current prices manually.
Display a clear label: "Enter current price to calculate" with an editable input per row.

**`/dashboard/reports`** — Export page

Options:
1. **CGT Summary Report** (PDF): Tax year summary, list of all disposals, matching rule breakdown, total gain/loss, annual exemption, taxable gain. Formatted for presenting to an accountant or filing reference.
2. **SA108 Reference Sheet** (PDF): The SA108 supplementary page values pre-filled — proceeds, allowable costs, losses, gains. With clear instruction: "Transfer these figures to your HMRC self-assessment SA108 form."
3. **Full transaction export** (CSV): All parsed transactions for audit purposes.

**`/dashboard/settings`** — Account settings

- Update name and email
- Change password
- Subscription status with Stripe customer portal link ("Manage subscription")
- Danger zone: "Delete all my data" (deletes all transactions, disposals, pools)

---

## Email Notifications (via Resend)

Send the following automated emails:

1. **Welcome email** — on signup. Subject: "Welcome to CGT Tracker — here's how to get started". Include link to upload first CSV.

2. **Upload complete** — after processing. Subject: "Your transactions have been imported". Include summary: "X transactions imported. Your current tax position for 2024-25: £X gain."

3. **Trial ending in 3 days** — automated at trial_end_date - 3 days. Subject: "Your free trial ends in 3 days". Include upgrade CTA.

4. **Tax year end reminder** — sent 30 January each year (self-assessment deadline approaching). Subject: "Self-assessment deadline: 31 January — your CGT report is ready". Include export link.

5. **April 5th warning** — sent on 1 April each year. Subject: "5 days until the tax year ends — don't miss your CGT allowance". Include tax-loss harvesting link.

6. **Payment failed** — on Stripe webhook. Subject: "Action required: your CGT Tracker subscription payment failed". Include Stripe billing portal link.

---

## API Routes

All routes return JSON. All `/api/dashboard/*` routes require Supabase session.

```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/reset-password

POST /api/upload/detect-schema     → { schema, preview: Transaction[] }
POST /api/upload/process           → { uploadId, count, status }
GET  /api/uploads                  → Upload[]

GET  /api/dashboard/summary?year=  → CGTComputation
GET  /api/dashboard/disposals?year=→ Disposal[]
GET  /api/dashboard/pools          → Section104Pool[]
GET  /api/dashboard/alerts         → Alert[]

POST /api/cgt/recalculate         → triggers full engine rerun
GET  /api/cgt/harvest?year=       → unrealised positions with gain/loss

GET  /api/reports/pdf?year=&type= → PDF binary download
GET  /api/reports/csv?year=       → CSV download

POST /api/stripe/create-checkout  → { url: string }
POST /api/stripe/create-portal    → { url: string }
POST /api/webhooks/stripe         → handles Stripe events
```

---

## Tax-Loss Harvesting Alert Logic

Run this check after every CGT engine run:

```typescript
function checkHarvestingOpportunities(
  disposals: Disposal[],
  pools: Section104Pool[],
  userPrices: Record<string, number> // manually entered by user
): HarvestAlert[] {

  const alerts: HarvestAlert[] = []
  const currentGain = sum(disposals.filter(d => d.gainGBP > 0).map(d => d.gainGBP))
  const currentLoss = sum(disposals.filter(d => d.gainGBP < 0).map(d => Math.abs(d.gainGBP)))
  const netGain = currentGain - currentLoss
  const exemption = 3000
  const gainAboveExemption = Math.max(0, netGain - exemption)

  for (const pool of pools) {
    const currentPrice = userPrices[pool.ticker]
    if (!currentPrice) continue

    const currentValue = pool.totalShares * currentPrice
    const poolCostPerShare = pool.totalCost / pool.totalShares
    const unrealisedGainLoss = currentValue - pool.totalCost

    if (unrealisedGainLoss < 0 && gainAboveExemption > 0) {
      const taxSaving = Math.min(Math.abs(unrealisedGainLoss), gainAboveExemption) * 0.18 // at basic rate
      alerts.push({
        ticker: pool.ticker,
        shares: pool.totalShares,
        unrealisedLoss: Math.abs(unrealisedGainLoss),
        potentialTaxSaving: taxSaving,
        message: `Selling ${pool.ticker} would realise a £${format(unrealisedGainLoss)} loss,
                  reducing your taxable gain and potentially saving ~£${format(taxSaving)} in tax.`
      })
    }
  }

  return alerts.sort((a, b) => b.potentialTaxSaving - a.potentialTaxSaving)
}
```

---

## Calculation Accuracy Requirements

These are non-negotiable correctness requirements:

1. All monetary values stored as `NUMERIC(20, 8)` — never use JavaScript floats for tax calculations. Use a decimal library (install `decimal.js`) for all arithmetic in the CGT engine.

2. The three matching rules MUST be applied in order: same-day first, then 30-day, then S104. Never skip or reorder.

3. The S104 pool MUST be updated correctly: B&B and same-day matched acquisitions must NOT be included in the pool for the purposes of that disposal. They reduce the pool if already added.

4. All amounts MUST be in GBP. If a transaction is in USD or EUR, store the GBP equivalent. In v1, ask the user to provide their own FX rate if the CSV doesn't include it, or prompt them to enter it manually.

5. Fees and commissions ARE allowable costs. Add them to the cost of acquisitions and deduct them from proceeds on disposals.

6. ISA transactions are NOT subject to CGT. If the user's CSV contains ISA account transactions, filter them out. Add a column or flag to the upload preview: "We detected ISA transactions — these are excluded from CGT calculations."

7. Dividends are NOT capital gains. Import them into the transactions table with type DIVIDEND but exclude them from all CGT calculations. (Future: dividend income tax feature.)

---

## Error Handling

- If CSV parsing fails: show user a friendly error, ask them to check the file, offer manual entry fallback
- If AI schema detection fails (API error): fall back to asking user to manually map columns
- If the S104 pool goes negative (data integrity issue, e.g. missing purchase history): flag the affected security with a warning: "We may be missing some purchase history for [TICKER]. The calculation for this security may be incomplete."
- All database errors: log to console, show user "Something went wrong — your data has not been affected"

---

## Security Requirements

- Never store raw CSV files permanently. Process in memory, then delete. Only store parsed transactions.
- All Supabase queries MUST include `WHERE user_id = auth.uid()` — use Row Level Security (RLS) policies.
- Enable RLS on ALL tables. Example policy:
  ```sql
  CREATE POLICY "Users can only access their own data"
  ON transactions FOR ALL
  USING (user_id = auth.uid());
  ```
- API keys (Anthropic, Stripe) only used server-side, never exposed to client.
- Stripe webhook must verify signature using `STRIPE_WEBHOOK_SECRET`.
- Add disclaimer on all tax output: "This tool provides estimates for guidance only. Always consult a qualified tax advisor before submitting your self-assessment."

---

## UI Design Guidelines

- Clean, minimal, professional — this is a financial tool, not a consumer app
- Colour palette: white backgrounds, dark grey text, green for gains (#16a34a), red for losses (#dc2626), blue for primary actions (#2563eb)
- Font: Inter (loaded via Google Fonts)
- All monetary values formatted as: `£1,234.56` (with comma separator, 2 decimal places)
- Dates formatted as: `15 Mar 2024`
- Tables: sortable by clicking column headers, paginated at 25 rows per page
- Mobile responsive: dashboard works on mobile but upload is desktop-optimised
- Loading states: skeleton loaders for tables, spinner for uploads
- Empty states: friendly illustration + CTA (e.g. "No transactions yet — upload your first CSV")
- Toast notifications: success (green), error (red), info (blue) — 4 second auto-dismiss

---

## V1 Scope Limitations (explicitly out of scope for first build)

Do NOT build these in v1:
- Crypto assets (different HMRC rules, future version)
- Automatic live price feeds (user enters prices manually in harvesting tool)
- Trading 212 API sync (CSV only in v1)
- Dividend income tax calculation (import dividends but don't tax them)
- SEIS/EIS relief calculations
- Non-UK residents or non-GBP base currency portfolios
- Team/family accounts (single user only)
- Mobile app (web only)

---

## Suggested Build Order

1. Auth (signup, login, password reset) + Supabase setup + RLS policies
2. Stripe subscription + pricing page + webhook handler
3. CSV upload UI + AI schema detection + parser
4. CGT engine (core algorithm — test thoroughly with sample data before connecting to UI)
5. Dashboard: summary cards + disposals table
6. S104 pool display
7. Tax-loss harvesting page
8. Reports: PDF export
9. Email notifications
10. Settings page + data deletion
11. Landing page + guide page
12. QA: test with real CSVs from HL, Trading 212, and Freetrade

---

## Test Cases for CGT Engine

Verify the engine produces correct results for these scenarios before launch:

**Test 1 — Simple buy and sell (S104 only)**
- Buy 100 AAPL at £100 each (total cost £10,000) on 1 Jun 2024
- Sell 50 AAPL at £120 each (proceeds £6,000) on 1 Sep 2024
- Expected: allowable cost = £5,000 (50% of pool), gain = £1,000
- S104 pool after: 50 shares, £5,000 cost

**Test 2 — 30-day rule triggered**
- Buy 100 AAPL at £100 (£10,000) on 1 Jun 2024
- Sell 100 AAPL at £80 (£8,000) on 1 Sep 2024 (would be a £2,000 loss)
- Buy 100 AAPL at £85 (£8,500) on 15 Sep 2024 (within 30 days of sell)
- Expected: disposal matched to the 15 Sep buy (30-day rule), allowable cost = £8,500, loss = £500
- The Jun buy goes into S104 pool, the Sep buy does NOT go into S104 pool

**Test 3 — Same-day rule**
- Buy 50 LLOY at 50p (£250) on 10 Oct 2024
- Sell 50 LLOY at 55p (£275) on 10 Oct 2024 (same day)
- Expected: matched as same-day, gain = £25. Neither transaction affects S104 pool.

**Test 4 — Mixed matching**
- Existing S104 pool: 200 TSCO shares, total cost £400
- Buy 50 TSCO at £3.00 (£150) on 5 Apr 2025
- Sell 100 TSCO at £3.50 (£350) on 5 Apr 2025 (same day as buy)
- Expected: 50 shares matched same-day (cost £150, proceeds £175, gain £25)
  Remaining 50 shares matched from S104 pool (cost = 50/200 × £400 = £100, proceeds £175, gain £75)
  Total gain: £100

**Test 5 — Losses carried forward**
Present this correctly in the UI but do not auto-apply prior year losses — show them as a figure
the user needs to manually enter into their self-assessment.