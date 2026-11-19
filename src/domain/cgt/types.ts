export const CURRENT_SCOPE_DECLARATION = 'personal-standard-basis-v3' as const

/** One taxpayer, one legal capacity, taxable ordinary shares only. GBP consideration excludes fees. */
export interface Trade {
  readonly id: string
  readonly securityId: string
  readonly date: string
  readonly side: 'BUY' | 'SELL'
  readonly quantity: string
  readonly considerationGBP: string
  readonly feesGBP: string
}

export interface OpeningPool {
  readonly securityId: string
  readonly asOf: string
  readonly quantity: string
  readonly costGBP: string
}

export interface ReviewedOpeningPool extends OpeningPool {
  readonly caseReference: string
  readonly sourceReference: string
}

export interface Match {
  rule: 'SAME_DAY' | 'THIRTY_DAY' | 'SECTION_104'
  quantity: string
  costGBP: string
  acquisitionDate?: string
  acquisitionIds?: string[]
}

/** Independently rounded display amounts for a disposal group or the whole year. */
export interface SaleBreakdown {
  grossProceedsGBP: string
  sellingCostsGBP: string
  totalAllowableCostsGBP: string | null
  // Gross less selling costs can differ by a penny from the independently rounded net.
  proceedsRoundingAdjustmentGBP: string
}

export const saleBreakdownUnavailable = 'Gross disposal proceeds, selling costs and total allowable costs are unavailable for this saved calculation. Recalculate this year to include them.'

export interface Disposal {
  securityId: string
  date: string
  sourceIds: string[]
  quantity: string
  proceedsGBP: string
  allowableCostGBP: string | null
  saleBreakdown?: SaleBreakdown
  gainGBP: string | null
  unmatchedQuantity: string
  matches: Match[]
}

export const missingAcquisitionGuidance = 'Upload the earlier purchases for these shares so their cost can be matched. Short sales require specialist review.'

export interface CalculationIssue {
  /** A historical basis warning confined to a pool with no sale in the assessed period. */
  scope?: 'pool'
  code: 'MISSING_ACQUISITION_HISTORY' | 'HISTORICAL_SHARE_MATCHING' | 'UNEVIDENCED_HOLDING'
  securityId: string
  date: string
  quantity: string
  message: string
}

export interface PoolMovement {
  securityId: string
  date: string
  kind: 'opening' | 'acquisition' | 'disposal'
  quantityChange: string
  costChangeGBP: string
  quantityAfter: string
  costAfterGBP: string
  sourceIds: string[]
}

export interface AnnualAmounts {
  proceedsGBP: string
  allowableCostsGBP: string
  gainsGBP: string
  lossesGBP: string
  netGainGBP: string
}

export interface Calculation {
  reviewedOpeningPools?: ReviewedOpeningPool[]
  scopeDeclaration?: "personal-uk-resident-v1" | "personal-market-trades-v2" | typeof CURRENT_SCOPE_DECLARATION
  hasLaterSales?: boolean
  engineVersion: string
  status: 'complete' | 'provisional' | 'blocked'
  taxYear: string
  historyThrough: string
  requiredHistoryThrough: string
  poolAsOf: string
  disposals: Disposal[]
  pools: { securityId: string; quantity: string; costGBP: string }[]
  // Earlier saved runs predate this evidence. Report readers verify their inputs before enrichment.
  poolMovements?: PoolMovement[]
  annualBeforeDisposalRounding?: AnnualAmounts
  displayedDisposalTotals?: AnnualAmounts
  ratePeriods?: { from: string; through: string; gainsGBP: string; lossesGBP: string; netGainGBP: string }[]
  issues: CalculationIssue[]
  summary: AnnualAmounts | null
  saleBreakdown?: SaleBreakdown
}
