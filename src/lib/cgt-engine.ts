import Decimal from 'decimal.js'
import { addDays, isAfter, isBefore, isEqual, parseISO } from 'date-fns'

export const TAX_YEARS: Record<string, { start: string; end: string; annualExemption: number; basicRate: number; higherRate: number; rates?: { from: string; to: string; basicRate: number; higherRate: number }[] }> = {
  '2021-22': { start: '2021-04-06', end: '2022-04-05', annualExemption: 12300, basicRate: 0.10, higherRate: 0.20 },
  '2022-23': { start: '2022-04-06', end: '2023-04-05', annualExemption: 12300, basicRate: 0.10, higherRate: 0.20 },
  '2023-24': { start: '2023-04-06', end: '2024-04-05', annualExemption: 6000, basicRate: 0.10, higherRate: 0.20 },
  '2024-25': {
    start: '2024-04-06',
    end: '2025-04-05',
    annualExemption: 3000,
    basicRate: 0.18, higherRate: 0.24, // simplified default for year
    rates: [
      { from: '2024-04-06', to: '2024-10-29', basicRate: 0.10, higherRate: 0.20 },
      { from: '2024-10-30', to: '2025-04-05', basicRate: 0.18, higherRate: 0.24 }
    ]
  },
  '2025-26': { start: '2025-04-06', end: '2026-04-05', annualExemption: 3000, basicRate: 0.18, higherRate: 0.24 },
}

export function isInTaxYear(dateString: string, taxYear: string): boolean {
  if (!TAX_YEARS[taxYear]) return false
  const date = parseISO(dateString)
  const start = parseISO(TAX_YEARS[taxYear].start)
  const end = parseISO(TAX_YEARS[taxYear].end)
  return (isAfter(date, start) || isEqual(date, start)) && (isBefore(date, end) || isEqual(date, end))
}

export function groupBy<T, K extends string | number | symbol>(array: T[], keyGetter: (item: T) => K): Record<K, T[]> {
  return array.reduce((result, currentItem) => {
    const key = keyGetter(currentItem)
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(currentItem)
    return result
  }, {} as Record<K, T[]>)
}

export interface RawTransaction {
  id?: string
  date: string
  type: string
  ticker: string
  securityName?: string | null
  quantity: number
  priceGBP: number
  totalGBP: number
  feesGBP: number
  matched?: number // internal tracking
  originalCurrency?: string
  fxRate?: number
}

export interface DisposalPart {
  qty: number
  cost: number
  rule: 'SAME_DAY' | 'BED_AND_BREAKFAST' | 'SECTION_104'
  matchDate?: string
  notes?: string
}

export interface Disposal {
  date: string
  ticker: string
  securityName?: string | null
  quantity: number
  proceedsGBP: number
  allowableCostGBP: number
  gainGBP: number
  parts: DisposalPart[]
}

export interface Section104Pool {
  ticker: string
  shares: number
  totalCost: number
}

// Ensure accurate decimal mathematics
export function runCGTEngineCalculations(allTransactions: RawTransaction[], taxYear: string) {
  const byTicker = groupBy(allTransactions, t => t.ticker)
  const allDisposals: Disposal[] = []
  const poolsByTicker: Record<string, Section104Pool> = {}

  for (const [ticker, txns] of Object.entries(byTicker)) {
    // Bug 2/3: Strict Chronological Sort using numeric epoch
    txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let pool = { shares: new Decimal(0), totalCost: new Decimal(0) }

    let i = 0
    while (i < txns.length) {
      const txn = txns[i]

      // Exclude Dividends or Corporate Actions for now
      if (txn.type === 'DIVIDEND' || txn.type === 'CORPORATE_ACTION') {
        i++
        continue
      }

      if (txn.type === 'BUY') {
        // Bug 3: Ignore buys that were already consumed by a prior B&B matcher
        const unmatchedQty = new Decimal(txn.quantity).minus(txn.matched || 0)
        if (unmatchedQty.gt(0)) {
          // Bug 5: Include incidental broker fees in the allowable cost formulation
          const totalCostIncFees = new Decimal(txn.totalGBP).plus(txn.feesGBP || 0)
          const unmatchedCost = unmatchedQty.div(txn.quantity).times(totalCostIncFees)
          
          pool.shares = pool.shares.plus(unmatchedQty)
          pool.totalCost = pool.totalCost.plus(unmatchedCost)
        }
        i++
        continue
      }

      if (txn.type === 'SELL') {
        try {
          let remainingQty = new Decimal(txn.quantity)
          let totalAllowableCost = new Decimal(0)
          const disposalParts: DisposalPart[] = []

          // --- RULE 1: Same-day matching ---
          const sameDayBuys = txns.filter(t => {
            const isMatch = t.type === 'BUY' && t.date === txn.date && t.ticker === ticker && !(t.matched && new Decimal(t.matched).gte(t.quantity))
            return isMatch
          })
          
          if (sameDayBuys.length > 0) console.log(`[Diagnostic] Found ${sameDayBuys.length} SAME_DAY buys for SELL on ${txn.date} [Qty: ${txn.quantity}]`)

          for (const buy of sameDayBuys) {
            if (remainingQty.lte(0)) break
            const availableBuyQty = new Decimal(buy.quantity).minus(buy.matched || 0)
            const matchQty = Decimal.min(remainingQty, availableBuyQty)
            const matchCost = matchQty.div(buy.quantity).times(new Decimal(buy.totalGBP).plus(buy.feesGBP || 0))
            remainingQty = remainingQty.minus(matchQty)
            totalAllowableCost = totalAllowableCost.plus(matchCost)
            buy.matched = (buy.matched || 0) + matchQty.toNumber()
            disposalParts.push({ qty: matchQty.toNumber(), cost: matchCost.toNumber(), rule: 'SAME_DAY', matchDate: buy.date })
            
            console.log(`[Diagnostic] MATCHED SAME_DAY: matchQty ${matchQty.toNumber()} | matchedCost £${matchCost.toNumber()} | Remaining: ${remainingQty.toNumber()}`)

            // Reverse out of S104 pool ONLY IF this buy happened BEFORE the sell in our sorted array
            const buyIndex = txns.indexOf(buy)
            if (buyIndex < i) {
              pool.shares = pool.shares.minus(matchQty)
              pool.totalCost = pool.totalCost.minus(matchCost)
            }
          }

          // --- RULE 2: 30-day matching ---
          const txnDateParsed = parseISO(txn.date)
          const thirtyDayEnd = addDays(txnDateParsed, 30)
          const bbBuys = txns.filter(t => {
            if (t.type !== 'BUY' || t.ticker !== ticker) return false
            const tDate = parseISO(t.date)
            const isEligible = isAfter(tDate, txnDateParsed) && (isBefore(tDate, thirtyDayEnd) || isEqual(tDate, thirtyDayEnd)) && !(t.matched && new Decimal(t.matched).gte(t.quantity))
            return isEligible
          }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

          if (bbBuys.length > 0) console.log(`[Diagnostic] Found ${bbBuys.length} BB buys for SELL on ${txn.date} [Qty: ${txn.quantity}] between ${txn.date} and ${thirtyDayEnd.toISOString()}`)

          for (const buy of bbBuys) {
            if (remainingQty.lte(0)) break
            const availableQty = new Decimal(buy.quantity).minus(buy.matched || 0)
            const matchQty = Decimal.min(remainingQty, availableQty)
            const matchCost = matchQty.div(buy.quantity).times(new Decimal(buy.totalGBP).plus(buy.feesGBP || 0))
            remainingQty = remainingQty.minus(matchQty)
            totalAllowableCost = totalAllowableCost.plus(matchCost)
            buy.matched = (buy.matched || 0) + matchQty.toNumber()
            
            console.log(`[Diagnostic] MATCHED BB_BUY: matchQty ${matchQty.toNumber()} | matchedCost £${matchCost.toNumber()} | Remaining: ${remainingQty.toNumber()}`)
            disposalParts.push({ qty: matchQty.toNumber(), cost: matchCost.toNumber(), rule: 'BED_AND_BREAKFAST', matchDate: buy.date, notes: `Matched future 30-day buy` })
          }

          // --- RULE 3: Section 104 Pool ---
          if (remainingQty.gt(0) && pool.shares.gt(0)) {
            // If total shares < remainingQty, something is wrong with data (sold more than owned)
            // We match whatever is available in the pool
            const matchQty = Decimal.min(remainingQty, pool.shares)
            const poolCostPerShare = pool.totalCost.div(pool.shares)
            const matchCost = matchQty.times(poolCostPerShare)
            remainingQty = remainingQty.minus(matchQty)
            totalAllowableCost = totalAllowableCost.plus(matchCost)
            pool.shares = pool.shares.minus(matchQty)
            pool.totalCost = pool.totalCost.minus(matchCost)
            disposalParts.push({ qty: matchQty.toNumber(), cost: matchCost.toNumber(), rule: 'SECTION_104' })
          }
          
          // Bug 4: Warning if selling shares without pool existence
          if (remainingQty.gt(0)) {
             disposalParts.push({
               qty: remainingQty.toNumber(),
               cost: 0,
               rule: 'SECTION_104',
               notes: `Warning: No acquisition history found prior to this disposal date. Outputting £0.00 allowable cost. Check your full transaction history is imported.`
             })
          }

          // Bug 5: Net proceeds should deduct incidental disposal fees
          const proceeds = Decimal.max(0, new Decimal(txn.totalGBP).minus(txn.feesGBP || 0))
          const gain = proceeds.minus(totalAllowableCost)

          if (isInTaxYear(txn.date, taxYear)) {
            allDisposals.push({
              date: txn.date,
              ticker,
              securityName: txn.securityName,
              quantity: txn.quantity,
              proceedsGBP: Number(proceeds.toFixed(2)),
              allowableCostGBP: Number(totalAllowableCost.toFixed(2)),
              gainGBP: Number(gain.toFixed(2)),
              parts: disposalParts
            })
          }
        } catch (err: any) {
           console.error(`CGT Engine Error (Bug 2 caught): Failed processing SELL transaction for ${ticker} on ${txn.date}.`, err.message)
        }
        i++
        continue
      }
      i++
    }

    poolsByTicker[ticker] = {
      ticker,
      shares: pool.shares.toNumber(),
      totalCost: Number(pool.totalCost.toFixed(2))
    }
  }

  // Combine results
  const taxYearDisposals = allDisposals.filter(d => isInTaxYear(d.date, taxYear))
  const totalProceeds = taxYearDisposals.reduce((sum, d) => sum.plus(d.proceedsGBP), new Decimal(0))
  const totalCost = taxYearDisposals.reduce((sum, d) => sum.plus(d.allowableCostGBP), new Decimal(0))
  const totalGain = taxYearDisposals.filter(d => d.gainGBP > 0).reduce((sum, d) => sum.plus(d.gainGBP), new Decimal(0))
  const totalLoss = taxYearDisposals.filter(d => d.gainGBP < 0).reduce((sum, d) => sum.plus(Math.abs(d.gainGBP)), new Decimal(0))
  const netGain = totalGain.minus(totalLoss)
  const exemption = new Decimal(TAX_YEARS[taxYear].annualExemption)
  const taxableGain = Decimal.max(0, netGain.minus(exemption))

  return {
    disposals: taxYearDisposals,
    pools: Object.values(poolsByTicker).filter(p => Math.abs(p.shares) > 0.00000001), // return pools with valid shares
    summary: {
      totalProceeds: Number(totalProceeds.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalGain: Number(totalGain.toFixed(2)),
      totalLoss: Number(totalLoss.toFixed(2)),
      netGain: Number(netGain.toFixed(2)),
      annualExemptAmount: Number(exemption.toFixed(2)),
      taxableGain: Number(taxableGain.toFixed(2))
    }
  }
}

