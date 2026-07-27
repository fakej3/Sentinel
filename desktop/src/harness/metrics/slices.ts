/**
 * Partitions of the observation corpus.
 *
 * A single overall number hides everything interesting. The engine may work in
 * a trend and fail in a range; on one symbol and not another; at 4 bars and not
 * at 48. These partitions exist to make that visible.
 *
 * A NOTE ON THE VOLATILITY AND ADX SPLITS. Two of these regimes are defined
 * relative to the corpus median rather than an absolute threshold. That uses
 * the whole sample to draw the boundary, which would be look-ahead if the
 * boundary were part of a trading rule. It is not: these are DESCRIPTIVE
 * partitions answering "where does Sentinel work", computed after the fact on
 * data already recorded without look-ahead. Nothing here feeds a prediction.
 * The distinction is stated because conflating the two is how a "regime filter"
 * ends up with a backtest it can never reproduce live.
 */
import type { Observation } from '../types'

export interface Slice {
  readonly dimension: string
  readonly slice: string
  readonly observations: readonly Observation[]
}

function group(
  observations: readonly Observation[],
  dimension: string,
  key: (o: Observation) => string | null,
): Slice[] {
  const map = new Map<string, Observation[]>()
  for (const o of observations) {
    const k = key(o)
    if (k === null) continue
    const bucket = map.get(k)
    if (bucket === undefined) map.set(k, [o]); else bucket.push(o)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([slice, obs]) => ({ dimension, slice, observations: obs }))
}

/** Median of a feature across the corpus, or null when too few observations carry it. */
function featureMedian(observations: readonly Observation[], feature: string): number | null {
  const vs: number[] = []
  for (const o of observations) {
    const v = o.features[feature]
    if (typeof v === 'number' && Number.isFinite(v)) vs.push(v)
  }
  if (vs.length < 2) return null
  vs.sort((a, b) => a - b)
  const h = (vs.length - 1) / 2
  const lo = Math.floor(h)
  return vs[lo] + (h - lo) * (vs[Math.ceil(h)] - vs[lo])
}

/**
 * ADX threshold separating a trending market from a non-trending one.
 *
 * PROVENANCE: industry convention, and the engine's own. Wilder's original
 * reading of ADX puts 25 as the boundary above which a trend is considered
 * present; `DEFAULT_ANALYSIS_CONFIG.adxWeakThreshold` encodes the same idea.
 * Using the engine's threshold means a "strong trend" slice contains exactly
 * the bars the engine itself would call trending.
 */
export const ADX_TREND_THRESHOLD = 25

export interface SliceOptions {
  /** Slices smaller than this are dropped: a metric on 12 observations is noise. */
  readonly minSliceCount?: number
}

/**
 * Every partition of the corpus.
 *
 * `overall` is always first, so a report can be read top-down. Every other
 * dimension is a refinement of it, and each observation appears exactly once
 * per dimension — the partitions are within-dimension exhaustive and disjoint,
 * which is what makes the per-dimension counts add back to the total.
 */
export function buildSlices(
  observations: readonly Observation[],
  options: SliceOptions = {},
): Slice[] {
  const minSliceCount = options.minSliceCount ?? 30
  const out: Slice[] = [{ dimension: 'overall', slice: 'all', observations }]

  out.push(...group(observations, 'symbol', o => o.symbol))
  out.push(...group(observations, 'timeframe', o => o.timeframe))
  out.push(...group(observations, 'trend', o => o.categorical.trend))
  out.push(...group(observations, 'grade', o => o.categorical.grade))
  out.push(...group(observations, 'setup_quality', o => o.categorical.setup_quality))
  out.push(...group(observations, 'direction', o => o.categorical.direction))
  out.push(...group(observations, 'ms_trend', o => o.categorical.ms_trend))

  // ── Regimes ───────────────────────────────────────────────────────────────
  out.push(...group(observations, 'regime_structure', o =>
    o.categorical.trend === 'ranging' ? 'ranging' : 'trending'))

  out.push(...group(observations, 'regime_trend_strength', o => {
    const adx = o.features.adx
    if (typeof adx !== 'number' || !Number.isFinite(adx)) return null
    return adx >= ADX_TREND_THRESHOLD ? `strong trend (ADX>=${ADX_TREND_THRESHOLD})` : `weak trend (ADX<${ADX_TREND_THRESHOLD})`
  }))

  const atrMedian = featureMedian(observations, 'atr_pct')
  if (atrMedian !== null) {
    out.push(...group(observations, 'regime_volatility', o => {
      const v = o.features.atr_pct
      if (typeof v !== 'number' || !Number.isFinite(v)) return null
      return v >= atrMedian ? `high vol (ATR%>=${atrMedian.toFixed(3)})` : `low vol (ATR%<${atrMedian.toFixed(3)})`
    }))
  }

  out.push(...group(observations, 'regime_actionable', o =>
    o.features.actionable === 1 ? 'actionable' : 'not actionable'))

  return out.filter(s => s.dimension === 'overall' || s.observations.length >= minSliceCount)
}
