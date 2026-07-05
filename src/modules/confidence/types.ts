/**
 * Per-category quality rating based on how much evidence exists in that category.
 */
export type EvidenceQualityRating = 'excellent' | 'good' | 'moderate' | 'poor' | 'unavailable'

/**
 * How much evidence we have in each signal category.
 * 'poor' = zero known factors; 'excellent' = 3 or more.
 */
export interface EvidenceQuality {
  trendQuality:    EvidenceQualityRating
  momentum:        EvidenceQualityRating
  volume:          EvidenceQualityRating
  marketStructure: EvidenceQualityRating
  srPositioning:   EvidenceQualityRating
}

/**
 * Measures how many independent signal categories agree with the dominant trend.
 * A higher score means more categories are internally consistent with each other.
 */
export interface ConfluenceResult {
  /** 0–10: strength of multi-category agreement */
  score: number
  /** Category display names that are aligned with the dominant trend */
  agreeing: string[]
  /** Category display names with signals opposing the dominant trend */
  disagreeing: string[]
  /** Fraction of active categories that agree: 0–1 */
  agreementRatio: number
}

/**
 * A cluster of opposing-direction evidence within one signal category.
 */
export interface ContradictionGroup {
  /** Display name of the signal category */
  category: string
  severity: 'strong' | 'moderate' | 'mild'
  /** Human-readable explanation of the contradiction */
  description: string
  /** Canonical factor names in this contradiction cluster */
  factors: string[]
}

/**
 * Context-sensitive modifier describing how reliable each indicator type
 * is under the current market conditions.
 */
export interface IndicatorReliabilityContext {
  /** 0–10: reliability of trend-following signals (EMA, market structure) */
  trendReliability: number
  /** 0–10: reliability of oscillator signals (RSI, MACD, StochRSI) */
  oscillatorReliability: number
  /** 0–10: reliability of volume-based signals */
  volumeReliability: number
  /** One-line explanation of the current reliability context */
  note: string
}

/**
 * Internal 0–10 synthesis of how coherent and complete the analysis is.
 * Combines confluence, evidence breadth, contradiction strength, and indicator reliability.
 */
export interface AnalysisQuality {
  /** 0–10: overall internal quality of the analysis */
  score: number
  /** Multi-category directional agreement */
  confluence: ConfluenceResult
  /** Per-category evidence availability */
  evidenceQuality: EvidenceQuality
  /** Clustered contradictions by category */
  contradictions: ContradictionGroup[]
  /** Context-sensitive indicator reliability */
  reliability: IndicatorReliabilityContext
}

/**
 * Confidence grade — coarse label for the 0–10 score.
 * ENGINE_RULES.md §11.
 */
export type ConfidenceGrade =
  | 'very_strong' // 8.5–10.0
  | 'strong'      // 7.0–8.5
  | 'moderate'    // 5.0–7.0
  | 'mixed'       // 3.0–5.0
  | 'weak'        // 0.0–3.0

/**
 * A single factor that contributed points to the confidence score.
 * Populated for every evidence factor whose canonical name is present
 * in ConfidenceConfig.factorWeights.
 */
export interface ConfidenceReason {
  /** Canonical factor name (ENGINE_RULES.md §14.4) */
  factor: string
  /** Points contributed — positive for bullish factors, negative for bearish */
  points: number
  direction: 'bullish' | 'bearish' | 'neutral'
}

/**
 * Per-component breakdown of what drove the confidence score.
 * Each field is a 0–10 sub-score derived from that category of evidence.
 */
export interface ConfidenceBreakdown {
  /** EMA positioning and alignment evidence */
  trendQuality: number
  /** RSI, MACD, ADX, StochRSI, Bollinger evidence */
  momentum: number
  /** Volume, OBV, VWAP, accumulation/distribution evidence */
  volume: number
  /** Structure events — HH/HL/LH/LL, BOS, CHoCH, breakouts */
  marketStructure: number
  /** Support and resistance positioning evidence */
  srPositioning: number
  /** Strength of evidence opposing the dominant trend (higher = more contradictions) */
  contradictions: number
}

/**
 * A single data-quality or availability check that contributes to the trust score.
 */
export interface TrustFactor {
  label: string
  passed: boolean
  /** Why this factor did not pass; omitted when passed = true */
  note?: string
}

/**
 * Measures how reliable the underlying data and analysis pipeline is,
 * independently of how strong the market signal is.
 */
export interface TrustResult {
  /** 0–100 percentage of trust factors that passed */
  score: number
  level: 'high' | 'medium' | 'low'
  factors: TrustFactor[]
  /** Human-readable list of what reduced trust below 100% */
  reductions: string[]
}

/**
 * A score adjustment applied because of a validation issue or contradiction.
 */
export interface ConfidencePenalty {
  source: 'validation_warning' | 'validation_critical' | 'contradiction'
  description: string
  /** Reduction applied to the normalized 0–10 score */
  scoreReduction: number
}

/**
 * A non-fatal advisory emitted alongside the confidence result.
 */
export interface ConfidenceWarning {
  message: string
  source: 'validation' | 'data_quality'
}

/**
 * The output of Module 8 — Confidence Engine.
 *
 * score and grade represent overall confidence that Sentinel's conclusion is correct.
 * bullishConfidence and bearishConfidence are independent directional sub-scores.
 * breakdown and trust are additive explainability fields.
 */
export interface ConfidenceResult {
  /** Normalized 0–10 confidence score after penalties */
  score: number
  grade: ConfidenceGrade
  /** Normalized 0–10 score for bullish-only evidence factors */
  bullishConfidence: number
  /** Normalized 0–10 score for bearish-only evidence factors */
  bearishConfidence: number
  /**
   * Signed sum of neutral evidence weights.
   * Positive values confirm trend strength (ADX, high relative volume);
   * negative values reduce conviction (consolidation, failed breakout).
   * Applied at half-strength (neutralStrengthFactor) to the directed score
   * in bullish/bearish markets; included at full weight for ranging markets.
   */
  neutralContribution: number
  /** Evidence factors that matched a weight entry in ConfidenceConfig */
  reasons: ConfidenceReason[]
  /** Score reductions applied due to validation issues or contradictions */
  penalties: ConfidencePenalty[]
  /** Non-fatal advisory messages */
  warnings: ConfidenceWarning[]
  /** Per-component breakdown of where the evidence comes from */
  breakdown: ConfidenceBreakdown
  /** Analysis quality assessment — coherence, confluence, and evidence breadth */
  analysisQuality: AnalysisQuality
  /** Data and pipeline quality assessment, independent of signal strength */
  trust: TrustResult
}

/**
 * Configuration for Module 8 — Confidence Engine.
 * All magic numbers live here.
 */
export interface ConfidenceConfig {
  /**
   * Maps canonical factor names (ENGINE_RULES.md §14.4) to point weights.
   * Positive = bullish signal, negative = bearish signal.
   * ENGINE_RULES.md §11.
   */
  factorWeights: Record<string, number>
  /**
   * Raw points are divided by this value to produce the 0–10 score.
   * Equal to the maximum achievable raw points (≈106).
   * ENGINE_RULES.md §11: "scale = min(10, max(0, rawPoints / 10.6))"
   */
  normalizationDivisor: number
  /**
   * When ValidationResult has one or more warnings, each warning reduces
   * the normalized score by this amount.
   * Default: 0.5
   */
  warningScorePenalty: number
  /**
   * When ValidationResult has one or more critical issues, the normalized
   * score is capped at this value regardless of evidence strength.
   * Default: 3.0
   */
  criticalScoreCap: number
  /**
   * Grade boundary thresholds (lower-inclusive).
   * ENGINE_RULES.md §11 score interpretation table.
   */
  gradeThresholds: {
    veryStrong: number // ≥ 8.5
    strong: number     // ≥ 7.0
    moderate: number   // ≥ 5.0
    mixed: number      // ≥ 3.0
    // below mixed → 'weak'
  }
  /**
   * In directional markets (bullish/bearish trend), opposing evidence is penalised
   * by this factor before computing the score.
   * A value of 0.3 means 10 bearish points in a bullish market subtract 3 from the
   * directed bullish points before normalization.
   * Default: 0.3
   */
  contradictionPenaltyFactor: number
  /**
   * Fraction of neutral evidence weight that contributes to the directed score in
   * directional markets. Neutral items (ADX, volume classification, consolidation)
   * confirm or deny trend strength regardless of direction; a value of 0.5 means
   * they contribute at half-strength.
   * Default: 0.5
   */
  neutralStrengthFactor: number
}
