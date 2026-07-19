export type FibDirection = 'bullish' | 'bearish'

export interface FibLevel {
  /** Fibonacci ratio, e.g. 0.618 */
  ratio: number
  /** Computed price at this ratio */
  price: number
  /** Human-readable label, e.g. "0.618" or "1.618 ext" */
  label: string
  /** True for extension levels (ratio > 1.0) */
  isExtension: boolean
  /** True for the 0.618–0.650 golden pocket boundary levels */
  isGoldenPocket: boolean
  /** True when a nearby S/R zone is within confluence tolerance */
  confluence: boolean
  /** Which side of the market the confluent zone is on */
  confluenceType?: 'support' | 'resistance'
}

export interface FibResult {
  /** The dominant swing high used as the range anchor */
  swingHigh: { price: number; timestamp: number }
  /** The dominant swing low used as the range anchor */
  swingLow: { price: number; timestamp: number }
  /** Trend direction inferred from the swing pair ordering */
  direction: FibDirection
  /** All retracement + extension levels, ordered by ratio ascending */
  levels: FibLevel[]
  /** False when there are insufficient swings to compute anything */
  available: boolean
}
