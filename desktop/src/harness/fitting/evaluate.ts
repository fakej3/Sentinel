/**
 * Out-of-sample evaluation.
 *
 * ── EVERY HEADLINE STATISTIC IS COMPUTED PER DATE, THEN AVERAGED ──────────────
 *
 * Not because it is prettier, but because a date is the unit of independence
 * here and a row is not. Five hundred S&P constituents on one day share a
 * market factor; pooling them and computing one correlation over 400,000 rows
 * reports a standard error that assumes 400,000 independent observations when
 * there are closer to 1,200. Phase 4 was caught by exactly this once, and the
 * fix — resample dates, not rows — is now structural rather than remembered.
 *
 * So: compute the cross-sectional statistic on each date, obtain a daily time
 * series, and bootstrap THAT. It is also the standard construction in equity
 * research (the "IC time series"), which makes the numbers comparable to
 * published work rather than to this file's own conventions.
 *
 * ── RAW RETURNS AND MARKET-NEUTRAL RETURNS ARE BOTH REPORTED ─────────────────
 *
 * "Will this stock be up in five days" is dominated by "will the market be up
 * in five days". A model that has learned nothing stock-specific can still show
 * a positive IC against raw returns if any of its features happens to track
 * market state, and that would be indistinguishable from skill.
 *
 * Subtracting each date's cross-sectional mean return removes the market
 * factor and leaves the question the model can actually be judged on: given
 * that the market did whatever it did, did the model rank THESE stocks
 * correctly against each other? Both are reported. Where they disagree, the
 * market-neutral number is the one that says whether there is an edge.
 *
 * ── OVERLAPPING HORIZONS ──────────────────────────────────────────────────────
 *
 * With a five-day horizon and a daily stride, consecutive observations share
 * four of their five forward days, so the daily statistic series is
 * autocorrelated. The bootstrap therefore resamples non-overlapping BLOCKS of
 * `horizon` consecutive days rather than individual days.
 */
import { pearson, spearman } from '../metrics/stats'
import { rocAuc } from '../metrics/probability'
import { blockBootstrapMean } from '../research/inference'
import type { Estimate } from '../research/inference'
import { brierScore, brierSkillScore, reliabilityCurve } from '../../modules/signal/calibration'
import type { ReliabilityCurve } from '../../modules/signal/calibration'

/** One scored observation, already aligned to its outcome. */
export interface ScoredRow {
  readonly dateIdx: number
  /** Continuous score. Higher = more bullish. null when the source abstained. */
  readonly score: number | null
  /** Calibrated probability in [0, 1], when the source produces one. */
  readonly probability: number | null
  readonly forwardReturn: number
}

export interface DailyStat {
  readonly dateIdx: number
  readonly n: number
  readonly ic: number | null
  readonly rankIc: number | null
  readonly auc: number | null
  readonly brier: number | null
  readonly logLoss: number | null
  /** Mean return of the top score quintile minus the bottom, on this date. */
  readonly longShort: number | null
}

export interface Aggregate {
  readonly ic: Estimate | null
  readonly rankIc: Estimate | null
  readonly auc: Estimate | null
  readonly brier: Estimate | null
  readonly logLoss: Estimate | null
  readonly longShort: Estimate | null
  readonly days: number
}

export interface Classification {
  readonly n: number
  readonly accuracy: number | null
  readonly precision: number | null
  readonly recall: number | null
  readonly f1: number | null
  readonly baseRate: number | null
  readonly predictedPositiveRate: number | null
}

export interface EvaluationResult {
  readonly name: string
  /** Rows the source scored, out of those available. */
  readonly covered: number
  readonly available: number
  readonly coverage: number
  /** Against raw forward returns. */
  readonly raw: Aggregate
  /** Against returns with each date's cross-sectional mean removed. */
  readonly marketNeutral: Aggregate
  /** Pooled probability metrics. null when the source emits no probability. */
  readonly pooledBrier: number | null
  readonly pooledBrierSkill: number | null
  readonly pooledLogLoss: number | null
  readonly reliability: ReliabilityCurve | null
  readonly classification: Classification
  readonly horizon: number
}

/** Minimum symbols on a date for a cross-sectional statistic to be computed. */
export const MIN_CROSS_SECTION = 20

/**
 * Quintile breakpoint. 20% is the convention in the cross-sectional equity
 * literature (Fama–French sorts and the decile/quintile spread portfolios built
 * on them), chosen here for comparability rather than derived.
 */
const TAIL_FRACTION = 0.2

const LOG_LOSS_EPS = 1e-15

function logLossOf(p: readonly number[], y: readonly boolean[]): number | null {
  if (p.length === 0) return null
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const q = Math.min(1 - LOG_LOSS_EPS, Math.max(LOG_LOSS_EPS, p[i]))
    s += y[i] ? -Math.log(q) : -Math.log(1 - q)
  }
  return s / p.length
}

/** Groups rows by date, preserving ascending date order. */
function byDate(rows: readonly ScoredRow[]): Map<number, ScoredRow[]> {
  const m = new Map<number, ScoredRow[]>()
  for (const r of rows) {
    const list = m.get(r.dateIdx)
    if (list === undefined) m.set(r.dateIdx, [r])
    else list.push(r)
  }
  return m
}

/**
 * Removes each date's cross-sectional mean return.
 *
 * The residual is what a dollar-neutral long/short book would earn: the market
 * component is common to every name that day and cannot be captured by ranking
 * names against each other.
 */
export function demean(rows: readonly ScoredRow[]): ScoredRow[] {
  const groups = byDate(rows)
  const out: ScoredRow[] = []
  for (const [, list] of groups) {
    let s = 0
    for (const r of list) s += r.forwardReturn
    const m = s / list.length
    for (const r of list) out.push({ ...r, forwardReturn: r.forwardReturn - m })
  }
  return out
}

/** Cross-sectional statistics for every date with enough names. */
export function dailyStats(rows: readonly ScoredRow[]): DailyStat[] {
  const groups = [...byDate(rows).entries()].sort((a, b) => a[0] - b[0])
  const out: DailyStat[] = []

  for (const [dateIdx, list] of groups) {
    const scored = list.filter(r => r.score !== null && Number.isFinite(r.forwardReturn))
    if (scored.length < MIN_CROSS_SECTION) continue
    const s = scored.map(r => r.score!)
    const ret = scored.map(r => r.forwardReturn)
    const up = ret.map(v => v > 0)

    const withP = scored.filter(r => r.probability !== null)
    const ps = withP.map(r => r.probability!)
    const pys = withP.map(r => r.forwardReturn > 0)

    // Quintile spread, assigned by VALUE THRESHOLD rather than by position.
    //
    // Slicing the sorted array positionally is the obvious implementation and
    // is wrong under ties: with every score equal, the sort is stable, so the
    // "top quintile" becomes whichever names happened to arrive last. That is
    // not a subtle bias — measured on this corpus it gave the constant
    // `always_long` baseline a spread of -0.00081 with an interval excluding
    // zero, i.e. a statistically significant signal manufactured entirely from
    // row ordering.
    //
    // Thresholds fix it. Names tied at a boundary all land in the same leg, so
    // the legs can be larger than k but never depend on input order. When the
    // two thresholds coincide the tails would overlap in value and there is no
    // basis for assigning a name to one leg rather than the other, so the
    // spread is undefined — which is the correct answer for a score that does
    // not discriminate.
    let longShort: number | null = null
    const k = Math.floor(scored.length * TAIL_FRACTION)
    if (k >= 1) {
      const sorted = [...s].sort((a, b) => a - b)
      const loThreshold = sorted[k - 1]
      const hiThreshold = sorted[sorted.length - k]
      if (loThreshold < hiThreshold) {
        let loSum = 0, loN = 0, hiSum = 0, hiN = 0
        for (let j = 0; j < s.length; j++) {
          if (s[j] <= loThreshold) { loSum += ret[j]; loN++ }
          if (s[j] >= hiThreshold) { hiSum += ret[j]; hiN++ }
        }
        if (loN > 0 && hiN > 0) longShort = hiSum / hiN - loSum / loN
      }
    }

    out.push({
      dateIdx,
      n: scored.length,
      ic: pearson(s, ret),
      rankIc: spearman(s, ret),
      // Needs both classes present; a date on which every name rose has no ROC.
      auc: up.some(Boolean) && up.some(v => !v) ? rocAuc(s, up) : null,
      brier: ps.length >= MIN_CROSS_SECTION ? brierScore(ps, pys) : null,
      logLoss: ps.length >= MIN_CROSS_SECTION ? logLossOf(ps, pys) : null,
      longShort,
    })
  }
  return out
}

/**
 * Partitions a daily series into non-overlapping blocks of `blockLength`.
 *
 * Non-overlapping rather than moving blocks, so the pooled mean over all blocks
 * is exactly the mean of the series — a moving-block scheme would over-weight
 * interior days and the reported point estimate would not match the data.
 */
export function blocks(xs: readonly number[], blockLength: number): number[][] {
  if (blockLength < 1) throw new Error(`blockLength must be >= 1, got ${blockLength}`)
  const out: number[][] = []
  for (let i = 0; i < xs.length; i += blockLength) out.push(xs.slice(i, i + blockLength))
  return out
}

function aggregate(stats: readonly DailyStat[], horizon: number, seed: number): Aggregate {
  const pick = (f: (d: DailyStat) => number | null, offset: number): Estimate | null => {
    const xs = stats.map(f).filter((v): v is number => v !== null && Number.isFinite(v))
    if (xs.length < 2) return null
    return blockBootstrapMean(blocks(xs, horizon), 2000, seed + offset)
  }
  return {
    ic: pick(d => d.ic, 1),
    rankIc: pick(d => d.rankIc, 2),
    auc: pick(d => d.auc, 3),
    brier: pick(d => d.brier, 4),
    logLoss: pick(d => d.logLoss, 5),
    longShort: pick(d => d.longShort, 6),
    days: stats.length,
  }
}

/**
 * Pooled classification metrics at a decision boundary.
 *
 * The boundary is `probability > 0.5` when probabilities exist, otherwise
 * `score > 0`. Stated rather than tuned: choosing a threshold to maximise F1
 * on the evaluation set would be fitting on the test data, which is the whole
 * thing this pipeline exists to avoid.
 */
export function classify(rows: readonly ScoredRow[]): Classification {
  let tp = 0, fp = 0, tn = 0, fn = 0, n = 0, positives = 0, predicted = 0
  for (const r of rows) {
    const decision = r.probability !== null ? r.probability > 0.5
      : r.score !== null ? r.score > 0
      : null
    if (decision === null || !Number.isFinite(r.forwardReturn)) continue
    n++
    const actual = r.forwardReturn > 0
    if (actual) positives++
    if (decision) predicted++
    if (decision && actual) tp++
    else if (decision && !actual) fp++
    else if (!decision && actual) fn++
    else tn++
  }
  if (n === 0) {
    return { n: 0, accuracy: null, precision: null, recall: null, f1: null, baseRate: null, predictedPositiveRate: null }
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : null
  const recall = tp + fn > 0 ? tp / (tp + fn) : null
  return {
    n,
    accuracy: (tp + tn) / n,
    precision,
    recall,
    f1: precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall) : null,
    baseRate: positives / n,
    predictedPositiveRate: predicted / n,
  }
}

export interface EvaluateOptions {
  readonly name: string
  readonly horizon: number
  readonly seed?: number
  readonly reliabilityBins?: number
}

export function evaluateScores(
  rows: readonly ScoredRow[],
  available: number,
  options: EvaluateOptions,
): EvaluationResult {
  const seed = options.seed ?? 20260728
  const covered = rows.filter(r => r.score !== null).length

  const raw = aggregate(dailyStats(rows), options.horizon, seed)
  const marketNeutral = aggregate(dailyStats(demean(rows)), options.horizon, seed + 1000)

  const withP = rows.filter(r => r.probability !== null && Number.isFinite(r.forwardReturn))
  const ps = withP.map(r => r.probability!)
  const ys = withP.map(r => r.forwardReturn > 0)

  return {
    name: options.name,
    covered,
    available,
    coverage: available > 0 ? covered / available : 0,
    raw,
    marketNeutral,
    pooledBrier: ps.length > 0 ? brierScore(ps, ys) : null,
    pooledBrierSkill: ps.length > 0 ? brierSkillScore(ps, ys) : null,
    pooledLogLoss: ps.length > 0 ? logLossOf(ps, ys) : null,
    reliability: ps.length > 0 ? reliabilityCurve(ps, ys, { bins: options.reliabilityBins ?? 10 }) : null,
    classification: classify(rows),
    horizon: options.horizon,
  }
}
