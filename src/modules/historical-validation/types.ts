import type { Timeframe } from '../market/types'
import type { PipelineConfig } from '../pipeline/types'
import type { TradeSetupQuality } from '../pipeline/types'

// ── Walk Config ───────────────────────────────────────────────────────────────

export interface WalkConfig {
  /** Minimum candles required for a valid pipeline snapshot (default: 50) */
  minCandleCount: number
  /** How many candles to advance between snapshots (default: 10) */
  stepSize: number
  /** How many future candles to scan for TP/SL outcome (default: 20) */
  forwardLookBars: number
  /** Optional pipeline config override */
  pipelineConfig?: Partial<PipelineConfig>
}

export const DEFAULT_WALK_CONFIG: WalkConfig = {
  minCandleCount: 50,
  stepSize: 10,
  forwardLookBars: 20,
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

import type { PipelineResult } from '../pipeline/types'

/** Full pipeline result captured at one point in the historical walk. */
export interface ValidationSnapshot {
  id: string
  symbol: string
  interval: Timeframe
  /** Unix timestamp (ms) of the last candle in this snapshot */
  timestamp: number
  /** Index of the last candle (exclusive) in the source candle array */
  snapshotCandleIndex: number
  /** Complete pipeline result — all modules executed */
  pipeline: PipelineResult
  /** Derived direction from trend for outcome evaluation */
  direction: 'bullish' | 'bearish' | 'neutral'
}

// ── Trade Outcome ─────────────────────────────────────────────────────────────

export type OutcomeResult = 'tp_hit' | 'sl_hit' | 'neither' | 'no_trade'

/** Forward simulation result for one snapshot. */
export interface TradeOutcome {
  snapshotId: string
  result: OutcomeResult
  /** Candles elapsed until TP or SL was hit; null if neither or no_trade */
  barsToOutcome: number | null
  /** Maximum Favorable Excursion — largest favorable price move (absolute price units) */
  mfe: number
  /** MFE as a percentage of entry price */
  mfePct: number
  /** Maximum Adverse Excursion — largest adverse price move (absolute price units) */
  mae: number
  /** MAE as a percentage of entry price */
  maePct: number
  /** RR achieved: tradePlan.riskRewardRatio when TP hit, -1.0 when SL hit, null otherwise */
  actualRR: number | null
  /** Entry price used (midpoint of entry zone); null for no_trade */
  entryPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
}

// ── Record ────────────────────────────────────────────────────────────────────

/** A snapshot paired with its forward outcome. */
export interface ValidationRecord {
  snapshot: ValidationSnapshot
  outcome: TradeOutcome
}

// ── Confidence Calibration Report ─────────────────────────────────────────────

export interface ConfidenceBucket {
  /** e.g. '9-10', '8-9' */
  label: string
  lowerBound: number
  upperBound: number
  totalTrades: number
  wins: number
  losses: number
  inconclusiveCount: number
  /** wins / (wins + losses); null when no resolved trades */
  winRate: number | null
  /** Average planned RR of winning trades */
  averageRR: number | null
  averageMAE: number
  averageMFE: number
}

export interface ConfidenceCalibrationReport {
  buckets: ConfidenceBucket[]
  /** Win rate across ALL resolved trades */
  overallWinRate: number | null
  overallAverageRR: number | null
  /** True if higher confidence buckets have meaningfully higher win rates */
  confidenceCorrelatesWithWins: boolean
  note: string
}

// ── Trust Validation Report ───────────────────────────────────────────────────

export interface TrustTier {
  label: string
  lowerBound: number
  upperBound: number
  totalTrades: number
  wins: number
  losses: number
  /** wins / (wins + losses); null when no resolved trades */
  winRate: number | null
}

export interface TrustValidationReport {
  tiers: TrustTier[]
  /** True if higher trust tiers have meaningfully higher win rates */
  trustCorrelatesWithWins: boolean
  note: string
}

// ── Evidence Report ───────────────────────────────────────────────────────────

export interface EvidenceFactorStats {
  factor: string
  direction: 'bullish' | 'bearish' | 'neutral'
  /** Times this factor appeared across ALL snapshots (deduplicated per snapshot) */
  timesEmitted: number
  /** Of those, how many snapshots had an actionable trade outcome */
  timesWithTrade: number
  wins: number
  losses: number
  /** wins / (wins + losses); null when no resolved trades */
  winRate: number | null
  /** Average planned RR of winning trades that had this factor */
  averageRR: number | null
  /** losses / timesWithTrade; null when no trades */
  falsePositiveRate: number | null
}

export interface EvidenceReport {
  factors: EvidenceFactorStats[]
  /** Factors with resolved trades, sorted by win rate descending */
  rankedByWinRate: EvidenceFactorStats[]
  /** Factors with falsePositiveRate > 0.5 and timesWithTrade >= 5 */
  weakSignals: EvidenceFactorStats[]
}

// ── Trade Plan Report ─────────────────────────────────────────────────────────

export interface TradePlanReport {
  totalSnapshots: number
  actionableCount: number
  tpHitCount: number
  slHitCount: number
  neitherCount: number
  noTradeCount: number
  /** tpHitCount / actionableCount */
  tpHitRate: number | null
  /** slHitCount / actionableCount */
  slHitRate: number | null
  /** wins / (wins + losses) across resolved actionable trades */
  overallWinRate: number | null
  /** Mean of tradePlan.riskRewardRatio across actionable plans */
  averageSetupRR: number | null
  /** Mean of actualRR across resolved trades (excludes null) */
  averageAchievedRR: number | null
  averageMAE: number
  averageMFE: number
  /** Mean bars to resolution across resolved trades */
  averageBarsToOutcome: number | null
  byQuality: Array<{
    quality: TradeSetupQuality
    count: number
    wins: number
    losses: number
    winRate: number | null
    averageRR: number | null
  }>
}

// ── Post Validation Report ────────────────────────────────────────────────────

export interface PostTraceabilityCheck {
  field: string
  expected: string | number | null | boolean
  matched: boolean
  note?: string
}

export interface PostValidationResult {
  snapshotId: string
  publishable: boolean
  bias: 'bullish' | 'bearish' | 'neutral'
  checks: PostTraceabilityCheck[]
  allPass: boolean
  failCount: number
}

export interface PostValidationReport {
  totalChecked: number
  allPassCount: number
  failCount: number
  results: PostValidationResult[]
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardOverallStats {
  totalSnapshots: number
  actionableTradeCount: number
  winCount: number
  lossCount: number
  inconclusiveCount: number
  winRate: number | null
  averageSetupRR: number | null
  averageAchievedRR: number | null
  averageMAE: number
  averageMFE: number
}

export interface CalibrationDashboard {
  symbol: string
  interval: Timeframe
  totalCandlesAnalyzed: number
  generatedAt: number
  overall: DashboardOverallStats
  confidence: ConfidenceCalibrationReport
  trust: TrustValidationReport
  evidence: EvidenceReport
  tradePlan: TradePlanReport
  postValidation: PostValidationReport
  /** Market phases with the highest win rate (requires ≥3 resolved trades per phase) */
  topPerformingPhases: string[]
  /** Market phases with the lowest win rate */
  worstPerformingPhases: string[]
  /** Most common invalidation scenario types observed on SL hits */
  mostCommonFailureReasons: string[]
}
