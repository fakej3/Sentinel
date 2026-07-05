import type { Candle, Timeframe, FetchOptions, MarketData } from '../binance/types'
import type { IndicatorResult } from '../indicators/types'
import type { MarketStructureResult, MarketStructureConfig } from '../market-structure/types'
import type { SupportResistanceResult, SupportResistanceConfig } from '../support-resistance/types'
import type { VolumeAnalysisResult, VolumeAnalysisConfig } from '../volume-analysis/types'
import type { MarketAnalysisResult, AnalysisConfig } from '../analysis/types'
import type { ValidationResult, ValidationConfig } from '../validation/types'
import type { ConfidenceResult, ConfidenceConfig } from '../confidence/types'
import type { GeneratedAnalysis, WriterConfig } from '../writer/types'
import type { AIConfig } from '../ai/types'

// ── Market Context ─────────────────────────────────────────────────────────────

export type MarketPhase =
  | 'trending_bullish'
  | 'trending_bearish'
  | 'ranging'
  | 'consolidation'
  | 'breakout'
  | 'pullback'
  | 'reversal_attempt'
  | 'distribution'
  | 'accumulation'

/**
 * Classifies the current market phase and volatility environment.
 * Reusable by the writer, trade plan, and any UI component.
 */
export interface MarketContext {
  /** Primary phase classification */
  phase: MarketPhase
  /** Additional phases that also apply (e.g. high_volatility overlapping trending_bullish) */
  secondaryPhases: MarketPhase[]
  /** One-sentence description for display */
  description: string
  /** ATR + Bollinger-based volatility tier */
  volatility: 'high' | 'normal' | 'low'
  /** Whether price is in a directional trend (not ranging or consolidating) */
  isTrending: boolean
}

// ── Invalidation Scenarios ────────────────────────────────────────────────────

export type InvalidationSeverity = 'critical' | 'major' | 'minor'
export type InvalidationType = 'price_level' | 'structure' | 'indicator' | 'volume' | 'validation'

/**
 * A concrete scenario that would prove the current analysis wrong.
 * Data-driven from existing analysis outputs — never generic boilerplate.
 */
export interface InvalidationScenario {
  type: InvalidationType
  severity: InvalidationSeverity
  description: string
}

// ── Decision Explanation ──────────────────────────────────────────────────────

export type DecisionDimensionStatus =
  | 'strongly_supports'
  | 'supports'
  | 'neutral'
  | 'opposes'
  | 'strongly_opposes'

/** Assessment of a single analytical dimension that contributed to the decision. */
export interface DecisionDimension {
  name: string
  status: DecisionDimensionStatus
  detail: string
}

/**
 * Structured explanation of why a decision was made and what would change it.
 * Reusable by the writer, UI, and any future output layer.
 */
export interface DecisionExplanation {
  /** Per-dimension status breakdown */
  dimensions: DecisionDimension[]
  /** Conditions that would shift the decision to neutral/ranging */
  flipToNeutral: string[]
  /** Conditions that would flip the decision to the opposite direction */
  flipToOpposite: string[]
}

// ── Decision Quality ──────────────────────────────────────────────────────────

/**
 * Internal quality score for the trade decision.
 * Evaluates clarity, agreement, contradictions, risk, and signal cleanliness.
 * NOT intended for direct UI display — used to improve recommendation quality.
 */
export interface DecisionQuality {
  /** 0–10 composite quality score */
  score: number
  /** How clear the directional signal is (0–10) */
  clarity: number
  /** Multi-category agreement strength from confluence engine (0–10) */
  agreement: number
  /** Penalty from opposing evidence (0–10; higher = more contradictions) */
  contradictionPenalty: number
  /** Penalty from validation issues (0–10) */
  riskPenalty: number
  /** Indicator signal cleanliness — penalised for extremes and unavailable data (0–10) */
  signalCleanliness: number
}

// ── Trade Decision ─────────────────────────────────────────────────────────────

export type TradeDecisionLabel =
  | 'Strong Buy'
  | 'Buy'
  | 'Cautious Buy'
  | 'Watch'
  | 'Neutral'
  | 'Cautious Sell'
  | 'Sell'
  | 'Strong Sell'

export interface TradeDecision {
  label: TradeDecisionLabel
  /** 3–5 concise reasons supporting the label */
  reasons: string[]
  riskLevel: 'Low' | 'Medium' | 'High'
  /** Mirrors confidence.score for convenience */
  confidence: number
  /** Structured per-dimension explanation and flip scenarios */
  explanation: DecisionExplanation
  /** Internal quality score — not for direct display */
  quality: DecisionQuality
}

/**
 * Overall quality assessment of the trade setup.
 * Determines whether Sentinel presents actionable levels or a "no trade" message.
 *
 * excellent — RR ≥ 2.0, confidence ≥ 7.5, trust ≥ 70 — all conditions met
 * good      — RR ≥ 1.5, confidence ≥ 5.0
 * average   — RR ≥ 1.5 but lower confidence — marginal, proceed with care
 * poor      — confidence or trust too low for a clear setup
 * avoid     — RR < 1.5 or geometry invalid — not actionable
 * no_setup  — insufficient S/R data to compute a plan
 */
export type TradeSetupQuality = 'excellent' | 'good' | 'average' | 'poor' | 'avoid' | 'no_setup'

/**
 * Actionable trade plan derived from S/R context, trend, and confidence.
 * All price levels are in the same currency unit as the market data.
 */
export interface TradePlan {
  /** Price zone to target for entry — null when insufficient S/R data */
  entryZone: { lower: number; upper: number } | null
  /** Level at which the thesis is invalidated — null when S/R is unavailable */
  invalidationLevel: number | null
  /** Price target level (nearest S/R on the opposite side) */
  targetLevel: number | null
  /**
   * Risk/reward ratio computed from the entry zone midpoint, not current price.
   * risk   = |entryMid − invalidationLevel|
   * reward = |targetLevel − entryMid|
   * null when entry, stop, or target are unavailable.
   */
  riskRewardRatio: number | null
  /** Setup quality classification — governs whether levels are displayed */
  setupQuality: TradeSetupQuality
  /** Human-readable explanation of why this quality was assigned */
  setupQualityReason: string
  /** True when the setup meets minimum quality to present actionable levels */
  actionable: boolean
  /** Contextual guidance — always shown, even when not actionable */
  patienceMessage: string
}

export type PipelineErrorCode =
  | 'fetch_failure'
  | 'insufficient_candles'
  | 'validation_failure'
  | 'internal_module_failure'
  | 'configuration_error'

export interface PipelineTimings {
  fetch: number
  indicators: number
  marketStructure: number
  supportResistance: number
  volume: number
  analysis: number
  validation: number
  confidence: number
  writer: number
  aiEnhancement?: number
  total: number
}

export interface PipelineMetadata {
  symbol: string
  interval: Timeframe
  candleCount: number
  timestamp: number
  executionTime: number
  version: string
  timings: PipelineTimings
}

export interface PipelineResult {
  candles: Candle[]
  indicators: IndicatorResult
  marketStructure: MarketStructureResult
  supportResistance: SupportResistanceResult
  volumeAnalysis: VolumeAnalysisResult
  analysis: MarketAnalysisResult
  validation: ValidationResult
  confidence: ConfidenceResult
  decision: TradeDecision
  tradePlan: TradePlan
  /** Current market phase and volatility classification */
  marketContext: MarketContext
  /** Concrete scenarios that would invalidate the current analysis */
  invalidationScenarios: InvalidationScenario[]
  generatedAnalysis: GeneratedAnalysis
  metadata: PipelineMetadata
}

export interface PipelineConfig {
  minCandleCount: number
  marketStructure: Partial<MarketStructureConfig>
  supportResistance: Partial<SupportResistanceConfig>
  volumeAnalysis: Partial<VolumeAnalysisConfig>
  analysis: Partial<AnalysisConfig>
  validation: Partial<ValidationConfig>
  confidence: Partial<ConfidenceConfig>
  writer: Partial<WriterConfig>
  /** Optional AI enhancement config. When omitted or apiKey is empty, Stage 10 is skipped. */
  ai?: Partial<AIConfig>
}

export type FetchFn = (
  symbol: string,
  timeframe: Timeframe,
  options: FetchOptions,
) => Promise<MarketData>

export interface PipelineOptions {
  symbol: string
  interval: Timeframe
  candleLimit?: number
  config?: Partial<PipelineConfig>
  fetchImpl?: FetchFn
}
