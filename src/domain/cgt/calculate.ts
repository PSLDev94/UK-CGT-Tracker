import { ExactAmount } from './exact-amount'
import { calendarDate, decimal, plusDays, TAX_YEARS, type TaxYear } from '../values'
import type { Calculation, CalculationIssue, Disposal, Match, OpeningPool, PoolMovement, Trade } from './types'
import { missingAcquisitionGuidance } from './types'

export const ENGINE_VERSION = '2.0.0-alpha.5'

function checkedAmount(value: string, label: string) {
  decimal(value, label)
  return ExactAmount.from(value)
}

// Two 12-decimal source operands can produce up to 24 sterling decimal places.
function sterlingValue(value: string, label: string) {
  if (!/^(?:0|[1-9]\d{0,25})(?:\.\d{1,24})?$/.test(value)) {
    throw new Error(`${label} must be a supported non-negative sterling decimal`)
  }
  return ExactAmount.from(value)
}

interface DailySide {
  quantity: ExactAmount
  remaining: ExactAmount
  value: ExactAmount
  ids: string[]
}
interface Day {
  date: string
  buy: DailySide
  sell: DailySide
  grossSales: ExactAmount
  sellingCosts: ExactAmount
  cost: ExactAmount
  matches: Match[]
  holdingShortfall?: ExactAmount
}
const empty = (): DailySide => ({ quantity: ExactAmount.zero, remaining: ExactAmount.zero, value: ExactAmount.zero, ids: [] })

const modernRulesStart = '2008-04-06'

/** A fully closed old holding cannot supply basis to the new one once the
 * 30-day matching window has elapsed. Keep every other legacy sale for review. */
function relevantDays(days: Day[], initialQuantity: ExactAmount, yearStart: string): Day[] {
  let balance = initialQuantity
  let needsHistoricBasis = false
  let start = 0
  for (const [index, day] of days.entries()) {
    if (day.date >= yearStart) break
    balance = balance.plus(day.buy.quantity).minus(day.sell.quantity)
    if (balance.isNegative()) break
    if (day.date < modernRulesStart && day.sell.quantity.isPositive()) needsHistoricBasis = true
    const next = days[index + 1]
    if (needsHistoricBasis && balance.isZero() && (!next || next.date > plusDays(day.date, 30))) {
      start = index + 1
      needsHistoricBasis = false
    }
  }
  return start ? days.slice(start) : days
}

function match(day: Day, buy: Day, quantity: ExactAmount, rule: 'SAME_DAY' | 'THIRTY_DAY') {
  const cost = buy.buy.value.portion(quantity, buy.buy.quantity)
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
  if (historyThrough < year.start) throw new Error('History cutoff must include at least the first day of the selected tax year')
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
    const quantity = checkedAmount(trade.quantity, 'Quantity')
    if (!quantity.isPositive()) throw new Error('Quantity must be greater than zero')
    const amount = sterlingValue(trade.considerationGBP, 'Consideration')
    const fees = sterlingValue(trade.feesGBP, 'Fees')
    // A sale can have negative net proceeds when disposal fees exceed proceeds.
    const value = trade.side === 'BUY' ? amount.plus(fees) : amount.minus(fees)
    if (!groups.has(trade.securityId)) groups.set(trade.securityId, new Map())
    const days = groups.get(trade.securityId)!
    if (!days.has(trade.date)) days.set(trade.date, {
      date: trade.date, buy: empty(), sell: empty(), grossSales: ExactAmount.zero, sellingCosts: ExactAmount.zero, cost: ExactAmount.zero, matches: [],
    })
    const day = days.get(trade.date)!
    const side = trade.side === 'BUY' ? day.buy : day.sell
    if (trade.side === 'SELL') {
      day.grossSales = day.grossSales.plus(amount)
      day.sellingCosts = day.sellingCosts.plus(fees)
    }
    side.quantity = side.quantity.plus(quantity)
    side.remaining = side.remaining.plus(quantity)
    side.value = side.value.plus(value)
    side.ids.push(trade.id)
  }

  const disposals: Disposal[] = []
  const issues: CalculationIssue[] = []
  const pools: Calculation['pools'] = []
  const poolMovements: PoolMovement[] = []
  let annualProceeds = ExactAmount.zero
  let annualCosts = ExactAmount.zero
  let annualGains = ExactAmount.zero
  let annualLosses = ExactAmount.zero
  let reportedGrossSales = ExactAmount.zero
  let reportedSellingCosts = ExactAmount.zero
  let reportedProceedsAdjustment = ExactAmount.zero
  for (const [securityId, dayMap] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const initial = opening.get(securityId)
    const initialQuantity = ExactAmount.from(initial?.quantity ?? '0')
    const days = relevantDays([...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)), initialQuantity, year.start)
    const openingApplies = days.length === dayMap.size && initial
    let held = openingApplies ? initialQuantity : ExactAmount.zero
    let futureShortfall: {date: string; quantity: ExactAmount} | undefined
    for (const day of days) {
      held = held.plus(day.buy.quantity).minus(day.sell.quantity)
      if (held.isNegative()) {
        day.holdingShortfall = held.negated()
        if (day.date > cutoff && !futureShortfall)
          futureShortfall = {date: day.date, quantity: day.holdingShortfall}
      }
      day.buy.ids.sort()
      day.sell.ids.sort()
      const quantity = ExactAmount.min(day.buy.quantity, day.sell.quantity)
      if (quantity.isPositive()) match(day, day, quantity, 'SAME_DAY')
    }
    for (let index = 0; index < days.length; index++) {
      const day = days[index]!
      const end = plusDays(day.date, 30)
      for (let next = index + 1; day.sell.remaining.isPositive() && next < days.length; next++) {
        const buy = days[next]!
        if (buy.date > end) break
        const quantity = ExactAmount.min(day.sell.remaining, buy.buy.remaining)
        if (quantity.isPositive()) match(day, buy, quantity, 'THIRTY_DAY')
      }
    }

    let quantity = openingApplies ? initialQuantity : ExactAmount.zero
    const hasAssessedDisposal = days.some(day => day.date >= year.start && day.date <= cutoff && day.sell.quantity.isPositive())
    // A negative evidenced holding can mean missing transactions as well as an
    // uncertain historic cost. Keep that wider problem blocking.
    const historicPoolOnly = !hasAssessedDisposal && !days.some(day => day.date <= cutoff && day.holdingShortfall)
    let basisUnavailable = false
    let cost = openingApplies ? ExactAmount.from(openingApplies.costGBP) : ExactAmount.zero
    function movement(date: string, kind: PoolMovement['kind'], quantityChange: ExactAmount, costChange: ExactAmount, sourceIds: string[]) {
      poolMovements.push({
        securityId, date, kind, sourceIds,
        quantityChange: quantityChange.toString(),
        costChangeGBP: costChange.toString(),
        quantityAfter: quantity.toString(),
        costAfterGBP: cost.toString(),
      })
    }
    if (openingApplies) movement(openingApplies.asOf, 'opening', quantity, cost, [])
    // Pool state is at the requested tax-year end (or history cutoff), never
    // accidentally at the end of all supplied future transactions.
    for (const day of days.filter(day => day.date <= cutoff)) {
      if (!basisUnavailable && day.sell.quantity.isPositive() && day.date < modernRulesStart) {
        basisUnavailable = true
        issues.push({
          ...(historicPoolOnly && { scope: 'pool' as const }),
          code: 'HISTORICAL_SHARE_MATCHING', securityId, date: day.date, quantity: day.sell.quantity.toString(),
          message: 'This holding has a disposal before 6 April 2008. Ask support to record a professionally reviewed opening position before completing this year.',
        })
      }
      if (!basisUnavailable && day.buy.remaining.isPositive()) {
        const addedCost = day.buy.value.portion(day.buy.remaining, day.buy.quantity)
        cost = cost.plus(addedCost)
        quantity = quantity.plus(day.buy.remaining)
        movement(day.date, 'acquisition', day.buy.remaining, addedCost, day.buy.ids)
      }
      if (day.sell.quantity.isZero()) continue
      // A repurchase within 30 days can identify the tax cost of a disposal,
      // but cannot establish that the investor already owned the shares sold.
      const shortage = day.sell.remaining.minus(quantity)
      const unmatched = shortage.isPositive()
      if (!basisUnavailable && (day.holdingShortfall || unmatched)) {
        basisUnavailable = true
        issues.push({
          code: unmatched ? 'MISSING_ACQUISITION_HISTORY' : 'UNEVIDENCED_HOLDING',
          securityId, date: day.date,
          quantity: (day.holdingShortfall ?? shortage).toString(),
          message: unmatched ? missingAcquisitionGuidance : 'The recorded sale exceeds the shares held on that date. Add the earlier holding history or seek specialist review if this was a short sale.',
        })
      }
      const gap = futureShortfall
      if (!basisUnavailable && gap && day.matches.some(m => m.rule === 'THIRTY_DAY' && m.acquisitionDate! >= gap.date)) {
        basisUnavailable = true
        issues.push({
          code: 'UNEVIDENCED_HOLDING', securityId, date: gap.date, quantity: gap.quantity.toString(),
          message: 'The 30-day match uses a repurchase after the recorded holding went below zero. Add the missing history or ask support for a specialist review.',
        })
      }
      const pooled = ExactAmount.min(quantity, day.sell.remaining)
      if (!basisUnavailable && pooled.isPositive()) {
        const pooledCost = cost.portion(pooled, quantity)
        quantity = quantity.minus(pooled)
        cost = cost.minus(pooledCost)
        movement(day.date, 'disposal', pooled.negated(), pooledCost.negated(), day.sell.ids)
        day.sell.remaining = day.sell.remaining.minus(pooled)
        day.cost = day.cost.plus(pooledCost)
        day.matches.push({ rule: 'SECTION_104', quantity: pooled.toString(), costGBP: pooledCost.toString() })
      }
      const missing = basisUnavailable
      if (day.date < year.start) continue
      const exactGain = day.sell.value.minus(day.cost)
      annualProceeds = annualProceeds.plus(day.sell.value)
      annualCosts = annualCosts.plus(day.cost)
      if (exactGain.isNegative()) annualLosses = annualLosses.plus(exactGain.negated())
      else annualGains = annualGains.plus(exactGain)
      const gross = day.grossSales.toPence()
      const sellingCosts = day.sellingCosts.toPence()
      const proceedsAdjustment = day.sell.value.toPence().minus(gross.minus(sellingCosts))
      reportedGrossSales = reportedGrossSales.plus(gross)
      reportedSellingCosts = reportedSellingCosts.plus(sellingCosts)
      reportedProceedsAdjustment = reportedProceedsAdjustment.plus(proceedsAdjustment)
      disposals.push({
        securityId, date: day.date, sourceIds: [...day.sell.ids], quantity: day.sell.quantity.toString(),
        proceedsGBP: day.sell.value.toFixed(2), allowableCostGBP: missing ? null : day.cost.toFixed(2),
        saleBreakdown: {
          grossProceedsGBP: gross.toFixed(2), sellingCostsGBP: sellingCosts.toFixed(2),
          totalAllowableCostsGBP: missing ? null : day.cost.toPence().plus(sellingCosts).toFixed(2),
          proceedsRoundingAdjustmentGBP: proceedsAdjustment.toFixed(2),
        },
        gainGBP: missing ? null : day.sell.value.toPence().minus(day.cost.toPence()).toFixed(2),
        unmatchedQuantity: missing ? day.sell.quantity.toString() : '0', matches: missing ? [] : day.matches,
      })
    }
    if (!basisUnavailable && quantity.isPositive()) pools.push({ securityId, quantity: quantity.toString(), costGBP: cost.toString() })
  }
  disposals.sort((a, b) => a.date.localeCompare(b.date) || a.securityId.localeCompare(b.securityId))
  const sum = (values: string[]) => values.reduce((a, b) => a.plus(ExactAmount.from(b)), ExactAmount.zero)
  const gains = sum(disposals.filter(d => ExactAmount.from(d.gainGBP ?? '0').isPositive()).map(d => d.gainGBP!))
  const losses = sum(disposals.filter(d => ExactAmount.from(d.gainGBP ?? '0').isNegative()).map(d => d.gainGBP!)).negated()
  const annualBlocked = issues.some(issue => issue.scope !== 'pool')
  const reportedAcquisitionCosts = sum(disposals.map(d => d.allowableCostGBP ?? '0'))
  return {
    engineVersion: ENGINE_VERSION, taxYear: options.taxYear, historyThrough, requiredHistoryThrough,
    poolAsOf: cutoff, status: annualBlocked ? 'blocked' : historyThrough < requiredHistoryThrough ? 'provisional' : 'complete',
    disposals, pools, poolMovements, issues,
    saleBreakdown: {
      grossProceedsGBP: reportedGrossSales.toFixed(2), sellingCostsGBP: reportedSellingCosts.toFixed(2),
      totalAllowableCostsGBP: annualBlocked ? null : reportedAcquisitionCosts.plus(reportedSellingCosts).toFixed(2),
      proceedsRoundingAdjustmentGBP: reportedProceedsAdjustment.toFixed(2),
    },
    ...(!annualBlocked && { annualBeforeDisposalRounding: {
      proceedsGBP: annualProceeds.toFixed(2), allowableCostsGBP: annualCosts.toFixed(2),
      gainsGBP: annualGains.toFixed(2), lossesGBP: annualLosses.toFixed(2), netGainGBP: annualGains.minus(annualLosses).toFixed(2),
    } }),
    summary: annualBlocked ? null : {
      proceedsGBP: sum(disposals.map(d => d.proceedsGBP)).toFixed(2),
      allowableCostsGBP: reportedAcquisitionCosts.toFixed(2),
      gainsGBP: gains.toFixed(2), lossesGBP: losses.toFixed(2), netGainGBP: gains.minus(losses).toFixed(2),
    },
  }
}
