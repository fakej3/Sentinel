import type { Timeframe } from '../binance/types'
import type { IndicatorResult } from '../indicators/types'
import type { MarketStructureResult } from '../market-structure/types'
import type { PriceZone, SupportResistanceResult } from '../support-resistance/types'
import type {
  VolumeAnalysisResult,
  VolumeClassification,
  AccDistState,
  OBVDirection,
} from '../volume-analysis/types'

// ─── Price Summary ────────────────────────────────────────────────────────────

export interface PriceSummary {
  /** Current close price */
  current: number
  /** 24-hour price change as percentage */
  change24hPercent: number
  /** 24-hour high price */
  high24h: number
  /** 24-hour low price */
  low24h: number
  /** ATR expressed as percentage of current price; null when ATR unavailable */
  atrPercent: number | null
}

// ─── Full Trend ───────────────────────────────────────────────────────────────

/**
 * The authoritative synthesised trend label.
 * Derived by ENGINE_RULES.md §1 from all 5 bullish/bearish conditions.
 * NOT the same as MarketStructureResult.trend (structural bias only).
 */
export type FullTrendLabel =
  | 'strong bullish'
  | 'moderate bullish'
  | 'weak bullish'
  | 'ranging'
  | 'weak bearish'
  | 'moderate bearish'
  | 'strong bearish'

/**
 * Raw boolean results for every condition evaluated in full trend synthesis.
 * Exposed so Module 7 can cross-check every claim without re-deriving it.
 */
export interface TrendConditions {
  // ── Bullish conditions (ENGINE_RULES.md §1)
  priceAboveEMA20: boolean
  priceAboveEMA50: boolean
  priceAboveEMA100: boolean
  priceAboveEMA200: boolean
  /** priceAboveEMA20 && priceAboveEMA50 && priceAboveEMA100 && priceAboveEMA200 */
  priceAboveAllEMAs: boolean
  /** EMA20 > EMA50 > EMA100 > EMA200 */
  emaInBullishOrder: boolean
  /** marketStructure.recentStructure.higherHighs >= 2 && marketStructure.recentStructure.higherLows >= 2 */
  hasConsistentHHHL: boolean
  /** RSI >= rsiBullishMin (default 45) */
  rsiSupportsBullish: boolean
  /** macdLine > signalLine AND histogram > 0 AND histogram > previousHistogram (ENGINE_RULES.md §4) */
  macdBullish: boolean

  // ── Bearish conditions (ENGINE_RULES.md §1)
  priceBelowEMA20: boolean
  priceBelowEMA50: boolean
  priceBelowEMA100: boolean
  priceBelowEMA200: boolean
  /** priceBelowEMA20 && priceBelowEMA50 && priceBelowEMA100 && priceBelowEMA200 */
  priceBelowAllEMAs: boolean
  /** EMA20 < EMA50 < EMA100 < EMA200 */
  emaInBearishOrder: boolean
  /** marketStructure.recentStructure.lowerHighs >= 2 && marketStructure.recentStructure.lowerLows >= 2 */
  hasConsistentLHLL: boolean
  /** RSI <= rsiBearishMax (default 55) */
  rsiSupportsBearish: boolean
  /** macdLine < signalLine AND histogram < 0 AND histogram < previousHistogram (ENGINE_RULES.md §4) */
  macdBearish: boolean

  // ── Neutral conditions (ENGINE_RULES.md §1)
  /** ADX < adxWeakThreshold (default 20) */
  adxBelowWeakThreshold: boolean
  /** RSI in [rsiNeutralLow, rsiNeutralHigh] (default 40–60) */
  rsiInNeutralRange: boolean
  /** No consistent HH-HL or LH-LL pattern */
  noConsistentStructure: boolean
  /** Price is between EMAs without a clear bullish or bearish order */
  priceBetweenEMAsWithoutClearOrder: boolean
}

export interface FullTrendResult {
  trend: FullTrendLabel
  conditions: TrendConditions
  /** Number of the 5 bullish conditions currently satisfied (0–5) */
  bullishConditionsMet: number
  /** Number of the 5 bearish conditions currently satisfied (0–5) */
  bearishConditionsMet: number
  /** Number of the 4 neutral conditions currently satisfied (0–4) */
  neutralConditionsMet: number
}

// ─── EMA Context ─────────────────────────────────────────────────────────────

export type EMALabel = 'above' | 'below' | 'unavailable'

export type EMAAlignmentState =
  | 'bullish_stack'   // EMA20 > EMA50 > EMA100 > EMA200
  | 'bearish_stack'   // EMA20 < EMA50 < EMA100 < EMA200
  | 'mixed'           // at least one EMA available but not in either stack
  | 'unavailable'     // no EMAs computed (insufficient candles)

/** A group of EMAs clustered within emaConfluencePercent of each other */
export interface EMAConfluenceZone {
  /** Which EMA periods are in this cluster */
  emaPeriods: number[]
  centerPrice: number
  low: number
  high: number
}

export interface EMAContextResult {
  priceVsEMA20: EMALabel
  priceVsEMA50: EMALabel
  priceVsEMA100: EMALabel
  priceVsEMA200: EMALabel
  emaAlignment: EMAAlignmentState
  /** Groups of EMAs within confluence distance; empty when fewer than 2 EMAs available */
  confluenceZones: EMAConfluenceZone[]
}

// ─── Indicator Summary ────────────────────────────────────────────────────────

export type RSIClassification =
  | 'oversold'        // < 30
  | 'weak_bearish'    // 30–45
  | 'neutral'         // 45–55
  | 'healthy_bullish' // 55–70
  | 'overbought'      // > 70
  | 'unavailable'

export interface RSIInterpretation {
  value: number | null
  classification: RSIClassification
}

export interface MACDInterpretation {
  histogram: number | null
  bias: 'bullish' | 'bearish' | 'neutral' | 'unavailable'
}

export type ADXTrendStrength =
  | 'weak'        // < 20
  | 'emerging'    // 20–25
  | 'strong'      // 25–40
  | 'very_strong' // 40–60
  | 'extreme'     // > 60
  | 'unavailable'

export interface ADXInterpretation {
  adx: number | null
  trendStrength: ADXTrendStrength
  dominantDirection: 'bullish' | 'bearish' | 'neutral' | 'unavailable'
}

export type BollingerBandwidthState = 'squeeze' | 'normal' | 'expansion'
export type PriceVsBands = 'above_upper' | 'inside' | 'below_lower'

export interface BollingerInterpretation {
  bandwidth: number | null
  bandwidthState: BollingerBandwidthState | 'unavailable'
  priceRelativeToBands: PriceVsBands | 'unavailable'
}

export interface StochRSIInterpretation {
  k: number | null
  d: number | null
  zone: 'overbought' | 'neutral' | 'oversold' | 'unavailable'
}

/**
 * Human-readable interpretations of each technical indicator.
 * VWAP and OBV are in VolumeContextResult (they are volume-derived).
 */
export interface IndicatorSummaryResult {
  rsi: RSIInterpretation
  macd: MACDInterpretation
  adx: ADXInterpretation
  bollinger: BollingerInterpretation
  stochRsi: StochRSIInterpretation
}

// ─── S/R Context ─────────────────────────────────────────────────────────────

export interface SRContextResult {
  /**
   * Distance from current price to nearest support center, as percentage of price.
   * null when no active support exists.
   */
  nearestSupportDistance: number | null
  /**
   * Distance from current price to nearest resistance center, as percentage of price.
   * null when no active resistance exists.
   */
  nearestResistanceDistance: number | null
  /** Price is currently inside a support zone (currentZone?.type === 'support') */
  insideSupport: boolean
  /** Price is currently inside a resistance zone (currentZone?.type === 'resistance') */
  insideResistance: boolean
  /** Nearest support exists and is within supportProximityPercent */
  approachingSupport: boolean
  /** Nearest resistance exists and is within resistanceProximityPercent */
  approachingResistance: boolean
  /** Highest-strength active support zone; null when none exist */
  strongestActiveSupport: PriceZone | null
  /** Highest-strength active resistance zone; null when none exist */
  strongestActiveResistance: PriceZone | null
}

// ─── Volume Context ───────────────────────────────────────────────────────────

export type ClimaxSignalType = 'buying_climax' | 'selling_climax' | 'exhaustion' | 'none'

export interface VolumeContextResult {
  /** relativeVolume.ratio from Module 5 */
  relativeVolume: number
  /** classification from Module 5 */
  volumeClassification: VolumeClassification
  /** volumeConfirmation.confirmed from Module 5 */
  confirmsCurrentMove: boolean
  climaxSignal: ClimaxSignalType
  accDistState: AccDistState
  priceAboveVWAP: boolean
  vwapDistancePercent: number
  respectingVWAP: boolean
  obvDirection: OBVDirection
  obvConfirmingPrice: boolean
  /** 0–10 composite volume strength from Module 5 */
  overallStrength: number
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export type EvidenceImpact = 'high' | 'medium' | 'low'

/**
 * Which upstream module produced the data underlying this evidence item.
 * Must match one of the pass-through fields in MarketAnalysisResult.
 */
export type ModuleSource =
  | 'indicators'
  | 'market_structure'
  | 'support_resistance'
  | 'volume'

/**
 * A single piece of evidence from the analysis.
 *
 * factor names must exactly match ENGINE_RULES.md §14's factor table.
 * Module 8 uses these names to look up point weights.
 *
 * Points are NOT included here — they are Module 8's concern (ADR-017).
 */
export interface EvidenceItem {
  /** Canonical factor name from ENGINE_RULES.md §14 */
  factor: string
  impact: EvidenceImpact
  /** Human-readable description of the evidence */
  description: string
  source: ModuleSource
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AnalysisConfig {
  /**
   * EMAs within this % of each other are considered a confluence zone.
   * ENGINE_RULES.md §5: default 0.5%
   */
  emaConfluencePercent: number
  /**
   * StochRSI K above this level = overbought.
   * ENGINE_RULES.md §10: default 80
   */
  stochRsiOverboughtThreshold: number
  /**
   * StochRSI K below this level = oversold.
   * ENGINE_RULES.md §10: default 20
   */
  stochRsiOversoldThreshold: number
  /**
   * ADX below this = weak/no trend.
   * ENGINE_RULES.md §7: default 20
   */
  adxWeakThreshold: number
  /**
   * ADX above this = strong trend.
   * ENGINE_RULES.md §7: default 25
   */
  adxStrongThreshold: number
  /**
   * RSI below this = neutral range lower bound.
   * ENGINE_RULES.md §1: default 40
   */
  rsiNeutralLow: number
  /**
   * RSI above this = neutral range upper bound.
   * ENGINE_RULES.md §1: default 60
   */
  rsiNeutralHigh: number
  /**
   * RSI >= this value supports the bullish trend condition.
   * ENGINE_RULES.md §1: default 45
   */
  rsiBullishMin: number
  /**
   * RSI <= this value supports the bearish trend condition.
   * ENGINE_RULES.md §1: default 55
   */
  rsiBearishMax: number
  /**
   * Nearest support within this % of current price = "approaching support".
   * Default 2.0%
   */
  supportProximityPercent: number
  /**
   * Nearest resistance within this % of current price = "approaching resistance".
   * Default 2.0%
   */
  resistanceProximityPercent: number
  /**
   * Minimum count of HH AND HL required to satisfy hasConsistentHHHL.
   * ENGINE_RULES.md §1: default 2
   */
  minBullishSwingsForTrend: number
  /**
   * Minimum count of LH AND LL required to satisfy hasConsistentLHLL.
   * ENGINE_RULES.md §1: default 2
   */
  minBearishSwingsForTrend: number
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface MarketAnalysisResult {
  symbol: string
  timeframe: Timeframe
  /** Unix timestamp (ms) when computeAnalysis was called */
  analysedAt: number
  price: PriceSummary
  /**
   * The authoritative synthesised trend (ENGINE_RULES.md §1).
   * This is what modules 7–9 use. Not the same as marketStructure.trend.
   */
  fullTrend: FullTrendResult
  emaContext: EMAContextResult
  indicatorSummary: IndicatorSummaryResult
  srContext: SRContextResult
  volumeContext: VolumeContextResult
  /** Evidence items sorted by impact (high → medium → low) */
  evidence: EvidenceItem[]

  // ── Pass-through raw results for Module 7 validation ──
  indicators: IndicatorResult
  marketStructure: MarketStructureResult
  supportResistance: SupportResistanceResult
  volumeAnalysis: VolumeAnalysisResult
}

// Re-export upstream types used across Module 6 internals
export type {
  VolumeClassification,
  AccDistState,
  OBVDirection,
}
