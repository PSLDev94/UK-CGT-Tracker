import type Decimal from 'decimal.js'
import { calendarDate, decimal, Money, plusDays, TAX_YEARS, type TaxYear } from '../values'
import type { Calculation, CalculationIssue, Disposal, Match, OpeningPool, Trade } from './types'
import { missingAcquisitionGuidance } from './types'

export const ENGINE_VERSION = '2.0.0-alpha.1'

interface DailySide {
  quantity: Decimal
  remaining: Decimal
  value: Decimal
  ids: string[]
}
interface Day {
  date: string
  buy: DailySide
  sell: DailySide
  cost: Decimal
  matches: Match[]
}
const empty = (): DailySide => ({ quantity: new Money(0), remaining: new Money(0), value: new Money(0), ids: [] })

function match(day: Day, buy: Day, quantity: Decimal, rule: 'SAME_DAY' | 'THIRTY_DAY') {
  const cost = buy.buy.value.times(quantity).div(buy.buy.quantity)
  day.sell.remaining = day.sell.remaining.minus(quantity)
  buy.buy.remaining = buy.buy.remaining.minus(quantity)
  day.cost = day.cost.plus(cost)
  day.matches.push({
    rule, quantity: quantity.toString(), costGBP: cost.toString(),
    acquisitionDate: buy.date, acquisitionIds: [...buy.buy.ids],
  })
}

/**
 * HMRC CG51560 / CG51575: aggregate same-class trades each day, reserve ALL
 * same-day matches, then identify later acquisitions chronologically, then pool.
 * Decimal strings are the boundary; inputs are never mutated. No tax-liability
 * estimate or personal relief assumptions are made here.
 */
export function calculateGains(
  trades: readonly Trade[],
  options: { taxYear: TaxYear; historyThrough: string; openingPools?: readonly OpeningPool[] },
): Calculation {
  const year = TAX_YEARS[options.taxYear]
  if (!year) throw new Error('Unsupported tax year')
  const historyThrough = calendarDate(options.historyThrough)
  const cutoff = historyThrough < year.end ? historyThrough : year.end
  const requiredHistoryThrough = plusDays(year.end, 30)
  const groups = new Map<string, Map<string, Day>>()
  const ids = new Set<string>()
  const opening = new Map<string, OpeningPool>()

  for (const pool of options.openingPools ?? []) {
    if (!pool.securityId.trim() || opening.has(pool.securityId)) throw new Error('Invalid or duplicate opening pool')
    calendarDate(pool.asOf)
    if (pool.asOf >= year.start || pool.asOf > historyThrough) throw new Error('Opening pool must precede the requested tax year and history cutoff')
    if (decimal(pool.quantity, 'Opening quantity').isZero() && !decimal(pool.costGBP, 'Opening cost').isZero()) {
      throw new Error('An empty opening pool cannot have a cost')
    }
    decimal(pool.costGBP, 'Opening cost')
    opening.set(pool.securityId, pool)
    groups.set(pool.securityId, new Map())
  }

  for (const trade of trades) {
    if (!trade.id.trim() || ids.has(trade.id)) throw new Error('Missing or duplicate transaction ID')
    ids.add(trade.id)
    if (!trade.securityId.trim()) throw new Error('Security identity is required')
    calendarDate(trade.date)
    if (trade.date > historyThrough) throw new Error('A transaction is later than the declared history cutoff')
    if (trade.date < '1982-04-01') throw new Error('Pre-April-1982 acquisitions require specialist handling')
    if (opening.has(trade.securityId) && trade.date <= opening.get(trade.securityId)!.asOf) {
      throw new Error('Transactions overlap the opening pool')
    }
    if (trade.side !== 'BUY' && trade.side !== 'SELL') throw new Error('Unsupported transaction type')
    const quantity = decimal(trade.quantity, 'Quantity')
    if (!quantity.gt(0)) throw new Error('Quantity must be greater than zero')
    const amount = decimal(trade.considerationGBP, 'Consideration')
    const fees = decimal(trade.feesGBP, 'Fees')
    // A sale can have negative net proceeds when disposal fees exceed proceeds.
    const value = trade.side === 'BUY' ? amount.plus(fees) : amount.minus(fees)
    if (!groups.has(trade.securityId)) groups.set(trade.securityId, new Map())
    const days = groups.get(trade.securityId)!
    if (!days.has(trade.date)) days.set(trade.date, { date: trade.date, buy: empty(), sell: empty(), cost: new Money(0), matches: [] })
    const side = trade.side === 'BUY' ? days.get(trade.date)!.buy : days.get(trade.date)!.sell
    side.quantity = side.quantity.plus(quantity)
    side.remaining = side.remaining.plus(quantity)
    side.value = side.value.plus(value)
    side.ids.push(trade.id)
  }

  const disposals: Disposal[] = []
  const issues: CalculationIssue[] = []
  const pools: Calculation['pools'] = []
  for (const [securityId, dayMap] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
    for (const day of days) {
      day.buy.ids.sort()
      day.sell.ids.sort()
      const quantity = Money.min(day.buy.quantity, day.sell.quantity)
      if (quantity.gt(0)) match(day, day, quantity, 'SAME_DAY')
    }
    for (let index = 0; index < days.length; index++) {
      const day = days[index]!
      const end = plusDays(day.date, 30)
      for (let next = index + 1; day.sell.remaining.gt(0) && next < days.length; next++) {
        const buy = days[next]!
        if (buy.date > end) break
        const quantity = Money.min(day.sell.remaining, buy.buy.remaining)
        if (quantity.gt(0)) match(day, buy, quantity, 'THIRTY_DAY')
      }
    }

    const initial = opening.get(securityId)
    let quantity = new Money(initial?.quantity ?? 0)
    let cost = new Money(initial?.costGBP ?? 0)
    // Pool state is at the requested tax-year end (or history cutoff), never
    // accidentally at the end of all supplied future transactions.
    for (const day of days.filter(day => day.date <= cutoff)) {
      if (day.buy.remaining.gt(0)) {
        cost = cost.plus(day.buy.value.times(day.buy.remaining).div(day.buy.quantity))
        quantity = quantity.plus(day.buy.remaining)
      }
      if (day.sell.quantity.isZero()) continue
      const pooled = Money.min(quantity, day.sell.remaining)
      if (pooled.gt(0)) {
        const pooledCost = cost.times(pooled).div(quantity)
        quantity = quantity.minus(pooled)
        cost = cost.minus(pooledCost)
        day.sell.remaining = day.sell.remaining.minus(pooled)
        day.cost = day.cost.plus(pooledCost)
        day.matches.push({ rule: 'SECTION_104', quantity: pooled.toString(), costGBP: pooledCost.toString() })
      }
      const missing = day.sell.remaining.gt(0)
      if (missing) issues.push({
        code: 'MISSING_ACQUISITION_HISTORY', securityId, date: day.date,
        quantity: day.sell.remaining.toString(),
        message: missingAcquisitionGuidance,
      })
      if (day.date >= year.start) disposals.push({
        securityId, date: day.date, sourceIds: [...day.sell.ids], quantity: day.sell.quantity.toString(),
        proceedsGBP: day.sell.value.toFixed(2), allowableCostGBP: missing ? null : day.cost.toFixed(2),
        gainGBP: missing ? null : day.sell.value.toDP(2).minus(day.cost.toDP(2)).toFixed(2),
        unmatchedQuantity: day.sell.remaining.toString(), matches: day.matches,
      })
    }
    if (quantity.gt(0)) pools.push({ securityId, quantity: quantity.toString(), costGBP: cost.toString() })
  }
  disposals.sort((a, b) => a.date.localeCompare(b.date) || a.securityId.localeCompare(b.securityId))
  const sum = (values: string[]) => values.reduce((a, b) => a.plus(b), new Money(0))
  const gains = sum(disposals.filter(d => new Money(d.gainGBP ?? 0).gt(0)).map(d => d.gainGBP!))
  const losses = sum(disposals.filter(d => new Money(d.gainGBP ?? 0).lt(0)).map(d => d.gainGBP!)).abs()
  return {
    engineVersion: ENGINE_VERSION, taxYear: options.taxYear, historyThrough, requiredHistoryThrough,
    poolAsOf: cutoff, status: issues.length ? 'blocked' : historyThrough < requiredHistoryThrough ? 'provisional' : 'complete',
    disposals, pools, issues,
    summary: issues.length ? null : {
      proceedsGBP: sum(disposals.map(d => d.proceedsGBP)).toFixed(2),
      allowableCostsGBP: sum(disposals.map(d => d.allowableCostGBP!)).toFixed(2),
      gainsGBP: gains.toFixed(2), lossesGBP: losses.toFixed(2), netGainGBP: gains.minus(losses).toFixed(2),
    },
  }
}
