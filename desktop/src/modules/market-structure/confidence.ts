import type {
  SwingPoint,
  StructureEvent,
  TrendDirection,
  TrendStrength,
  ConsolidationResult,
  MarketStructureConfig,
} from './types'

/**
 * Computes a 0–10 confidence score reflecting how clearly and consistently
 * the structural evidence supports the declared trend.
 *
 * This score measures EVIDENCE ALIGNMENT — not a prediction or probability.
 * It should never be presented as "X% chance of going up."
 *
 * Scoring logic (uses only market structure data, not indicator data):
 *
 *   Bullish trend:
 *     Base: 20 raw points
 *     + 10 per HH in the recent window (max 3)
 *     + 10 per HL in the recent window (max 3)
 *     + 20 if strength = 'strong', +10 if 'moderate'
 *     + 10 per bullish BOS (max 2)
 *     − 20 per CHOCH event (each CHOCH represents counter-trend structure)
 *     − 10 per LH (contradicting evidence, max 2)
 *     − 10 per LL (contradicting evidence, max 2)
 *
 *   Bearish trend (symmetric):
 *     Base: 20 raw points
 *     + 10 per LH, + 10 per LL (max 3 each)
 *     + strength bonus, + 10 per bearish BOS (max 2)
 *     − 20 per CHOCH, − 10 per HH, − 10 per HL (max 2 each)
 *
 *   Ranging:
 *     Base: 30 raw points
 *     + 20 if consolidation is active (range clearly defined)
 *     − 10 if any BOS occurred (structure was broken)
 *
 * Raw points are divided by 10 to produce the final 0–10 scale (matching
 * ENGINE_RULES.md §11 and ARCHITECTURE.md Module 8 spec).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * HORIZON CONSISTENCY
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Every input is measured over EXACTLY the window that determineTrend() used
 * to decide the trend being scored: the last (minSwingsForTrend × 2) labeled
 * swings, and only the structural events that fall at or after the first
 * candle of that window.
 *
 * Previously the swing window here was a hardcoded slice(-10) while
 * determineTrend used slice(-8), and BOS/CHoCH counts were taken over the
 * ENTIRE candle history. Both are incoherent: the confidence in a trend was
 * computed from swings the trend determination never saw, and a CHoCH from
 * 400 candles ago still subtracted 20 raw points from today's score. A
 * confidence-in-X must be measured over X's own horizon.
 */
export function computeConfidence(
  trend: TrendDirection,
  strength: TrendStrength,
  labeledSwings: SwingPoint[],
  bosEvents: StructureEvent[],
  chochEvents: StructureEvent[],
  consolidation: ConsolidationResult,
  config: MarketStructureConfig,
): number {
  // Identical window expression to determineTrend / countRecentStructure.
  const labeled = labeledSwings.filter(s => s.label !== null)
  const recent  = labeled.slice(-(config.minSwingsForTrend * 2))

  const hh = Math.min(recent.filter(s => s.label === 'HH').length, 3)
  const hl = Math.min(recent.filter(s => s.label === 'HL').length, 3)
  const lh = Math.min(recent.filter(s => s.label === 'LH').length, 3)
  const ll = Math.min(recent.filter(s => s.label === 'LL').length, 3)

  // Structural events share the swing window's candle horizon: an event is
  // in-horizon when it occurred at or after the first candle of that window.
  // With no swings in the window there is no horizon, so no event qualifies.
  const horizonStart = recent.length > 0 ? recent[0].index : Number.POSITIVE_INFINITY
  const inHorizon = (e: StructureEvent) => e.index >= horizonStart

  const recentBos   = bosEvents.filter(inHorizon)
  const recentChoch = chochEvents.filter(inHorizon)

  const bullBos = Math.min(recentBos.filter(e => e.direction === 'bullish').length, 2)
  const bearBos = Math.min(recentBos.filter(e => e.direction === 'bearish').length, 2)
  const chochCount = Math.min(recentChoch.length, 3)

  let score = 0

  if (trend === 'bullish') {
    score = 20
    score += hh * 10
    score += hl * 10
    score += strength === 'strong' ? 20 : strength === 'moderate' ? 10 : 0
    score += bullBos * 10
    score -= chochCount * 20
    score -= Math.min(lh, 2) * 10
    score -= Math.min(ll, 2) * 10
  } else if (trend === 'bearish') {
    score = 20
    score += lh * 10
    score += ll * 10
    score += strength === 'strong' ? 20 : strength === 'moderate' ? 10 : 0
    score += bearBos * 10
    score -= chochCount * 20
    score -= Math.min(hh, 2) * 10
    score -= Math.min(hl, 2) * 10
  } else {
    score = 30
    if (consolidation.detected) score += 20
    if (recentBos.length > 0) score -= 10
  }

  return Math.min(10, Math.max(0, score / 10))
}
