import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { calculateGains } from '../src/domain/cgt/calculate'
import type { Trade } from '../src/domain/cgt/types'
import { calendarDate, Money, plusDays } from '../src/domain/values'

const trade = (id: string, date: string, side: Trade['side'], quantity: string, considerationGBP: string, feesGBP = '0', securityId = 'GB00TEST00001'): Trade =>
  ({ id, date, side, quantity, considerationGBP, feesGBP, securityId })
const options = { taxYear: '2024-25' as const, historyThrough: '2025-05-05' }
const run = (trades: readonly Trade[]) => calculateGains(trades, options)

describe('HMRC share matching regression cases', () => {
  it('keeps gross proceeds and selling costs separate from acquisition costs for gains and losses', () => {
    const result = run([
      trade('buy', '2024-04-06', 'BUY', '2', '120', '4'),
      trade('sell1', '2024-08-01', 'SELL', '0.6', '60', '3'),
      trade('sell2', '2024-08-01', 'SELL', '0.4', '40', '2'),
      trade('sell3', '2024-09-01', 'SELL', '1', '55'),
    ])
    expect(result.disposals[0]).toMatchObject({
      proceedsGBP: '95.00', allowableCostGBP: '62.00', gainGBP: '33.00',
      saleBreakdown: { grossProceedsGBP: '100.00', sellingCostsGBP: '5.00', totalAllowableCostsGBP: '67.00', proceedsRoundingAdjustmentGBP: '0.00' },
    })
    expect(result.disposals[1]).toMatchObject({
      gainGBP: '-7.00', saleBreakdown: { sellingCostsGBP: '0.00', totalAllowableCostsGBP: '62.00' },
    })
    expect(result.saleBreakdown).toEqual({
      grossProceedsGBP: '155.00', sellingCostsGBP: '5.00', totalAllowableCostsGBP: '129.00', proceedsRoundingAdjustmentGBP: '0.00',
    })
    expect(result.summary?.netGainGBP).toBe('26.00')
  })

  it('explains subpenny sale proceeds rounding and withholds costs when acquisition evidence is missing', () => {
    const sale = trade('sell', '2024-08-01', 'SELL', '1', '100.004', '5.005')
    const priced = run([trade('buy', '2024-04-06', 'BUY', '1', '62'), sale])
    expect(priced.saleBreakdown).toEqual({
      grossProceedsGBP: '100.00', sellingCostsGBP: '5.01', totalAllowableCostsGBP: '67.01', proceedsRoundingAdjustmentGBP: '0.01',
    })
    expect(priced.disposals[0]?.gainGBP).toBe('33.00')
    const incomplete = run([sale])
    expect(incomplete.summary).toBeNull()
    expect(incomplete.disposals[0]?.saleBreakdown).toEqual({ ...priced.saleBreakdown, totalAllowableCostsGBP: null })
    expect(incomplete.saleBreakdown?.totalAllowableCostsGBP).toBeNull()
  })

  it('matches a partial disposal to the Section 104 pool', () => {
    const result = run([trade('1', '2024-06-01', 'BUY', '100', '10000'), trade('2', '2024-09-01', 'SELL', '50', '6000')])
    expect(result.disposals[0]).toMatchObject({ allowableCostGBP: '5000.00', gainGBP: '1000.00' })
    expect(result.pools[0]).toMatchObject({ quantity: '50', costGBP: '5000' })
  })

  it('aggregates same-day acquisitions at different prices', () => {
    const result = run([trade('a', '2024-06-01', 'BUY', '100', '1000'), trade('b', '2024-06-01', 'BUY', '100', '3000'), trade('s', '2024-06-01', 'SELL', '100', '2500')])
    expect(result.disposals[0]).toMatchObject({ allowableCostGBP: '2000.00', gainGBP: '500.00' })
    expect(result.pools[0]?.costGBP).toBe('2000')
  })

  it('aggregates multiple same-day sales into one disposal', () => {
    const result = run([trade('a', '2024-06-01', 'BUY', '100', '1000'), trade('s2', '2024-06-01', 'SELL', '20', '400'), trade('s1', '2024-06-01', 'SELL', '30', '500')])
    expect(result.disposals).toHaveLength(1)
    expect(result.disposals[0]).toMatchObject({ quantity: '50', proceedsGBP: '900.00', allowableCostGBP: '500.00', sourceIds: ['s1', 's2'] })
  })

  it('reserves later same-day buys before an earlier 30-day disposal across tax years', () => {
    const trades = [trade('a', '2024-01-01', 'BUY', '100', '1000'), trade('s1', '2024-04-01', 'SELL', '100', '1500'), trade('b', '2024-04-10', 'BUY', '100', '2000'), trade('s2', '2024-04-10', 'SELL', '100', '2500')]
    const earlier = calculateGains(trades, { taxYear: '2023-24', historyThrough: '2024-05-05' })
    expect(earlier.disposals[0]?.allowableCostGBP).toBe('1000.00')
    expect(run(trades).disposals[0]?.allowableCostGBP).toBe('2000.00')
  })

  it('combines all three matching rules', () => {
    const result = run([trade('p', '2024-01-01', 'BUY', '100', '1000'), trade('a', '2024-06-01', 'BUY', '20', '400'), trade('s', '2024-06-01', 'SELL', '100', '3000'), trade('b', '2024-06-15', 'BUY', '30', '900')])
    expect(result.disposals[0]?.allowableCostGBP).toBe('1800.00')
    expect(result.disposals[0]?.matches.map(m => m.rule)).toEqual(['SAME_DAY', 'THIRTY_DAY', 'SECTION_104'])
    expect(result.pools[0]).toMatchObject({ quantity: '50', costGBP: '500' })
  })

  it.each([['2024-06-30', '2000.00'], ['2024-07-01', '2000.00'], ['2024-07-02', '1000.00']])('handles the 30-day boundary for %s', (date, cost) => {
    const result = run([trade('p', '2024-01-01', 'BUY', '100', '1000'), trade('s', '2024-06-01', 'SELL', '100', '3000'), trade('b', date!, 'BUY', '100', '2000')])
    expect(result.disposals[0]?.allowableCostGBP).toBe(cost)
  })

  it('allocates competing future purchases to earlier disposals first', () => {
    const result = run([trade('p', '2024-01-01', 'BUY', '120', '1200'), trade('s1', '2024-06-01', 'SELL', '60', '1200'), trade('s2', '2024-06-02', 'SELL', '60', '1200'), trade('b', '2024-06-15', 'BUY', '80', '1600')])
    expect(result.disposals.map(d => d.allowableCostGBP)).toEqual(['1200.00', '800.00'])
  })

  it('handles buy and sell fees once', () => {
    const result = run([trade('a', '2024-06-01', 'BUY', '100', '1000', '10'), trade('s', '2024-09-01', 'SELL', '100', '1200', '5')])
    expect(result.disposals[0]).toMatchObject({ proceedsGBP: '1195.00', allowableCostGBP: '1010.00', gainGBP: '185.00' })
  })

  it('does not clamp fees exceeding sale proceeds to zero', () => {
    const result = run([trade('a', '2024-06-01', 'BUY', '1', '1'), trade('s', '2024-09-01', 'SELL', '1', '0', '5')])
    expect(result.disposals[0]?.gainGBP).toBe('-6.00')
  })

  it('blocks incomplete history without assuming zero acquisition cost', () => {
    const result = run([trade('s', '2024-06-01', 'SELL', '5', '500')])
    expect(result.status).toBe('blocked')
    expect(result.summary).toBeNull()
    expect(result.disposals[0]).toMatchObject({ allowableCostGBP: null, gainGBP: null, unmatchedQuantity: '5' })
  })

  it('withholds affected costs and balances when a pre-transition sale needs historic identification', () => {
    const trades = [
      trade('early', '2003-06-10', 'BUY', '100', '100'),
      trade('later', '2005-06-10', 'BUY', '100', '900'),
      trade('old-sale', '2007-07-10', 'SELL', '100', '700'),
      trade('current-sale', '2024-08-20', 'SELL', '100', '1000'),
    ]
    const result = run(trades)
    expect(result.status).toBe('blocked')
    expect(result.summary).toBeNull()
    expect(result.issues).toMatchObject([{ code: 'HISTORICAL_SHARE_MATCHING', date: '2007-07-10' }])
    expect(result.disposals[0]).toMatchObject({ proceedsGBP: '1000.00', gainGBP: null, allowableCostGBP: null, matches: [] })
    expect(result.pools).toEqual([])
    const buysOnly = run(trades.filter(row => row.id !== 'old-sale'))
    expect(buysOnly.status).toBe('complete')
    expect(buysOnly.summary?.netGainGBP).toBe('500.00')
  })

  it('checks ownership through a year-end matched repurchase without blocking unrelated later sales', () => {
    const yearEnd = [trade('opening','2024-06-01','BUY','1','100'), trade('closing','2025-04-05','SELL','1','200')]
    const buy = trade('repurchase','2025-04-15','BUY','1','180')
    const gap = run([...yearEnd, trade('short','2025-04-07','SELL','1','100'), buy])
    expect(gap.status).toBe('blocked')
    expect(gap.disposals[0]?.gainGBP).toBeNull()
    expect(gap.issues).toMatchObject([{code:'UNEVIDENCED_HOLDING',date:'2025-04-07'}])
    expect(run([...yearEnd, buy, trade('unrelated','2025-04-21','SELL','2','300')]).summary?.netGainGBP).toBe('20.00')
  })

  it('honours a closed historical holding unless a cross-transition repurchase could identify the sale', () => {
    const purchase = trade('old', '2005-06-10', 'BUY', '5', '100')
    const sale = trade('old-sale', '2008-04-05', 'SELL', '5', '120')
    const refill = trade('refill', '2008-05-06', 'BUY', '5', '200')
    const current = trade('current', '2024-08-20', 'SELL', '5', '250')
    expect(run([purchase, sale, refill, current]).summary?.netGainGBP).toBe('50.00')
    expect(run([purchase, sale, { ...refill, date: '2008-05-05' }, current]).status).toBe('blocked')
    expect(run([purchase, sale]).status).toBe('complete')
    expect(run([purchase, { ...sale, date: '2006-04-01' }, { ...refill, date: '2007-03-15' }, current]).summary?.netGainGBP).toBe('50.00')
  })

  it('requires ownership at disposal even when a later buy is available for 30-day matching', () => {
    const sale = trade('sale', '2024-04-15', 'SELL', '5', '100')
    const buy = trade('later', '2024-04-29', 'BUY', '5', '90')
    const missing = run([sale, buy])
    expect(missing.status).toBe('blocked')
    expect(missing.summary).toBeNull()
    expect(missing.disposals[0]).toMatchObject({ proceedsGBP: '100.00', gainGBP: null })
    expect(missing.issues).toMatchObject([{ code: 'UNEVIDENCED_HOLDING', quantity: '5' }])
    const valid = run([trade('cost', '2024-01-01', 'BUY', '5', '50'), sale, buy])
    expect(valid.status).toBe('complete')
    expect(valid.summary?.netGainGBP).toBe('10.00')
  })

  it.each([
    ['6', '0.13', '1', '3', '0.07', '3.13', '4.61'],
    ['26', '100.01', '10', '13', '50.01', '-46.81', '-83.78'],
  ])('rounds successive partial disposals exactly at a half penny for %s shares', (quantity, cost, firstSale, nextSale, allocated, gain, net) => {
    const result = run([
      trade('pool', '2023-10-01', 'BUY', quantity, cost),
      trade('s1', '2024-05-03', 'SELL', firstSale, '1.50'),
      trade('s2', '2024-08-04', 'SELL', nextSale, '3.20'),
    ])
    expect(result.disposals[1]).toMatchObject({ allowableCostGBP: allocated, gainGBP: gain })
    expect(result.summary?.netGainGBP).toBe(net)
  })

  it('accepts explicit opening pools without requiring fabricated purchases', () => {
    const result = calculateGains([trade('s', '2024-06-01', 'SELL', '5', '500')], { ...options, openingPools: [{ securityId: 'GB00TEST00001', asOf: '2024-04-05', quantity: '10', costGBP: '600' }] })
    expect(result.disposals[0]?.gainGBP).toBe('200.00')
    expect(result.pools[0]?.quantity).toBe('5')
  })

  it('does not let a partial pre-year disposal disappear from completeness checks', () => {
    const result = run([trade('s', '2024-01-01', 'SELL', '10', '100'), trade('a', '2024-06-01', 'BUY', '10', '100')])
    expect(result.status).toBe('blocked')
    expect(result.summary).toBeNull()
  })

  it('marks the year provisional until the look-ahead period is covered', () => {
    expect(calculateGains([], { ...options, historyThrough: '2025-05-04' }).status).toBe('provisional')
    expect(run([]).status).toBe('complete')
  })

  it('shows year-end pools rather than the final future balance', () => {
    const result = run([trade('a', '2024-06-01', 'BUY', '10', '100'), trade('b', '2025-04-20', 'BUY', '10', '200')])
    expect(result.pools[0]).toMatchObject({ quantity: '10', costGBP: '100' })
    expect(result.poolAsOf).toBe('2025-04-05')
  })

  it('matches across 5 April with the following-year purchase', () => {
    const result = run([trade('p', '2024-01-01', 'BUY', '10', '100'), trade('s', '2025-04-05', 'SELL', '10', '200'), trade('b', '2025-05-05', 'BUY', '10', '150')])
    expect(result.disposals[0]?.gainGBP).toBe('50.00')
    expect(result.pools[0]?.costGBP).toBe('100')
  })

  it('supports the current 2026-27 year', () => {
    expect(calculateGains([], { taxYear: '2026-27', historyThrough: '2026-11-16' }).status).toBe('provisional')
  })

  it('does not mutate inputs or change on a second run', () => {
    const trades = Object.freeze([Object.freeze(trade('a', '2024-06-01', 'BUY', '100', '1000')), Object.freeze(trade('s', '2024-06-01', 'SELL', '100', '1500'))])
    const snapshot = JSON.stringify(trades)
    expect(run(trades)).toEqual(run(trades))
    expect(JSON.stringify(trades)).toBe(snapshot)
  })

  it('isolates instruments that might share the same display ticker', () => {
    const result = run([trade('a', '2024-06-01', 'BUY', '10', '100', '0', 'ISIN:A'), trade('s', '2024-06-01', 'SELL', '10', '200', '0', 'ISIN:B')])
    expect(result.status).toBe('blocked')
  })

  it.each(['NaN', 'Infinity', '-1', '1e3', '1,000', '0.0000000000001'])('rejects invalid numeric input %s', quantity => {
    expect(() => run([trade('a', '2024-06-01', 'BUY', quantity, '100')])).toThrow()
  })
  it('rejects duplicate IDs, future records and overlapping opening pools', () => {
    const t = trade('a', '2024-06-01', 'BUY', '1', '1')
    expect(() => run([t, t])).toThrow(/duplicate/)
    expect(() => run([{ ...t, date: '2025-05-06' }])).toThrow(/cutoff/)
    expect(() => calculateGains([t], { ...options, openingPools: [{ securityId: t.securityId, asOf: '2024-07-01', quantity: '1', costGBP: '1' }] })).toThrow()
  })
})

describe('independent invariants', () => {
  it('is invariant to input order including within a date', () => {
    const trades = [trade('a', '2024-06-01', 'BUY', '100', '1000'), trade('b', '2024-06-01', 'BUY', '100', '3000'), trade('s', '2024-06-01', 'SELL', '100', '2500')]
    fc.assert(fc.property(fc.shuffledSubarray(trades, { minLength: trades.length, maxLength: trades.length }), shuffled => {
      expect(run(shuffled)).toEqual(run(trades))
    }), { numRuns: 100, seed: 212 })
  })

  it('conserves cost and shares for arbitrary partial pooled sales', () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 10000 }), fc.integer({ min: 1, max: 1000000 }), (quantity, cost) => {
      const sold = Math.floor(quantity / 2)
      const result = run([trade('b', '2024-06-01', 'BUY', String(quantity), String(cost)), trade('s', '2024-09-01', 'SELL', String(sold), String(cost))])
      const remaining = new Money(result.pools[0]!.costGBP)
      const matched = new Money(result.disposals[0]!.matches[0]!.costGBP)
      expect(remaining.plus(matched).minus(cost).abs().lt('0.00000000000000000000001')).toBe(true)
      expect(Number(result.pools[0]!.quantity) + sold).toBe(quantity)
      expect(result.status).toBe('complete')
    }), { numRuns: 200, seed: 104 })
  })

  it('uses calendar days across DST and leap days', () => {
    expect(plusDays('2024-03-15', 30)).toBe('2024-04-14')
    expect(plusDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(() => calendarDate('2025-02-29')).toThrow()
    expect(() => calendarDate('2024-04-31')).toThrow()
  })
})
