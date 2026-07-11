import type { Candle, Timeframe } from '../binance/types'
import type { WalkConfig, CalibrationDashboard } from './types'
import { DEFAULT_WALK_CONFIG } from './types'
import { walkCandles } from './walk'
import { buildDashboard } from './dashboard'

// ── Public types ───────────────────────────────────────────────────────────────

export type {
  WalkConfig,
  ValidationSnapshot,
  TradeOutcome,
  OutcomeResult,
  ValidationRecord,
  ConfidenceBucket,
  ConfidenceCalibrationReport,
  TrustTier,
  TrustValidationReport,
  EvidenceFactorStats,
  EvidenceReport,
  TradePlanReport,
  PostTraceabilityCheck,
  PostValidationResult,
  PostValidationReport,
  DashboardOverallStats,
  CalibrationDashboard,
} from './types'
export { DEFAULT_WALK_CONFIG } from './types'

// ── Lower-level exports ────────────────────────────────────────────────────────

export { simulateOutcome } from './outcome'
export { walkCandles } from './walk'
export {
  buildConfidenceCalibrationReport,
  buildTrustValidationReport,
  buildEvidenceReport,
  buildTradePlanReport,
  buildPostValidationReport,
} from './reports'
export { buildDashboard } from './dashboard'
export { generateTextReport } from './text-report'

// ── Top-level API ──────────────────────────────────────────────────────────────

/**
 * Run the full historical validation on a candle history.
 *
 * Steps through candles using a sliding window, runs the complete production
 * pipeline at each step, simulates forward outcomes (TP/SL/MFE/MAE), and
 * produces a CalibrationDashboard with confidence, trust, evidence, trade-plan,
 * and post-traceability reports.
 *
 * Constraints:
 *   - Deterministic: identical candles → identical dashboard every run
 *   - No AI, no randomness, no hardcoded outcomes
 *   - No database, no persistence, no networking
 *   - Steps where the pipeline fails are silently skipped (degenerate data)
 */
export async function runHistoricalValidation(
  symbol: string,
  interval: Timeframe,
  candles: Candle[],
  config?: Partial<WalkConfig>,
): Promise<CalibrationDashboard> {
  const cfg: WalkConfig = {
    minCandleCount: config?.minCandleCount ?? DEFAULT_WALK_CONFIG.minCandleCount,
    stepSize:        config?.stepSize        ?? DEFAULT_WALK_CONFIG.stepSize,
    forwardLookBars: config?.forwardLookBars ?? DEFAULT_WALK_CONFIG.forwardLookBars,
    pipelineConfig:  config?.pipelineConfig,
  }

  const records = await walkCandles(symbol, interval, candles, cfg)
  return buildDashboard(records, symbol, interval, candles.length)
}
