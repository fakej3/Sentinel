import type { Candle } from '../binance/types'
import type { MarketAnalysisResult } from '../analysis/types'
import type { SupportResistanceResult } from '../support-resistance/types'

/**
 * Extension point interface for future technical analysis modules.
 *
 * Each extension receives the core pipeline outputs it needs and returns
 * a typed result that the pipeline can optionally attach to PipelineResult.
 * Extensions are always optional: their absence never breaks the core flow.
 *
 * @example
 *   // Future Fibonacci module
 *   const fib: AnalysisExtension<FibonacciResult> = {
 *     id: 'fibonacci',
 *     run: (candles, analysis, sr) => computeFibLevels(candles, sr),
 *   }
 */
export interface AnalysisExtension<TResult> {
  readonly id: string
  run(
    candles: Candle[],
    analysis: MarketAnalysisResult,
    supportResistance: SupportResistanceResult,
  ): TResult | Promise<TResult>
}

// ── Fibonacci ─────────────────────────────────────────────────────────────────

export interface FibonacciLevel {
  ratio: number
  label: string
  price: number
  type: 'retracement' | 'extension'
}

export interface FibonacciResult {
  swingHigh: number
  swingLow: number
  direction: 'bullish' | 'bearish'
  retracements: FibonacciLevel[]
  extensions: FibonacciLevel[]
}

// ── Gann ─────────────────────────────────────────────────────────────────────

export interface GannAngle {
  ratio: string
  degreesFromHorizontal: number
  currentPrice: number
  direction: 'up' | 'down'
}

export interface GannSquareLevel {
  value: number
  significance: 'primary' | 'secondary'
}

export interface GannResult {
  squareLevels: GannSquareLevel[]
  angles: GannAngle[]
  cardinalLevels: number[]
}

// ── Smart Money Concepts (SMC) ────────────────────────────────────────────────

export type SMCOrderBlockType = 'bullish' | 'bearish'
export type SMCLiquidityType  = 'buyside' | 'sellside'

export interface SMCOrderBlock {
  type: SMCOrderBlockType
  high: number
  low: number
  mitigated: boolean
  strength: number
}

export interface SMCLiquidityLevel {
  type: SMCLiquidityType
  price: number
  swept: boolean
}

export interface SMCFairValueGap {
  high: number
  low: number
  direction: 'bullish' | 'bearish'
  filled: boolean
}

export interface SMCResult {
  orderBlocks: SMCOrderBlock[]
  liquidityLevels: SMCLiquidityLevel[]
  fairValueGaps: SMCFairValueGap[]
  marketStructureShift: boolean
  changeOfCharacter: boolean
}

// ── Registry ─────────────────────────────────────────────────────────────────

export interface ExtensionRegistry {
  fibonacci?: FibonacciResult
  gann?: GannResult
  smc?: SMCResult
}
