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
 * A score adjustment applied because of a validation issue.
 */
export interface ConfidencePenalty {
  source: 'validation_warning' | 'validation_critical'
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
 * score and grade represent the overall evidence quality.
 * bullishConfidence and bearishConfidence are independent directional
 * sub-scores useful for showing "X% bullish case vs Y% bearish case."
 */
export interface ConfidenceResult {
  /** Normalized 0–10 confidence score after penalties */
  score: number
  grade: ConfidenceGrade
  /** Normalized 0–10 score for bullish-only evidence factors */
  bullishConfidence: number
  /** Normalized 0–10 score for bearish-only evidence factors */
  bearishConfidence: number
  /** Evidence factors that matched a weight entry in ConfidenceConfig */
  reasons: ConfidenceReason[]
  /** Score reductions applied due to validation issues */
  penalties: ConfidencePenalty[]
  /** Non-fatal advisory messages */
  warnings: ConfidenceWarning[]
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
}
