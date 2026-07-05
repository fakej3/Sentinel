/**
 * Module 31 Part 7 — Calibration Framework
 * Interfaces only. No database, no persistence, no networking.
 * These types define the architecture for future outcome tracking.
 */

import type { ConfidenceGrade, ConfidenceResult } from '../confidence/types'
import type { TradeDecisionLabel } from '../pipeline/types'

/**
 * A snapshot of analysis state at prediction time.
 * Captures the minimal fields needed to evaluate accuracy later.
 */
export interface CalibrationSnapshot {
  /** Unique identifier for this snapshot (e.g. `${symbol}-${interval}-${timestamp}`) */
  id: string
  symbol: string
  interval: string
  timestamp: number
  /** Confidence score at prediction time */
  predictedScore: number
  /** Grade at prediction time */
  predictedGrade: ConfidenceGrade
  /** Decision label at prediction time */
  predictedDecision: TradeDecisionLabel
  /** Direction inferred from the decision label */
  predictedDirection: 'bullish' | 'bearish' | 'neutral'
}

/**
 * Records the actual market outcome relative to a prior CalibrationSnapshot.
 */
export interface OutcomeRecord {
  /** Must match a CalibrationSnapshot.id */
  snapshotId: string
  /** Unix ms when the outcome was recorded */
  recordedAt: number
  /** Actual price change % over the measurement window */
  priceChangePct: number
  /** Whether the predicted direction was correct */
  directionCorrect: boolean
  /** Number of candles / time elapsed since the snapshot */
  barsElapsed: number
  /** Optional: how the trade would have performed at predicted entry/stop/target */
  tradePnlPct?: number
}

/**
 * Aggregated accuracy statistics for a given filter (symbol, interval, grade, etc.).
 */
export interface CalibrationStats {
  /** Total snapshots with recorded outcomes */
  totalSamples: number
  /** Fraction where predicted direction was correct (0–1) */
  directionalAccuracy: number
  /** Mean absolute prediction error on confidence score */
  meanScoreError: number
  /** By-grade accuracy breakdown */
  byGrade: Record<ConfidenceGrade, {
    samples: number
    directionalAccuracy: number
  }>
}

/**
 * Top-level calibration framework interface.
 * Implementations are responsible for persistence and retrieval.
 * This interface defines the contract only.
 */
export interface CalibrationFramework {
  /** Record a new analysis snapshot for future outcome tracking */
  recordSnapshot(result: { confidence: ConfidenceResult; symbol: string; interval: string }): CalibrationSnapshot

  /** Record the actual market outcome for a prior snapshot */
  recordOutcome(snapshotId: string, outcome: Omit<OutcomeRecord, 'snapshotId'>): void

  /** Compute aggregated statistics for all snapshots with outcomes */
  computeStats(filter?: { symbol?: string; interval?: string; grade?: ConfidenceGrade }): CalibrationStats
}
