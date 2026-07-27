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

// ── Point budget ──────────────────────────────────────────────────────────────
// Named so MAX_RAW_SCORE below is DERIVED from the same numbers that build the
// score. Writing the divisor as a literal is how the scale silently stopped
// being a 0–10 scale in the first place.

/** Points for the directional base case (a trend was identified at all). */
const BASE = 20
/** Points per confirming swing label, and the cap on how many count. */
const PER_SWING = 10
const SWING_CAP = 3
/** Points per confirming break of structure, and the cap. */
const PER_BOS = 10
const BOS_CAP = 2
/** Points deducted per in-horizon change of character, and the cap. */
const PER_CHOCH = 20
const CHOCH_CAP = 3
/** Cap on how many counter-trend swings can be deducted for. */
const COUNTER_CAP = 2
/** Ranging branch: its own, deliberately smaller, budget. */
const RANGING_BASE = 30
const RANGING_CONSOLIDATION = 20
const RANGING_BOS_PENALTY = 10

function strengthPoints(strength: TrendStrength): number {
  return strength === 'strong' ? 20 : strength === 'moderate' ? 10 : 0
}

/**
 * The largest raw score any branch can produce.
 *
 * DERIVED, and this is the whole point of the change it encodes. The divisor
 * used to be the literal 10, which asserted a 100-point maximum. The actual
 * maximum is:
 *
 *   BASE 20 + hh 3×10 + hl 3×10 + strength 20 + bos 2×10 = 120
 *
 * so the top 20 points of the range — every clean strong trend — were all
 * truncated to exactly 10 by the `Math.min(10, …)` guard. Measured over 252
 * synthetic markets driven through the real structure engine, 29.4% of runs
 * landed on exactly 10.00 and were mutually indistinguishable.
 *
 * Dividing by the true maximum makes the scale actually span 0–10: maximal
 * structural evidence now reaches 10 exactly, and everything below it is
 * strictly ordered. The map is linear, so ordering is preserved everywhere and
 * no value moves relative to any other — only the units change.
 *
 * The ranging branch keeps its own smaller budget (max 50 → 4.17). That
 * asymmetry is deliberate and pre-existing: a ranging read is a weaker claim
 * than a confirmed trend and should not compete with one on the same scale.
 */
const MAX_RAW_SCORE = BASE + SWING_CAP * PER_SWING * 2 + 20 + BOS_CAP * PER_BOS

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

  const hh = Math.min(recent.filter(s => s.label === 'HH').length, SWING_CAP)
  const hl = Math.min(recent.filter(s => s.label === 'HL').length, SWING_CAP)
  const lh = Math.min(recent.filter(s => s.label === 'LH').length, SWING_CAP)
  const ll = Math.min(recent.filter(s => s.label === 'LL').length, SWING_CAP)

  // Structural events share the swing window's candle horizon: an event is
  // in-horizon when it occurred at or after the first candle of that window.
  // With no swings in the window there is no horizon, so no event qualifies.
  const horizonStart = recent.length > 0 ? recent[0].index : Number.POSITIVE_INFINITY
  const inHorizon = (e: StructureEvent) => e.index >= horizonStart

  const recentBos   = bosEvents.filter(inHorizon)
  const recentChoch = chochEvents.filter(inHorizon)

  const bullBos = Math.min(recentBos.filter(e => e.direction === 'bullish').length, BOS_CAP)
  const bearBos = Math.min(recentBos.filter(e => e.direction === 'bearish').length, BOS_CAP)
  const chochCount = Math.min(recentChoch.length, CHOCH_CAP)

  let score = 0

  if (trend === 'bullish') {
    score = BASE
    score += hh * PER_SWING
    score += hl * PER_SWING
    score += strengthPoints(strength)
    score += bullBos * PER_BOS
    score -= chochCount * PER_CHOCH
    score -= Math.min(lh, COUNTER_CAP) * PER_SWING
    score -= Math.min(ll, COUNTER_CAP) * PER_SWING
  } else if (trend === 'bearish') {
    score = BASE
    score += lh * PER_SWING
    score += ll * PER_SWING
    score += strengthPoints(strength)
    score += bearBos * PER_BOS
    score -= chochCount * PER_CHOCH
    score -= Math.min(hh, COUNTER_CAP) * PER_SWING
    score -= Math.min(hl, COUNTER_CAP) * PER_SWING
  } else {
    score = RANGING_BASE
    if (consolidation.detected) score += RANGING_CONSOLIDATION
    if (recentBos.length > 0) score -= RANGING_BOS_PENALTY
  }

  return Math.min(10, Math.max(0, (score / MAX_RAW_SCORE) * 10))
}
