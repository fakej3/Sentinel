/**
 * Module 26 — Historical Validation Interfaces (types only, no implementation).
 *
 * These types define the shape of prediction tracking and accuracy measurement
 * that a future historical-validation module would implement. No runtime code
 * exists here — the interfaces are declared so dependent types can be written
 * without coupling to a live data store.
 */

/** A prediction made by Sentinel at a point in time. */
export interface HistoricalPrediction {
  id: string
  symbol: string
  timeframe: string
  /** Unix timestamp (ms) when the analysis was run */
  timestamp: number
  /** fullTrend.trend value at time of prediction */
  trend: string
  /** confidence.score at time of prediction */
  confidenceScore: number
  /** decision.label at time of prediction */
  decisionLabel: string
}

/** The measured outcome of a previously recorded prediction. */
export interface PredictionOutcome {
  predictionId: string
  /** Whether the predicted direction proved correct */
  outcome: 'correct' | 'incorrect' | 'partial' | 'unknown'
  /** Percentage price change in the predicted direction after N hours */
  actualDirectionAfterHours: number
  /** Unix timestamp (ms) when this outcome was recorded */
  resolvedAt: number
}

/** Aggregate accuracy statistics for a symbol/timeframe pair. */
export interface AccuracyRecord {
  symbol: string
  timeframe: string
  totalPredictions: number
  correctPredictions: number
  /** Fraction correct: 0–1 */
  accuracy: number
  /** Unix timestamp (ms) of most recent update */
  lastUpdated: number
}

/**
 * Snapshot of the key analytical outputs captured when a prediction was made.
 * Richer than HistoricalPrediction — captures invalidation levels so an accuracy
 * evaluator can detect when the thesis was proven wrong vs. unresolved.
 */
export interface PredictionSnapshot {
  id: string
  symbol: string
  timeframe: string
  timestamp: number
  trend: string
  confidenceScore: number
  decisionLabel: string
  /** Price at the moment the analysis was run */
  priceAtAnalysis: number
  /** Invalidation price level from the trade plan, if available */
  invalidationLevel: number | null
  /** Target price level from the trade plan, if available */
  targetLevel: number | null
  /** Market phase at time of analysis */
  marketPhase: string
  /** Pipeline version that produced this prediction */
  pipelineVersion: string
}

/** The outcome of evaluating a snapshot against subsequent price data. */
export interface PredictionEvaluation {
  snapshotId: string
  /** How many hours after the prediction the outcome was evaluated */
  evaluatedAfterHours: number
  /** Price at evaluation time */
  priceAtEvaluation: number
  /** Whether the predicted direction proved correct at the evaluation horizon */
  directionCorrect: boolean
  /** Percentage price move in the predicted direction */
  priceMovePct: number
  /** Whether the invalidation level was breached before the evaluation horizon */
  invalidationBreached: boolean
  /** Whether the target level was reached before the evaluation horizon */
  targetReached: boolean
  outcome: 'correct' | 'incorrect' | 'partial' | 'invalidated' | 'unknown'
  resolvedAt: number
}

/** Accuracy statistics broken down by confidence tier. */
export interface PredictionAccuracy {
  symbol: string
  timeframe: string
  totalPredictions: number
  correctPredictions: number
  /** Fraction correct: 0–1 */
  accuracy: number
  /** Predictions where invalidation was breached */
  invalidatedCount: number
  /** Accuracy for predictions with confidence score >= 7.0 */
  highConfidenceAccuracy: number | null
  /** Accuracy for predictions with confidence score 4.0–7.0 */
  mediumConfidenceAccuracy: number | null
  /** Accuracy for predictions with confidence score < 4.0 */
  lowConfidenceAccuracy: number | null
  lastUpdated: number
}

/** A rolling window of recent validation data for a symbol. */
export interface ValidationHistory {
  symbol: string
  timeframe: string
  /** Most recent N evaluations, newest first */
  recentEvaluations: PredictionEvaluation[]
  /** Running accuracy over the last 30 predictions */
  rollingAccuracy30: number | null
  /** Running accuracy over the last 10 predictions */
  rollingAccuracy10: number | null
  lastUpdated: number
}
