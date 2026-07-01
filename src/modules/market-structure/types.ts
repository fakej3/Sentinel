export type SwingType = 'high' | 'low'

// Classification of each swing relative to the previous swing of the same type
export type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'EH' | 'EL'

export type TrendDirection = 'bullish' | 'bearish' | 'ranging'
export type TrendStrength = 'strong' | 'moderate' | 'weak'

export type StructureEventType = 'BOS' | 'CHOCH'

export interface SwingPoint {
  /** Position in the input candle array */
  index: number
  /** candle.openTime */
  timestamp: number
  /** candle.high for type='high', candle.low for type='low' */
  price: number
  type: SwingType
  /**
   * Relationship to the previous confirmed dominant swing of the same type.
   * null for the first swing of each type (no predecessor to compare against).
   */
  label: SwingLabel | null
}

/**
 * A discrete market structure event detected in the candle series.
 *
 * BOS   — Break of Structure: price closes beyond a confirmed swing level
 *          in the direction of the established trend (continuation signal).
 *
 * CHOCH — Change of Character: price closes beyond a confirmed swing level
 *          AGAINST the established trend (potential reversal signal; does not
 *          confirm a reversal on its own).
 */
export interface StructureEvent {
  type: StructureEventType
  index: number
  timestamp: number
  /** The structural price level that was breached */
  level: number
  direction: 'bullish' | 'bearish'
}

export interface StructureCounts {
  higherHighs: number
  higherLows: number
  lowerHighs: number
  lowerLows: number
  equalHighs: number
  equalLows: number
}

export interface ConsolidationResult {
  detected: boolean
  /** Highest swing high price within the consolidation window */
  rangeHigh: number | null
  /** Lowest swing low price within the consolidation window */
  rangeLow: number | null
  /** (rangeHigh − rangeLow) / rangeLow × 100 */
  rangePercent: number | null
  /** Number of candles spanned by the consolidation swings */
  barsInRange: number
}

export interface BreakoutResult {
  /** Price has closed outside the consolidation range with volume confirmation */
  confirmed: boolean
  /** A breakout was attempted but then reversed (price returned inside range) */
  failed: boolean
  /** The consolidation boundary level that was broken */
  level: number | null
  direction: 'bullish' | 'bearish' | null
}

export interface PullbackResult {
  detected: boolean
  /**
   * Retracement ratio 0–1 relative to the last BOS range.
   * 0 = price is exactly at the BOS level (no pullback yet).
   * 1 = price has fully retraced to the structural anchor (swing low/high).
   * Values > 1 mean the structural anchor was violated (not a pullback).
   */
  depth: number | null
}

export interface MarketStructureResult {
  /**
   * Structural bias derived solely from swing patterns (HH/HL/LH/LL).
   * This is NOT the full trend defined in ENGINE_RULES.md §1, which also
   * requires EMA alignment, RSI, and MACD. Full trend synthesis is performed
   * by a future Module 6/7 layer that combines outputs from all engines.
   */
  trend: TrendDirection
  strength: TrendStrength
  /**
   * 0–10 evidence alignment score (ENGINE_RULES.md §11).
   * Measures how many and how consistently structural factors align.
   * This is structural confidence only — the full Module 8 score also
   * incorporates indicators, volume, and support/resistance.
   */
  confidence: number
  /**
   * Full lifetime HH/HL/LH/LL counts across all detected swings.
   * USE FOR: historical swing statistics, cumulative counts, audit trails.
   * DO NOT USE for trend condition evaluation — recentStructure covers the same
   * rolling window that determineTrend() inspects, so using this field instead
   * would silently produce wrong trend labels in early or mean-reverting markets.
   */
  structure: StructureCounts
  /**
   * HH/HL/LH/LL counts restricted to the same recent window used by
   * determineTrend() — the last (minSwingsForTrend × 2) labeled swings.
   * USE FOR: hasConsistentHHHL and hasConsistentLHLL trend conditions.
   * Both Module 6 (synthesis) and Module 7 (validation) consume recentStructure
   * for trend condition evaluation. ENGINE_RULES.md §1 (CRIT-01).
   */
  recentStructure: StructureCounts
  bos: {
    detected: boolean
    events: StructureEvent[]
    last: StructureEvent | null
  }
  choch: {
    detected: boolean
    events: StructureEvent[]
    last: StructureEvent | null
  }
  pullback: PullbackResult
  consolidation: ConsolidationResult
  breakout: BreakoutResult
  /** Confirmed dominant swing points with labels, sorted by candle index */
  swings: SwingPoint[]
  /** All structure events (BOS + CHOCH) in chronological order */
  events: StructureEvent[]
  /** Human-readable strings explaining each detected condition */
  evidence: string[]
}

/**
 * All thresholds that govern the market structure engine.
 * Change these to tune detection sensitivity without touching the algorithm.
 */
export interface MarketStructureConfig {
  /**
   * Number of candles required on each side of a pivot candle to confirm a swing.
   * Higher = fewer but more significant swings.
   * ENGINE_RULES.md default: 2
   */
  swingLookback: number

  /**
   * Minimum number of consecutive dominant swing points (without a new HH or LL)
   * required to declare consolidation.
   * ENGINE_RULES.md default: 5
   */
  consolidationSwings: number

  /**
   * Maximum (rangeHigh − rangeLow) / rangeLow × 100 to qualify as consolidation.
   * ENGINE_RULES.md default: 3.0 (%)
   */
  consolidationThreshold: number

  /**
   * Volume must be ≥ this multiple of the 20-period average to confirm a breakout.
   * ENGINE_RULES.md default: 1.3×
   */
  breakoutVolumeMultiplier: number

  /**
   * Minimum number of LABELED swings considered in the trend window.
   * A labeled swing is one that has a HH/HL/LH/LL/EH/EL classification.
   * The actual window size is (minSwingsForTrend × 2) to cover both types.
   */
  minSwingsForTrend: number

  /**
   * Price difference (as % of the reference level) below which two consecutive
   * swing points of the same type are treated as equal rather than directional.
   * E.g., 0.1 means within 0.1% → EH or EL rather than HH/LH or HL/LL.
   */
  equalThreshold: number
}
