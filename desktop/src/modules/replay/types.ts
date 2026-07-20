import type { Candle, Timeframe } from '../market/types'
import type { PipelineResult, PipelineConfig } from '../pipeline/types'

/** Minimum candle count before replay can produce a valid frame */
export const REPLAY_MIN_CANDLES = 50

// ── Engine ─────────────────────────────────────────────────────────────────────

export interface ReplayEngineOptions {
  symbol: string
  interval: Timeframe
  /** Full candle dataset — the engine will never expose future candles */
  candles: Candle[]
  config?: Partial<PipelineConfig>
  /** Starting index (0-based). Defaults to REPLAY_MIN_CANDLES - 1 */
  startIndex?: number
}

/** A single pipeline output at a specific replay position */
export interface ReplayFrame {
  /** 0-based index of the last visible candle at this step */
  index: number
  /** openTime (ms) of the current (last visible) candle */
  candleTimestamp: number
  /** Slice allCandles[0..index] inclusive — no future data */
  candles: Candle[]
  /** Full pipeline result computed on this candle slice */
  result: PipelineResult
}

// ── Playback ──────────────────────────────────────────────────────────────────

export type PlaybackSpeed = 0.5 | 1 | 2 | 5 | 10 | 20

// ── Trade Tracking ────────────────────────────────────────────────────────────

export type TradeDirection = 'bullish' | 'bearish'
export type TradeOutcome = 'tp_hit' | 'sl_hit' | 'open'

export interface TrackedTrade {
  id: string
  direction: TradeDirection
  /** Replay candle index when the setup was first detected */
  detectedAtIndex: number
  detectedTimestamp: number

  entryZoneLower: number
  entryZoneUpper: number
  /** Mid-point of entry zone */
  entryMid: number
  stopLoss: number
  takeProfit: number
  riskRewardRatio: number | null

  confidence: number
  setupQuality: string
  trend: string

  // Outcome tracking
  outcome: TradeOutcome
  /** Candle index at which TP or SL was hit (null if still open) */
  exitIndex: number | null
  exitPrice: number | null
  exitTimestamp: number | null

  /** Maximum Favorable Excursion from entryMid (price units) */
  mfe: number
  /** Maximum Adverse Excursion from entryMid (price units, positive) */
  mae: number
  /** Candles from detection to exit (null if open) */
  durationCandles: number | null
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export type SignalType = 'buy' | 'sell' | 'wait'

export interface TimelineEntry {
  index: number
  candleTimestamp: number
  signal: SignalType
  confidence: number
  setupQuality: string
  /** True when a new unique trade setup was opened at this step */
  newTrade: boolean
  tradeId: string | null
}

// ── Statistics ────────────────────────────────────────────────────────────────

export interface ConfidenceBucket {
  label: string
  minConfidence: number
  maxConfidence: number
  count: number
  wins: number
  winRate: number
}

export interface ReplayStats {
  totalTrades: number
  wins: number
  losses: number
  openTrades: number
  winRate: number
  avgRR: number
  avgHoldTimeCandles: number
  avgConfidence: number
  avgMFE: number
  avgMAE: number
  tpPercent: number
  slPercent: number
  openPercent: number
  confidenceBuckets: ConfidenceBucket[]
  qualityDistribution: Record<string, number>
}

// ── Snapshots (Comparison Mode) ────────────────────────────────────────────────

export interface ReplaySnapshot {
  id: string
  label: string
  symbol: string
  interval: string
  createdAt: number
  totalFrames: number
  timeline: TimelineEntry[]
  trades: TrackedTrade[]
  stats: ReplayStats
}
