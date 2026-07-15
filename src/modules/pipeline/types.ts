import type { Candle, Timeframe, FetchOptions, MarketData } from '../market/types'
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
  /**
   * Module 41 Trade Maturity Score (0–100).
   * Measures how "ready" the setup is — independent of directional bias.
   * Based on momentum alignment, volume participation, trend strength,
   * structure confirmation, and confidence quality.
   * Evidence: immature setups (< 30) had 0% WR in M38/M39 historical validation.
   */
  maturityScore: number
  /** Qualitative label for the maturity score */
  maturityLabel: import('./compute/trade-maturity').MaturityLabel
  /** Per-component breakdown of the maturity score */
  maturityComponents: {
    momentum: number
    volume: number
    trend: number
    structure: number
    confidence: number
  }
  /** Most significant limiting factor; null when score is high */
  maturityPrimaryConcern: string | null
}

// ── Confidence Explanation ─────────────────────────────────────────────────────

/** Structured explanation of what drove the confidence score. */
export interface ConfidenceExplanation {
  /** Top factors that pushed the score higher */
  positiveContributors: Array<{ label: string; detail: string }>
  /** Top factors that pushed the score lower */
  negativeContributors: Array<{ label: string; detail: string }>
  /** One-paragraph rationale tying score, penalties, and quality together */
  rationale: string
}

// ── Market Story ───────────────────────────────────────────────────────────────

/** Deterministic natural-language narrative of current market conditions. */
export interface MarketStory {
  /** Full paragraph joining all active sentences */
  text: string
  /** Individual sentences for layout control */
  sentences: string[]
}

// ── Contradiction Intelligence ─────────────────────────────────────────────────

export type ContradictionSeverity = 'none' | 'minor' | 'moderate' | 'major'

/** Per-category summary of contradicting signals. */
export interface ContradictionCategory {
  /** Category name: Trend | Momentum | Volume | Structure | Support/Resistance | Validation */
  category: string
  severity: ContradictionSeverity
  /** One-line explanation of the contradiction in this category */
  detail: string
}

/** Aggregated contradiction analysis across all signal categories. */
export interface ContradictionIntelligence {
  categories: ContradictionCategory[]
  overallSeverity: ContradictionSeverity
  /** One-sentence human-readable summary */
  summary: string
}

// ── Human Trader Review ────────────────────────────────────────────────────────

export type TraderVerdict =
  | 'Aggressive Buy'
  | 'Conservative Buy'
  | 'Wait'
  | 'Reduce Position'
  | 'Aggressive Sell'
  | 'Conservative Sell'
  | 'Avoid'

/**
 * A deterministic "professional trader" opinion layer.
 * Does NOT replace TradeDecision — it is an additional perspective.
 */
export interface TraderReview {
  verdict: TraderVerdict
  /** 2–4 concise reasoning bullets */
  reasoning: string[]
}

// ── Opportunity vs Market ──────────────────────────────────────────────────────

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor'

/** Separates overall market quality from the current trading opportunity. */
export interface OpportunityAssessment {
  /** How good the market conditions are overall */
  marketQuality: QualityLevel
  marketQualityDetail: string
  /** How good the trading opportunity is right now (none = no setup) */
  tradingOpportunity: QualityLevel | 'none'
  tradingOpportunityDetail: string
  /** One-sentence synthesis comparing market vs opportunity */
  combinedMessage: string
}

// ── Confidence Sanity Audit ────────────────────────────────────────────────────

/** A single suspicious or inconsistent situation detected internally. */
export interface SanityFlag {
  /** Short identifier for the flag type */
  type: string
  /** Human-readable description of the inconsistency */
  description: string
}

/** Internal diagnostic result — no score changes, pure observability. */
export interface ConfidenceSanityResult {
  flags: SanityFlag[]
  hasIssues: boolean
}

// ── Multi-Timeframe Agreement (Module 32 Part 5) ──────────────────────────────

export type MTFAgreementLabel = 'aligned' | 'mostly_aligned' | 'mixed' | 'strong_conflict'

/** Single-timeframe input for the MTF agreement computation. */
export interface MTFTimeframeInput {
  /** Display label, e.g. '15m', '1h', '4h', '1d' */
  label: string
  /** Dominant directional signal for this timeframe */
  direction: 'bullish' | 'bearish' | 'neutral'
  grade: import('../confidence/types').ConfidenceGrade
  /** 0–10 confidence score for this timeframe */
  score: number
}

/**
 * Deterministic multi-timeframe agreement result.
 * Computed from direction + grade, NOT from score averages.
 */
export interface MultiTimeframeAgreement {
  /** Qualitative agreement label */
  agreement: MTFAgreementLabel
  /** 0–10 agreement strength score */
  agreementScore: number
  /** Input timeframes passed through for display */
  timeframes: MTFTimeframeInput[]
  /** The direction that the majority of timeframes agree on */
  dominantDirection: 'bullish' | 'bearish' | 'neutral'
  /** Count of timeframes whose direction directly opposes the dominant direction */
  conflictingCount: number
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
  /** Module 31 — intelligence calibration outputs */
  confidenceExplanation: ConfidenceExplanation
  marketStory: MarketStory
  contradictionIntelligence: ContradictionIntelligence
  traderReview: TraderReview
  opportunityAssessment: OpportunityAssessment
  sanityAudit: ConfidenceSanityResult
  /**
   * Module 32 Part 5 — multi-timeframe agreement.
   * Only populated when the caller provides multiple timeframe results via
   * computeMTFAgreement(). Undefined in single-timeframe pipeline runs.
   */
  multiTimeframeAgreement?: MultiTimeframeAgreement
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
