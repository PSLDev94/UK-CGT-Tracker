import Decimal from 'decimal.js'

// Never inherit precision or rounding changes made elsewhere in the application.
export const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export function netOutcome(value: string): string {
  const rounded = new Money(value).toDecimalPlaces(2)
  if (rounded.isZero()) return 'Break-even'
  return rounded.isNegative() ? 'Net loss' : 'Net gain'
}

export function decimal(value: string, label: string): Decimal {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || value.length > 40) {
    throw new Error(`${label} must be a non-negative decimal string (up to 12 decimal places).`)
  }
  return new Money(value)
}

export function calendarDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid calendar date: ${value}`)
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`)
  }
  return value
}

/** UK calendar day for an instant; distinct from date-only UTC arithmetic. */
export function ukCalendarDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function plusDays(value: string, days: number): string {
  const date = new Date(`${calendarDate(value)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const TAX_YEARS = Object.freeze({
  '2021-22': { start: '2021-04-06', end: '2022-04-05', annualExemptionGBP: '12300.00' },
  '2022-23': { start: '2022-04-06', end: '2023-04-05', annualExemptionGBP: '12300.00' },
  '2023-24': { start: '2023-04-06', end: '2024-04-05', annualExemptionGBP: '6000.00' },
  '2024-25': { start: '2024-04-06', end: '2025-04-05', annualExemptionGBP: '3000.00' },
  '2025-26': { start: '2025-04-06', end: '2026-04-05', annualExemptionGBP: '3000.00' },
  '2026-27': { start: '2026-04-06', end: '2027-04-05', annualExemptionGBP: '3000.00' },
})

export type TaxYear = keyof typeof TAX_YEARS
