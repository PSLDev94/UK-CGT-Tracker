import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calculateGains } from '../src/domain/cgt/calculate'
import { BROKER_COVERAGE, BROKERS } from '../src/domain/imports/brokers'
import { CANONICAL_HEADERS, csvCell, reviewCsv, tradesFromReview, validISIN, type ImportOptions } from '../src/domain/imports/review'

const opts: ImportOptions = { broker: 'trading212', accountId: 'synthetic-account', accountType: 'GIA', format: 'canonical-v1' }
const header = CANONICAL_HEADERS.join(',')
const row = ['id1', '2024-06-01', 'BUY', 'US0378331005', '100', '1000', '10', 'GBP', '1', 'ORDINARY_SHARE']
const file = (...rows: string[][]) => [header, ...rows.map(r => r.join(','))].join('\n')
const fixture = readFileSync(new URL('./fixtures/canonical-trades.csv', import.meta.url), 'utf8')

describe('import contract', () => {
  it('reconciles accepted and excluded records and retains FX provenance', () => {
    const result = reviewCsv(fixture, opts)
    expect(result.status).toBe('ready')
    expect(result.counts).toEqual({ total: 3, accepted: 2, excluded: 1, duplicate: 0, needsReview: 0 })
    expect(result.records[0]?.provenance).toEqual({ originalCurrency: 'USD', consideration: '1000', fees: '10', gbpPerUnit: '0.8' })
    const calculation = calculateGains(tradesFromReview(result), { taxYear: '2024-25', historyThrough: '2025-05-05' })
    expect(calculation.summary?.netGainGBP).toBe('391.00')
    expect(calculation.disposals[0]).toMatchObject({ proceedsGBP: '795.00', allowableCostGBP: '404.00' })
  })

  it('does not invent broker certification from synthetic fixtures', () => {
    expect(BROKERS).toHaveLength(6)
    expect(BROKER_COVERAGE.filter(b => b.enabled).map(b => b.brokerId)).toEqual(['trading212', 'freetrade', 'hl', 'ii', 'ibkr', 'ajbell'])
    expect(BROKER_COVERAGE.every(b => b.status !== ('certified' as string))).toBe(true)
  })

  it.each(BROKERS)('routes unverified $name files to review with every record accounted for', broker => {
    const result = reviewCsv(fixture, { ...opts, broker: broker.id, format: 'native' })
    expect(result.status).toBe('unsupported')
    expect(result.counts).toEqual({ total: 3, accepted: 0, excluded: 0, duplicate: 0, needsReview: 3 })
    expect(() => tradesFromReview(result)).toThrow()
  })

  it.each(['ISA', 'SIPP', 'UNKNOWN'] as const)('blocks %s accounts', accountType => {
    expect(reviewCsv(fixture, { ...opts, accountType }).issues[0]?.code).toBe('UNSUPPORTED_ACCOUNT')
  })

  it('blocks all commits if even one record is invalid', () => {
    const result = reviewCsv(file(row, ['id2', '04/05/2024', ...row.slice(2)]), opts)
    expect(result.counts.accepted).toBe(1)
    expect(result.counts.needsReview).toBe(1)
    expect(() => tradesFromReview(result)).toThrow(/Resolve/)
  })

  it.each([
    [2, 'MERGER'], [2, 'TRANSFER'], [2, 'DIVIDEND_REINVESTMENT'],
    [3, 'AAPL'], [3, 'US0378331006'], [4, '-10'], [4, '0'], [4, '1e5'],
    [5, 'NaN'], [6, ''], [7, 'GBX'], [7, 'XYZ'], [8, '0'], [8, '1.5'], [9, 'ETF'],
  ])('rejects unsafe field %s = %s', (index, value) => {
    const changed = [...row]
    changed[Number(index)] = String(value)
    expect(reviewCsv(file(changed), opts).status).toBe('needs_review')
  })

  it('deduplicates exact IDs across retries without rounding fingerprints', () => {
    const first = reviewCsv(file(row), opts)
    const known = first.records[0]!
    const second = reviewCsv(file(row), { ...opts, existing: new Map([[known.sourceKey!, known.digest!]]) })
    expect(second.counts.duplicate).toBe(1)
    expect(second.counts.accepted).toBe(0)
  })

  it('flags changed contents under the same ID', () => {
    const changed = [...row]; changed[5] = '1200'
    const result = reviewCsv(file(row, changed), opts)
    expect(result.issues[0]?.code).toBe('DUPLICATE_CONFLICT')
    expect(() => tradesFromReview(result)).toThrow()
  })

  it('keeps distinct executions with identical economics', () => {
    const other = [...row]; other[0] = 'id2'
    expect(reviewCsv(file(row, other), opts).counts.accepted).toBe(2)
  })

  it('namespaces broker IDs by account', () => {
    const a = reviewCsv(file(row), opts).records[0]!.sourceKey
    const b = reviewCsv(file(row), { ...opts, accountId: 'different-account' }).records[0]!.sourceKey
    expect(a).not.toBe(b)
  })

  it('rejects duplicate or extra headers rather than dropping financial information', () => {
    expect(reviewCsv(file(row).replace('Fees', 'Consideration'), opts).status).toBe('needs_review')
    expect(reviewCsv(`${header},Another fee\n${row.join(',')},10`, opts).status).toBe('unsupported')
  })

  it('handles a UTF-8 BOM, CRLF, and quoted fields', () => {
    const quoted = row.map(v => `"${v}"`).join(',')
    expect(reviewCsv(`\uFEFF${header}\r\n${quoted}\r\n`, opts).status).toBe('ready')
  })

  it('rejects broken quoting and different field counts', () => {
    expect(reviewCsv(`${header}\n"unterminated`, opts).status).toBe('needs_review')
    expect(reviewCsv(file(row.slice(1)), opts).status).toBe('needs_review')
  })

  it('keeps decimals exact beyond binary floating-point precision', () => {
    const changed = [...row]; changed[4] = '0.123456789012'; changed[5] = '100000000000000.01'
    expect(reviewCsv(file(changed), opts).records[0]?.trade?.considerationGBP).toBe('100000000000000.01')
  })

  it('rejects empty and binary files', () => {
    expect(reviewCsv('', opts).status).toBe('needs_review')
    expect(reviewCsv('abc\0def', opts).status).toBe('needs_review')
  })

  it('holds oversized values and preserves even the smallest allowed FX product', () => {
    const huge = [...row]; huge[5] = '100000000000000000000000000'
    expect(reviewCsv(file(huge), opts).issues[0]?.message).toContain('precision')
    const tiny = [...row]; tiny[5] = '0.000000000001'; tiny[7] = 'USD'; tiny[8] = '0.000000000001'
    expect(reviewCsv(file(tiny), opts).records[0]?.trade?.considerationGBP).toBe('0.000000000000000000000001')
  })

  it.each([
    ['451.66665', '0.81300003', '367.2049999999995'],
    ['451.66665', '0.813000030001', '367.20500000045116665'],
  ])('keeps the exact sterling consideration and fees around a half-penny boundary', (foreign, rate, expected) => {
    const trade = [...row]
    trade[5] = foreign; trade[6] = foreign; trade[7] = 'USD'; trade[8] = rate
    expect(reviewCsv(file(trade), opts).records[0]?.trade).toMatchObject({ considerationGBP: expected, feesGBP: expected })
  })

  it('blocks specialist pre-1982 history and dates after the server cutoff', () => {
    const historic = [...row]; historic[1] = '1981-01-01'
    expect(reviewCsv(file(historic), opts).issues[0]?.message).toContain('specialist')
    expect(reviewCsv(file(row), { ...opts, latestTradeDate: '2024-05-31' }).issues[0]?.message).toContain('future')
  })

  it('validates ISIN check digits', () => {
    expect(validISIN('US0378331005')).toBe(true)
    expect(validISIN('GB0008706128')).toBe(true)
    expect(validISIN('US0378331006')).toBe(false)
  })

  it('escapes CSV quotes and neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("example")')).toBe('"\'=HYPERLINK(""example"")"')
    expect(csvCell('A, B')).toBe('"A, B"')
    expect(csvCell('  +123')).toBe('"\'  +123"')
  })
})
