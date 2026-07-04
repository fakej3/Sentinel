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
