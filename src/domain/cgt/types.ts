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

export interface Match {
  rule: 'SAME_DAY' | 'THIRTY_DAY' | 'SECTION_104'
  quantity: string
  costGBP: string
  acquisitionDate?: string
  acquisitionIds?: string[]
}

export interface Disposal {
  securityId: string
  date: string
  sourceIds: string[]
  quantity: string
  proceedsGBP: string
  allowableCostGBP: string | null
  gainGBP: string | null
  unmatchedQuantity: string
  matches: Match[]
}

export const missingAcquisitionGuidance = 'Upload the earlier purchases for these shares so their cost can be matched.'

export interface CalculationIssue {
  code: 'MISSING_ACQUISITION_HISTORY'
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
  issues: CalculationIssue[]
  summary: AnnualAmounts | null
}
