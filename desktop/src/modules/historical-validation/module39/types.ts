/**
 * Module 39 — Trade Intelligence Lab shared types.
 */
import type { ValidationRecord } from '../types'

// ── Loss attribution ──────────────────────────────────────────────────────────

export type LossReason =
  | 'weak_trend'          // trend is weak or ranging at entry
  | 'counter_trend'       // direction opposes dominant trend
  | 'weak_ema'            // EMA stack does not support direction
  | 'weak_structure'      // market structure strength is weak
  | 'weak_volume'         // volume overall strength ≤ 3
  | 'low_rel_volume'      // relative volume < 0.7
  | 'false_breakout'      // breakout confirmed but SL hit quickly
  | 'failed_bos'          // BOS detected but trade lost
  | 'failed_choch'        // CHoCH detected but trade lost
  | 'support_failure'     // bullish trade entered inside support that failed
  | 'resistance_failure'  // bearish trade entered inside resistance that failed
  | 'late_entry'          // entry was late — MAE >> stop distance
  | 'stop_too_tight'      // stop < 0.5% from entry
  | 'target_too_far'      // price barely moved toward target (< 15% of way)
  | 'poor_rr'             // planned RR < 1.5
  | 'low_confidence'      // confidence score < 4.5
  | 'low_trust'           // trader review says Wait / Avoid
  | 'mtf_conflict'        // major internal contradictions detected
  | 'momentum_failure'    // momentum indicators oppose direction
  | 'high_volatility'     // ATR% > 3.5 — unpredictable whipsaw
  | 'low_volatility'      // ATR% < 0.5 — no movement, squeezed
  | 'range_chop'          // market is ranging, no clear trend
  | 'liquidity_sweep'     // very fast SL hit (≤ 3 bars) after briefly reaching MFE
  | 'unknown'             // none of the above apply

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  weak_trend:          'Weak Trend',
  counter_trend:       'Counter Trend',
  weak_ema:            'Weak EMA Alignment',
  weak_structure:      'Weak Market Structure',
  weak_volume:         'Weak Volume',
  low_rel_volume:      'Low Relative Volume',
  false_breakout:      'False Breakout',
  failed_bos:          'Failed BOS',
  failed_choch:        'Failed CHoCH',
  support_failure:     'Support Failure',
  resistance_failure:  'Resistance Failure',
  late_entry:          'Late Entry',
  stop_too_tight:      'Stop Too Tight',
  target_too_far:      'Target Too Far',
  poor_rr:             'Poor R:R',
  low_confidence:      'Low Confidence',
  low_trust:           'Low Trust',
  mtf_conflict:        'MTF Conflict',
  momentum_failure:    'Momentum Failure',
  high_volatility:     'High Volatility',
  low_volatility:      'Low Volatility',
  range_chop:          'Range Chop',
  liquidity_sweep:     'Liquidity Sweep',
  unknown:             'Unknown',
}

// ── Win attribution ───────────────────────────────────────────────────────────

export type WinReason =
  | 'high_confidence'        // score ≥ 7
  | 'high_trust'             // trader review recommends entry
  | 'excellent_setup'        // setup quality is excellent
  | 'aligned_mtf'            // no major contradictions, clean signals
  | 'strong_trend'           // trend label includes 'strong'
  | 'high_volume'            // relVolume ≥ 1.3 and volume strength ≥ 6
  | 'perfect_ema'            // EMA stack matches direction
  | 'strong_structure'       // structure strength is strong + BOS present
  | 'support_bounce'         // bullish entry at/near active support
  | 'resistance_rejection'   // bearish entry at/near active resistance
  | 'strong_momentum'        // RSI + MACD both aligned with direction
  | 'good_rr'                // planned RR ≥ 2.5
  | 'breakout_confirmed'     // breakout structure confirmed
  | 'bos_confirmed'          // break of structure detected and held
  | 'choch_detected'         // change of character — trend shift confirmed
  | 'volume_confirms'        // volume directly confirms the current move
  | 'excellent_opportunity'  // opportunity assessment: excellent

export const WIN_REASON_LABELS: Record<WinReason, string> = {
  high_confidence:       'High Confidence',
  high_trust:            'High Trust',
  excellent_setup:       'Excellent Setup',
  aligned_mtf:           'Aligned MTF',
  strong_trend:          'Strong Trend',
  high_volume:           'High Volume',
  perfect_ema:           'Perfect EMA Stack',
  strong_structure:      'Strong Structure',
  support_bounce:        'Support Bounce',
  resistance_rejection:  'Resistance Rejection',
  strong_momentum:       'Strong Momentum',
  good_rr:               'Good R:R (≥ 2.5)',
  breakout_confirmed:    'Breakout Confirmed',
  bos_confirmed:         'BOS Confirmed',
  choch_detected:        'CHoCH Detected',
  volume_confirms:       'Volume Confirms',
  excellent_opportunity: 'Excellent Opportunity',
}

// ── Attributed record ─────────────────────────────────────────────────────────

export interface AttributedRecord {
  record: ValidationRecord
  /** Multi-label: all loss reasons that apply (sl_hit only) */
  lossReasons: LossReason[]
  /** Multi-label: all win reasons that apply (tp_hit only) */
  winReasons: WinReason[]
}

// ── Filter definition ─────────────────────────────────────────────────────────

export type FilterId =
  | 'low_confidence'   | 'weak_trend'     | 'low_volume'
  | 'low_trust'        | 'counter_trend'  | 'mtf_conflict'
  | 'poor_rr'          | 'weak_structure' | 'weak_ema'
  | 'range'            | 'no_bos'         | 'weak_momentum'
  | 'high_volatility'  | 'low_volatility' | 'poor_setup'
  | 'sanity_issues'

export interface FilterDef {
  id: FilterId
  label: string
  description: string
  /** Returns true to KEEP the trade, false to EXCLUDE it */
  keep: (record: AttributedRecord) => boolean
}

// ── Filter result ─────────────────────────────────────────────────────────────

export interface FilterStats {
  totalRecords: number
  actionableCount: number
  winCount: number
  lossCount: number
  neitherCount: number
  winRate: number | null
  avgSetupRR: number | null
  expectancy: number | null
}

export interface FilterSimulationResult {
  filterId: FilterId
  label: string
  description: string
  before: FilterStats
  after: FilterStats
  winsRemoved: number
  lossesRemoved: number
  /** losses_removed / (wins_removed + losses_removed); null when nothing removed */
  selectivity: number | null
  expectancyDelta: number | null
  /** True if the filter improves expectancy by removing proportionally more losers */
  improvesExpectancy: boolean
}

// ── Feature importance ────────────────────────────────────────────────────────

export interface FeatureImportanceRow {
  feature: string
  label: string
  /** Win rate when feature is in its "positive" state */
  winRateActive: number | null
  /** Sample count when feature is active */
  nActive: number
  /** Win rate when feature is NOT active */
  winRateInactive: number | null
  /** Sample count when inactive */
  nInactive: number
  /** winRateActive / max(0.01, winRateInactive) */
  lift: number | null
  /** lift × log(nActive + 1) — penalises small samples */
  importanceScore: number
}

// ── Combination analysis ──────────────────────────────────────────────────────

export interface FeatureCombination {
  features: string[]
  labels: string[]
  n: number
  wins: number
  losses: number
  winRate: number | null
}

// ── Improvement candidates ────────────────────────────────────────────────────

export interface ImprovementCandidate {
  filterId: FilterId
  label: string
  winsRemoved: number
  lossesRemoved: number
  selectivity: number
  expectancyBefore: number
  expectancyAfter: number
  expectancyDelta: number
  /** 95% Wilson confidence interval for the after win rate */
  ciLow: number | null
  ciHigh: number | null
  evidenceStrength: 'strong' | 'moderate' | 'weak'
  recommendation: string
}

// ── Full module39 output ──────────────────────────────────────────────────────

export interface TradeIntelligenceReport {
  totalRecords: number
  actionableCount: number
  winCount: number
  lossCount: number
  neitherCount: number
  overallWinRate: number | null
  overallExpectancy: number | null

  /** Multi-label loss attribution for all sl_hit records */
  lossAttribution: Array<{ reason: LossReason; label: string; count: number; pct: number }>
  /** Multi-label win attribution for all tp_hit records */
  winAttribution: Array<{ reason: WinReason; label: string; count: number; pct: number }>

  filterSimulations: FilterSimulationResult[]
  featureImportance: FeatureImportanceRow[]

  badCombinations: FeatureCombination[]
  goodCombinations: FeatureCombination[]

  improvementCandidates: ImprovementCandidate[]
}
