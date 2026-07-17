/**
 * Module 41 — Trade Maturity Score (0–100)
 *
 * Measures how "ready" a setup is for entry — independent of directional bias.
 * A high directional confidence does not guarantee a mature setup; price must also
 * have the right momentum, volume participation, trend strength, and structure
 * confirmation before entry is appropriate.
 *
 * Components and weights derived from Module 38/39 historical validation:
 *   Momentum (0–25)  — MACD+RSI lift=1.066–1.074 vs inactive; 80% of losses had momentum failure
 *   Volume   (0–20)  — OBV confirming is the #1 feature by lift (1.175); 20% of losses had low relVol
 *   Trend    (0–20)  — 70–80% of losses had weak/ranging trend; "ignore weak trend" +2.89 expectancy delta
 *   Structure(0–20)  — CHoCH lift=1.102 (93.3% vs 84.6%); 80% of losses had failed CHoCH
 *   Confidence(0–15) — Confidence ≥ 8.5 lift=1.090 (96.7% vs 88.7%)
 *
 * Tier mapping (evidence: wins avg=59.9, losses avg=47.6):
 *   0–29  Immature   — 0% WR in historical data; block actionable trade
 *   30–44 Early      — 75% WR; patience message caution
 *   45–59 Developing — 94.5% WR, highest expectancy tier
 *   60–74 Mature     — 93.6% WR
 *   75–100 Peak      — 100% WR but lower avgRR (more conservative setups)
 */
import type { MarketAnalysisResult } from '../../analysis/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { ConfidenceResult } from '../../confidence/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MaturityLabel = 'immature' | 'early' | 'developing' | 'mature' | 'peak'

export interface MaturityComponents {
  /** MACD + RSI alignment with trade direction (0–25) */
  momentum: number
  /** OBV direction, relative volume level, and move confirmation (0–20) */
  volume: number
  /** Trend strength tier — strong/moderate/weak/ranging (0–20) */
  trend: number
  /** Structure quality — CHoCH, BOS, and strength rating (0–20) */
  structure: number
  /** Confidence score tier (0–15) */
  confidence: number
}

export interface TradeMaturityResult {
  /** 0–100 composite readiness score */
  score: number
  label: MaturityLabel
  components: MaturityComponents
  /**
   * The single largest factor limiting readiness.
   * Null when the score is high enough that no single factor dominates.
   */
  primaryConcern: string | null
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const MATURITY_LABEL_DISPLAY: Record<MaturityLabel, string> = {
  immature:   'Immature',
  early:      'Early',
  developing: 'Developing',
  mature:     'Mature',
  peak:       'Peak',
}

// ── Computation ───────────────────────────────────────────────────────────────

/**
 * Compute the Trade Maturity Score.
 *
 * Accepts the three pipeline sub-results that contain the required signals.
 * Does NOT require the full PipelineResult to remain usable from computeTradePlan.
 */
export function computeTradeMaturity(
  analysis: MarketAnalysisResult,
  marketStructure: MarketStructureResult,
  confidence: ConfidenceResult,
): TradeMaturityResult {
  const { fullTrend, indicatorSummary, volumeContext } = analysis
  const trend = fullTrend.trend
  const dir = trend.includes('bullish') ? 'bullish'
    : trend.includes('bearish') ? 'bearish'
    : 'neutral'

  // ── Momentum (0–25) ───────────────────────────────────────────────────────
  // Evidence: 80% of losses had momentum_failure (RSI or MACD opposing direction).
  // Feature lift: MACD aligned 1.103, RSI favorable 1.016. Full alignment lifts most.
  const rsiClass = indicatorSummary.rsi.classification
  const macdBias = indicatorSummary.macd.bias
  const rsiFav = dir === 'bullish' ? (rsiClass === 'healthy_bullish' || rsiClass === 'oversold')
    : dir === 'bearish' ? (rsiClass === 'weak_bearish' || rsiClass === 'overbought')
    : false
  const macdFav = dir === 'bullish' ? macdBias === 'bullish'
    : dir === 'bearish' ? macdBias === 'bearish'
    : false
  const momentum = rsiFav && macdFav ? 25
    : macdFav ? 15
    : rsiFav ? 10
    : 0

  // ── Volume (0–20) ─────────────────────────────────────────────────────────
  // Evidence: OBV confirming = #1 feature by lift (1.175). WR 94% vs 80% when absent.
  // Low relVol (< 0.7) appears in 20% of losses.
  const obvConfirms = volumeContext.obvConfirmingPrice
  const relVol      = volumeContext.relativeVolume
  const volConfirms = volumeContext.confirmsCurrentMove
  const highRelVol  = relVol >= 1.3
  const lowRelVol   = relVol < 0.7
  let volume = 0
  if (obvConfirms && highRelVol && volConfirms)  volume = 20
  else if (obvConfirms && volConfirms)            volume = 15
  else if (obvConfirms)                           volume = 10
  else if (volConfirms)                           volume = 8
  if (lowRelVol) volume = Math.max(0, volume - 5)

  // ── Trend Maturity (0–20) ─────────────────────────────────────────────────
  // Evidence: 70–80% of losses had weak/ranging trend. "Ignore weak trend" +2.89 expectancy.
  // Lift: trend ≥ moderate 1.085 (97% vs 89%).
  const trendPts = trend.includes('strong') ? 20
    : trend.includes('moderate') ? 14
    : trend.includes('weak') ? 5
    : 0 // ranging

  // ── Structure Readiness (0–20) ────────────────────────────────────────────
  // Evidence: CHoCH lift=1.102 (93.3% vs 84.6%); 80% of losses had failed_choch.
  // Weak structure appears in 50% of losses.
  const hasCHoCH  = marketStructure.choch.detected
  const hasBOS    = marketStructure.bos.detected
  const msStrong  = marketStructure.strength === 'strong'
  let structure = 0
  if (hasCHoCH && msStrong)  structure = 20
  else if (hasCHoCH)         structure = 16
  else if (hasBOS && msStrong) structure = 14
  else if (hasBOS)           structure = 10
  else if (marketStructure.strength === 'weak') structure = 0
  else                       structure = 5

  // ── Confidence (0–15) ────────────────────────────────────────────────────
  // Evidence: confidence ≥ 8.5 lift=1.090 (96.7% vs 88.7%).
  const confPts = confidence.score >= 8.5 ? 15
    : confidence.score >= 7.0 ? 10
    : confidence.score >= 5.0 ? 5
    : 0

  const score = momentum + volume + trendPts + structure + confPts

  // ── Label ─────────────────────────────────────────────────────────────────
  const label: MaturityLabel = score >= 75 ? 'peak'
    : score >= 60 ? 'mature'
    : score >= 45 ? 'developing'
    : score >= 30 ? 'early'
    : 'immature'

  // ── Primary concern ───────────────────────────────────────────────────────
  // Surface the single largest gap so patience messages and posts are specific.
  const gaps: Array<{ name: string; gap: number }> = [
    { name: 'momentum confirmation missing (RSI and MACD not aligned)', gap: 25 - momentum },
    { name: 'volume participation absent (OBV not confirming move)',     gap: 20 - volume   },
    { name: 'trend is weak or ranging',                                  gap: 20 - trendPts },
    { name: 'structure is unconfirmed (no CHoCH or BOS)',               gap: 20 - structure },
    { name: 'confidence score is low',                                   gap: 15 - confPts  },
  ]
  gaps.sort((a, b) => b.gap - a.gap)
  const primaryConcern = gaps[0].gap >= 8 ? gaps[0].name : null

  return {
    score,
    label,
    components: { momentum, volume, trend: trendPts, structure, confidence: confPts },
    primaryConcern,
  }
}
