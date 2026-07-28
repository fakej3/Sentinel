/**
 * Probability / calibration metrics.
 *
 * These answer "when the engine says 0.8, does it happen 80% of the time?" —
 * which is a different and more demanding question than "is the engine right
 * more often than not". A predictor can have excellent accuracy and useless
 * calibration, and vice versa.
 *
 * Every function takes probabilities in [0, 1] and boolean outcomes, and
 * rejects anything outside that range rather than clamping. A probability of
 * 1.3 is a bug in the mapping, and silently clamping it would hide the bug and
 * flatter the metric.
 */
import type { CalibrationBin, CalibrationResult, BinningMethod } from './types'
import { quantile, sum } from './stats'

/**
 * Brier score and its skill form are DEFINED in the signal layer, because that
 * is where a calibrator is fitted and has to be scored. Re-deriving them here
 * would put the same formula in two files that are compared against each other,
 * which is how the two silently come to disagree. The dependency runs
 * harness → modules, never the reverse.
 */
export { brierScore, brierSkillScore } from '../../modules/signal/calibration'

function assertProbabilities(p: readonly number[], y: readonly boolean[]): void {
  if (p.length !== y.length) throw new Error(`length mismatch: ${p.length} probabilities vs ${y.length} outcomes`)
  for (let i = 0; i < p.length; i++) {
    if (!Number.isFinite(p[i]) || p[i] < 0 || p[i] > 1) {
      throw new Error(`probability at index ${i} is ${p[i]}; must be a finite number in [0, 1]`)
    }
  }
}

/**
 * Logarithmic loss (cross-entropy).
 *
 *     LL = −(1/N) · Σ [ yᵢ·log pᵢ + (1−yᵢ)·log(1−pᵢ) ]
 *
 * Unbounded above: a confident wrong forecast at p = 0 costs infinity. `eps`
 * clips probabilities into [eps, 1−eps] to keep the statistic finite, which is
 * the universal convention (scikit-learn's historical default is 1e-15, used
 * here). The clip is a REPORTED parameter, not a hidden one, because it caps
 * the penalty for exactly the errors that matter most.
 *
 * Reference: a forecast of 0.5 everywhere scores log 2 ≈ 0.693.
 */
export function logLoss(p: readonly number[], y: readonly boolean[], eps = 1e-15): number | null {
  assertProbabilities(p, y)
  if (p.length === 0) return null
  if (!(eps > 0 && eps < 0.5)) throw new Error(`logLoss: eps must be in (0, 0.5), got ${eps}`)
  return sum(p.map((pi, i) => {
    const q = Math.min(1 - eps, Math.max(eps, pi))
    return y[i] ? -Math.log(q) : -Math.log(1 - q)
  })) / p.length
}

/**
 * Bin edges.
 *
 * `equal-width` cuts [0, 1] into `bins` equal intervals. It is what a
 * reliability diagram conventionally shows, and it makes bins directly
 * comparable across slices — but bins can be empty or tiny, and an ECE
 * dominated by a bin of 3 samples is noise.
 *
 * `quantile` cuts at the empirical quantiles of `p`, so every bin holds
 * roughly the same number of samples. Bin accuracy is then estimated with
 * roughly equal precision throughout, at the cost of bins that differ between
 * slices.
 *
 * Both are offered because they disagree exactly where it matters, and a
 * calibration claim that holds under only one of them is not a robust claim.
 */
export function binEdges(p: readonly number[], bins: number, method: BinningMethod): number[] {
  if (!Number.isInteger(bins) || bins < 1) throw new Error(`bins must be a positive integer, got ${bins}`)
  if (method === 'equal-width') {
    return Array.from({ length: bins + 1 }, (_, i) => i / bins)
  }
  if (p.length === 0) return [0, 1]
  const edges = [0]
  for (let i = 1; i < bins; i++) edges.push(quantile(p, i / bins)!)
  edges.push(1)
  // Quantile edges collapse when p is highly tied — which Sentinel's discrete
  // confidence score guarantees. Deduplicate rather than emit empty bins whose
  // width is zero; the resulting bin count is reported, not assumed.
  return [...new Set(edges)].sort((a, b) => a - b)
}

/**
 * Reliability curve, expected calibration error, and maximum calibration error.
 *
 *     ECE = Σ_b (n_b / N) · | acc_b − conf_b |
 *     MCE = max_b | acc_b − conf_b |
 *
 * where `conf_b` is the MEAN PREDICTED PROBABILITY in bin b (not the bin
 * midpoint — using the midpoint attributes to the model an error that is an
 * artefact of the binning) and `acc_b` is the observed frequency.
 *
 * MCE is computed over bins with at least `minBinCount` samples. Without that
 * floor it is almost always the noisiest bin: a single sample in an extreme
 * bin gives |acc − conf| ≈ 1 regardless of the model. The floor is reported.
 *
 * Bins are half-open [lo, hi) except the last, which is closed [lo, hi], so
 * p = 1 lands in the top bin rather than falling out of every bin.
 */
export function calibration(
  p: readonly number[],
  y: readonly boolean[],
  options: { bins?: number; method?: BinningMethod; minBinCount?: number } = {},
): CalibrationResult {
  assertProbabilities(p, y)
  const bins = options.bins ?? 10
  const method = options.method ?? 'equal-width'
  const minBinCount = options.minBinCount ?? 10

  const edges = binEdges(p, bins, method)
  const nBins = edges.length - 1
  const acc: Array<{ n: number; sumP: number; hits: number }> = Array.from(
    { length: nBins }, () => ({ n: 0, sumP: 0, hits: 0 }),
  )

  for (let i = 0; i < p.length; i++) {
    let b = -1
    for (let k = 0; k < nBins; k++) {
      const last = k === nBins - 1
      if (p[i] >= edges[k] && (last ? p[i] <= edges[k + 1] : p[i] < edges[k + 1])) { b = k; break }
    }
    // Unreachable for p in [0,1] with edges spanning [0,1]; guard rather than
    // silently drop, because a dropped sample would break the bin-sum identity
    // that the tests rely on.
    if (b < 0) throw new Error(`calibration: probability ${p[i]} fell outside every bin`)
    acc[b].n++
    acc[b].sumP += p[i]
    if (y[i]) acc[b].hits++
  }

  const binsOut: CalibrationBin[] = acc.map((a, k) => ({
    lower: edges[k],
    upper: edges[k + 1],
    n: a.n,
    meanPredicted: a.n > 0 ? a.sumP / a.n : null,
    observedFrequency: a.n > 0 ? a.hits / a.n : null,
    hits: a.hits,
  }))

  const N = p.length
  let ece: number | null = null
  let mce: number | null = null
  if (N > 0) {
    ece = 0
    for (const b of binsOut) {
      if (b.n === 0) continue
      ece += (b.n / N) * Math.abs(b.observedFrequency! - b.meanPredicted!)
    }
    const eligible = binsOut.filter(b => b.n >= minBinCount)
    mce = eligible.length > 0
      ? Math.max(...eligible.map(b => Math.abs(b.observedFrequency! - b.meanPredicted!)))
      : null
  }

  return { bins: binsOut, ece, mce, n: N, method, requestedBins: bins, minBinCount }
}

/**
 * Area under the ROC curve, computed as the normalised Mann–Whitney U
 * statistic:
 *
 *     AUC = (U / (n₊·n₋)) ,  U = Σ over positives of rank − n₊(n₊+1)/2
 *
 * using tie-averaged ranks, which is the exact equivalent of trapezoidal
 * integration of the ROC curve with ties handled correctly. Interpretation:
 * the probability that a randomly chosen positive is scored above a randomly
 * chosen negative, counting ties as half.
 *
 * Requires at least one sample of each class; null otherwise, because with one
 * class present the curve is a point.
 *
 * Note AUC is invariant to any monotone transform of the score, so it measures
 * DISCRIMINATION only and says nothing about calibration. A model with AUC 0.7
 * can be badly miscalibrated and a perfectly calibrated model can have AUC
 * 0.5. Both are reported for that reason.
 */
export function rocAuc(scores: readonly number[], y: readonly boolean[]): number | null {
  if (scores.length !== y.length) throw new Error(`rocAuc: length mismatch ${scores.length} vs ${y.length}`)
  const nPos = y.filter(Boolean).length
  const nNeg = y.length - nPos
  if (nPos === 0 || nNeg === 0) return null

  const order = scores.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array<number>(scores.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[order[k].i] = r
    i = j + 1
  }

  let sumRanksPos = 0
  for (let k = 0; k < y.length; k++) if (y[k]) sumRanksPos += ranks[k]
  const u = sumRanksPos - (nPos * (nPos + 1)) / 2
  return u / (nPos * nNeg)
}
