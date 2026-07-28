/**
 * Calibration: turning a raw score into a probability, or refusing to.
 *
 * ── THE DEFECT THIS EXISTS TO PREVENT ─────────────────────────────────────────
 *
 * The engine being replaced emits a 0-10 "confidence" that is displayed as a
 * strength and read as a likelihood. It was never fitted against an outcome.
 * Phase 4 measured its Brier skill as negative in all twenty evaluation cells:
 * a constant forecast of the base rate beat it everywhere. That is what an
 * uncalibrated score is — a number with a plausible shape and no defined
 * relationship to how often anything happens.
 *
 * A `Calibrator` is the only object in this layer permitted to produce a
 * probability. It has one job: given a score, report the observed frequency of
 * positive outcomes among training observations with similar scores, or report
 * that it has no such observations.
 *
 * ── REFUSING EXTRAPOLATION IS THE POINT, NOT A SAFETY MARGIN ──────────────────
 *
 * Every calibrator here returns `null` outside the score range it was fitted
 * on, and `null` where local support is too thin to estimate a frequency. This
 * is not conservatism. A monotone fit extended past its data is an assertion
 * about observations that were never made: a model trained on scores in
 * [-2, 2] will happily report 0.97 for a score of 8, and that 0.97 is a
 * property of the functional form, not of the market.
 *
 * For isotonic the refusal is also a mathematical necessity — a step function
 * is simply undefined outside its steps. For Platt it is a policy: the fitted
 * sigmoid is defined on the whole line, but its slope was estimated from the
 * observed range, so a score twice the training maximum has no evidence behind
 * it. Both refuse, and the docstring on each says which kind of refusal it is.
 */
import type { CalibrationBin, Calibrator } from './types'

// ── Support requirements ──────────────────────────────────────────────────────

/**
 * Minimum observations behind a reported probability.
 *
 * PROVENANCE: derived from the estimator. A binomial proportion from n
 * observations has standard error √(p(1−p)/n), maximised at p = 0.5 where it is
 * 0.5/√n. Requiring that error to be at most 0.1 — i.e. that "60%" is
 * distinguishable from "40%" — gives n ≥ 25. Below it the calibrator abstains
 * rather than reporting a frequency it cannot resolve.
 */
export const MIN_CALIBRATION_SUPPORT = 25

// ── Scalar scores ─────────────────────────────────────────────────────────────

/**
 * Order-stable sum (Neumaier compensation).
 *
 * Plain accumulation makes a metric depend on row order, which would make two
 * runs over the same set disagree in the last digits and make "deterministic"
 * a claim that fails its own test.
 */
function sum(xs: readonly number[]): number {
  let s = 0
  let c = 0
  for (const x of xs) {
    const t = s + x
    c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s
    s = t
  }
  return s + c
}

function assertProbabilities(p: readonly number[], y: readonly boolean[]): void {
  if (p.length !== y.length) {
    throw new Error(`length mismatch: ${p.length} probabilities vs ${y.length} outcomes`)
  }
  for (let i = 0; i < p.length; i++) {
    if (!Number.isFinite(p[i]) || p[i] < 0 || p[i] > 1) {
      throw new Error(`probability at index ${i} is ${p[i]}; must be a finite number in [0, 1]`)
    }
  }
}

/**
 * Brier score: the mean squared error of a probability forecast.
 *
 *     BS = (1/N) · Σ (pᵢ − yᵢ)²
 *
 * Lower is better, range [0, 1]. The number to beat is the base rate's own
 * score, b(1−b) — 0.25 at b = 0.5. A Brier score that is not compared against
 * that reference is uninterpretable, which is why `brierSkillScore` exists and
 * why the two are always reported together.
 *
 * Rejects out-of-range input rather than clamping: a probability of 1.3 is a
 * bug in whatever produced it, and clamping would hide the bug behind a
 * flattered metric.
 */
export function brierScore(p: readonly number[], y: readonly boolean[]): number | null {
  assertProbabilities(p, y)
  if (p.length === 0) return null
  return sum(p.map((pi, i) => (pi - (y[i] ? 1 : 0)) ** 2)) / p.length
}

/**
 * Brier skill score: 1 − BS / BS_reference, where the reference is a constant
 * forecast of the observed base rate.
 *
 * Positive means the forecast beats the base rate; zero or negative means it
 * does not, however small the raw Brier score. Null on a degenerate sample
 * (every outcome identical), where the reference forecast is already perfect
 * and no skill relative to it is definable.
 */
export function brierSkillScore(p: readonly number[], y: readonly boolean[]): number | null {
  const bs = brierScore(p, y)
  if (bs === null) return null
  const base = y.filter(Boolean).length / y.length
  const reference = base * (1 - base)
  if (reference === 0) return null
  return 1 - bs / reference
}

// ── Reliability curve ─────────────────────────────────────────────────────────

/** One point of a reliability diagram. */
export interface ReliabilityBin {
  readonly lower: number
  readonly upper: number
  readonly n: number
  /** Mean PREDICTED probability in the bin. Null when empty. */
  readonly meanPredicted: number | null
  /** OBSERVED frequency of positives in the bin. Null when empty. */
  readonly observed: number | null
}

export interface ReliabilityCurve {
  readonly bins: readonly ReliabilityBin[]
  /** Expected calibration error: Σ (n_b/N)·|observed_b − meanPredicted_b|. */
  readonly ece: number | null
  /** Maximum calibration error over bins holding at least `minBinCount`. */
  readonly mce: number | null
  readonly n: number
  readonly minBinCount: number
}

/**
 * Reliability curve over equal-width probability bins.
 *
 * `meanPredicted` is the mean forecast in the bin, NOT the bin midpoint. Using
 * the midpoint attributes to the model an error that is an artefact of where
 * the bin edges were drawn.
 *
 * Bins are half-open [lo, hi) except the last, which is closed, so p = 1 lands
 * in the top bin instead of falling out of every bin.
 *
 * MCE is restricted to bins with at least `minBinCount` observations. Without
 * that floor it is reliably the noisiest bin — a single sample in an extreme
 * bin gives |observed − predicted| ≈ 1 no matter how good the model is.
 */
export function reliabilityCurve(
  p: readonly number[],
  y: readonly boolean[],
  options: { bins?: number; minBinCount?: number } = {},
): ReliabilityCurve {
  assertProbabilities(p, y)
  const nBins = options.bins ?? 10
  const minBinCount = options.minBinCount ?? 10
  if (!Number.isInteger(nBins) || nBins < 1) {
    throw new Error(`reliabilityCurve: bins must be a positive integer, got ${nBins}`)
  }

  const acc = Array.from({ length: nBins }, () => ({ n: 0, sumP: 0, hits: 0 }))
  for (let i = 0; i < p.length; i++) {
    let b = Math.floor(p[i] * nBins)
    if (b >= nBins) b = nBins - 1
    acc[b].n++
    acc[b].sumP += p[i]
    if (y[i]) acc[b].hits++
  }

  const bins: ReliabilityBin[] = acc.map((a, k) => ({
    lower: k / nBins,
    upper: (k + 1) / nBins,
    n: a.n,
    meanPredicted: a.n > 0 ? a.sumP / a.n : null,
    observed: a.n > 0 ? a.hits / a.n : null,
  }))

  const N = p.length
  if (N === 0) return { bins, ece: null, mce: null, n: 0, minBinCount }

  let ece = 0
  for (const b of bins) {
    if (b.n === 0) continue
    ece += (b.n / N) * Math.abs(b.observed! - b.meanPredicted!)
  }
  const eligible = bins.filter(b => b.n >= minBinCount)
  const mce = eligible.length > 0
    ? Math.max(...eligible.map(b => Math.abs(b.observed! - b.meanPredicted!)))
    : null

  return { bins, ece, mce, n: N, minBinCount }
}

// ── Shared input handling ─────────────────────────────────────────────────────

interface Observation { readonly s: number; readonly y: number }

/**
 * Validates and sorts training pairs by score.
 *
 * Sorting is by score only, with the ORIGINAL INDEX as the tiebreak, so the
 * order is total and the fit is reproducible for any input permutation of tied
 * scores. A comparator that leaves ties in arbitrary order would make PAVA's
 * block boundaries depend on the engine's sort stability.
 */
function prepare(scores: readonly number[], outcomes: readonly boolean[], who: string): Observation[] {
  if (scores.length !== outcomes.length) {
    throw new Error(`${who}: length mismatch, ${scores.length} scores vs ${outcomes.length} outcomes`)
  }
  const obs: Array<{ s: number; y: number; i: number }> = []
  for (let i = 0; i < scores.length; i++) {
    if (!Number.isFinite(scores[i])) {
      throw new Error(`${who}: score at index ${i} is ${scores[i]}; must be finite`)
    }
    obs.push({ s: scores[i], y: outcomes[i] ? 1 : 0, i })
  }
  obs.sort((a, b) => (a.s - b.s) || (a.i - b.i))
  return obs.map(o => ({ s: o.s, y: o.y }))
}

/** Locates the last bin whose lower bound is <= s. Binary search over sorted bins. */
function binAtOrBelow(bins: readonly CalibrationBin[], s: number): CalibrationBin | null {
  let lo = 0
  let hi = bins.length - 1
  let found: CalibrationBin | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (bins[mid].lower <= s) {
      found = bins[mid]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

// ── Isotonic regression ───────────────────────────────────────────────────────

/**
 * Isotonic (monotone) calibration by the Pool Adjacent Violators Algorithm.
 *
 * Fits the non-decreasing step function minimising Σ(y − f(s))² — the
 * least-squares monotone fit, which for 0/1 outcomes is also the maximum
 * likelihood monotone fit. It assumes only that a higher score should not mean
 * a lower probability, which is the weakest assumption under which a score is
 * worth calibrating at all. It assumes NO functional form, which is why it is
 * the right default here: Phase 6 found the engine's score saturating
 * (40-45% of observations in one grade), and a parametric fit would smooth
 * that pathology away rather than expose it.
 *
 * TIES. All observations sharing a score are pooled into one block BEFORE
 * PAVA runs. Without this the fit could assign two different probabilities to
 * the same score, which is not a function.
 *
 * BETWEEN STEPS. A score falling in the gap between two blocks maps to the
 * lower block's value — the last level actually observed at or below it. The
 * common alternative (linear interpolation, as in scikit-learn) reports
 * probabilities that appear in no block, and inventing intermediate values is
 * exactly what this layer refuses to do.
 *
 * OUTSIDE THE FITTED RANGE. Null. The step function is undefined there; this
 * refusal is arithmetic, not policy.
 */
export function fitIsotonic(
  scores: readonly number[],
  outcomes: readonly boolean[],
  options: { minSupport?: number } = {},
): Calibrator {
  const minSupport = options.minSupport ?? MIN_CALIBRATION_SUPPORT
  const obs = prepare(scores, outcomes, 'fitIsotonic')
  if (obs.length === 0) throw new Error('fitIsotonic: no observations')

  // Pool exact ties first, so every block covers a distinct score.
  const blocks: Array<{ lo: number; hi: number; sumY: number; n: number }> = []
  for (const o of obs) {
    const last = blocks[blocks.length - 1]
    if (last !== undefined && last.hi === o.s) {
      last.sumY += o.y
      last.n++
    } else {
      blocks.push({ lo: o.s, hi: o.s, sumY: o.y, n: 1 })
    }
  }

  // PAVA: merge any block whose mean is below its predecessor's, repeatedly,
  // until the sequence of means is non-decreasing.
  const pooled: Array<{ lo: number; hi: number; sumY: number; n: number }> = []
  for (const b of blocks) {
    pooled.push({ ...b })
    while (pooled.length >= 2) {
      const cur = pooled[pooled.length - 1]
      const prev = pooled[pooled.length - 2]
      if (prev.sumY / prev.n <= cur.sumY / cur.n) break
      prev.hi = cur.hi
      prev.sumY += cur.sumY
      prev.n += cur.n
      pooled.pop()
    }
  }

  const bins: CalibrationBin[] = pooled.map(b => ({
    lower: b.lo,
    upper: b.hi,
    probability: b.sumY / b.n,
    n: b.n,
  }))
  const support = { min: obs[0].s, max: obs[obs.length - 1].s }

  return {
    name: 'isotonic',
    bins,
    support,
    probability(score: number): { p: number; n: number } | null {
      if (!Number.isFinite(score) || score < support.min || score > support.max) return null
      const bin = binAtOrBelow(bins, score)
      if (bin === null || bin.n < minSupport) return null
      return { p: bin.probability, n: bin.n }
    },
  }
}

// ── Platt scaling ─────────────────────────────────────────────────────────────

/** The fitted sigmoid parameters, exposed so the fit can be inspected rather than trusted. */
export interface PlattParameters {
  /** Slope. NEGATIVE by Platt's sign convention: p = 1/(1 + exp(A·s + B)). */
  readonly a: number
  readonly b: number
  readonly converged: boolean
  readonly iterations: number
}

const PLATT_MAX_ITERATIONS = 100
const PLATT_TOLERANCE = 1e-10
/** Levenberg damping floor, as in Lin, Lin & Weng (2007) Algorithm 1. */
const PLATT_MIN_STEP = 1e-10

/**
 * Platt scaling: fits p(s) = 1 / (1 + exp(A·s + B)) by regularised maximum
 * likelihood.
 *
 * Uses the target smoothing of Platt (1999) as corrected by Lin, Lin & Weng
 * (2007): positives are fitted toward (N₊+1)/(N₊+2) rather than 1, negatives
 * toward 1/(N₋+2) rather than 0. This is the whole regularisation — it is a
 * proper Bayesian prior on the out-of-sample rate, and it is what keeps A from
 * diverging on separable data. No ridge term is added on top; doing so would
 * double-regularise and there would be no principled value for it.
 *
 * WHEN TO PREFER IT OVER ISOTONIC. Platt has two parameters and isotonic has
 * as many as there are distinct scores, so Platt is the better estimator when
 * data is scarce and the sigmoid shape is roughly right, and the worse one
 * whenever the true mapping is not sigmoid. Both are provided precisely so the
 * choice is made by measuring both on held-out data, not by preference.
 *
 * SUPPORT. Refuses outside the fitted score range. The sigmoid is defined
 * everywhere, so unlike isotonic this refusal is a policy: A was estimated from
 * the observed range and carries no information about scores beyond it.
 */
export function fitPlatt(
  scores: readonly number[],
  outcomes: readonly boolean[],
  options: { bins?: number; minSupport?: number } = {},
): Calibrator & { readonly parameters: PlattParameters } {
  const nBins = options.bins ?? 10
  const minSupport = options.minSupport ?? MIN_CALIBRATION_SUPPORT
  if (!Number.isInteger(nBins) || nBins < 1) {
    throw new Error(`fitPlatt: bins must be a positive integer, got ${nBins}`)
  }
  const obs = prepare(scores, outcomes, 'fitPlatt')
  if (obs.length === 0) throw new Error('fitPlatt: no observations')

  let nPos = 0
  for (const o of obs) nPos += o.y
  const nNeg = obs.length - nPos
  const hiTarget = (nPos + 1) / (nPos + 2)
  const loTarget = 1 / (nNeg + 2)
  const t = obs.map(o => (o.y === 1 ? hiTarget : loTarget))

  // Newton with Levenberg damping on the 2x2 Hessian, per Lin/Lin/Weng.
  let a = 0
  let b = Math.log((nNeg + 1) / (nPos + 1))
  let converged = false
  let iterations = 0

  const objective = (aa: number, bb: number): number => {
    let f = 0
    for (let i = 0; i < obs.length; i++) {
      const z = obs[i].s * aa + bb
      // log(1 + e^z) evaluated on the stable branch.
      f += z >= 0 ? t[i] * z + Math.log1p(Math.exp(-z)) : (t[i] - 1) * z + Math.log1p(Math.exp(z))
    }
    return f
  }

  let fval = objective(a, b)
  for (let it = 0; it < PLATT_MAX_ITERATIONS; it++) {
    iterations = it + 1
    let h11 = 1e-12, h22 = 1e-12, h21 = 0, g1 = 0, g2 = 0
    for (let i = 0; i < obs.length; i++) {
      const z = obs[i].s * a + b
      const q = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z))
      const p = 1 - q                 // p = P(y = 1) under Platt's sign convention
      const d1 = t[i] - p
      const d2 = p * q
      h11 += obs[i].s * obs[i].s * d2
      h22 += d2
      h21 += obs[i].s * d2
      g1 += obs[i].s * d1
      g2 += d1
    }
    if (Math.abs(g1) < PLATT_TOLERANCE && Math.abs(g2) < PLATT_TOLERANCE) {
      converged = true
      break
    }
    const det = h11 * h22 - h21 * h21
    if (!(Math.abs(det) > 0)) break
    const da = -(h22 * g1 - h21 * g2) / det
    const db = -(-h21 * g1 + h11 * g2) / det
    const gd = g1 * da + g2 * db

    // Backtracking line search: accept the first step that decreases the
    // objective. Without it Newton can overshoot on nearly separable data.
    let step = 1
    let stepped = false
    while (step >= PLATT_MIN_STEP) {
      const na = a + step * da
      const nb = b + step * db
      const nf = objective(na, nb)
      if (nf < fval + 1e-4 * step * gd) {
        a = na
        b = nb
        fval = nf
        stepped = true
        break
      }
      step /= 2
    }
    if (!stepped) {
      // No decrease available at any step size: this IS the optimum to the
      // precision the objective can resolve.
      converged = true
      break
    }
  }

  const support = { min: obs[0].s, max: obs[obs.length - 1].s }
  const at = (s: number): number => {
    const z = s * a + b
    return z >= 0 ? Math.exp(-z) / (1 + Math.exp(-z)) : 1 / (1 + Math.exp(z))
  }

  // `bins` renders the fitted curve over equal-width score intervals, each
  // carrying the number of TRAINING scores that fell in it. The curve is
  // parametric, but its local support is not, and `probability` gates on the
  // latter — a region of the sigmoid with three training points behind it is
  // not evidence, however smooth the function looks there.
  //
  // `bins` must have STRICTLY INCREASING lower bounds, because `binAtOrBelow`
  // resolves a score to the last bin at or below it. When every training score
  // is identical the range is degenerate and equal-width slicing would emit
  // `nBins` bins all with the same lower bound, of which only the first holds
  // anything — so the lookup would land on an empty bin and refuse for lack of
  // support when the support is in fact complete. One distinct score is one
  // bin.
  const width = (support.max - support.min) / nBins
  let bins: CalibrationBin[]
  if (!(width > 0)) {
    bins = [{ lower: support.min, upper: support.max, probability: at(support.min), n: obs.length }]
  } else {
    const counts = new Array<number>(nBins).fill(0)
    for (const o of obs) {
      let k = Math.floor((o.s - support.min) / width)
      if (k >= nBins) k = nBins - 1
      if (k < 0) k = 0
      counts[k]++
    }
    bins = counts.map((n, k) => {
      const lower = support.min + k * width
      const upper = support.min + (k + 1) * width
      return { lower, upper, probability: at((lower + upper) / 2), n }
    })
  }

  return {
    name: 'platt',
    bins,
    support,
    parameters: { a, b, converged, iterations },
    probability(score: number): { p: number; n: number } | null {
      if (!Number.isFinite(score) || score < support.min || score > support.max) return null
      const bin = binAtOrBelow(bins, score)
      if (bin === null || bin.n < minSupport) return null
      return { p: at(score), n: bin.n }
    },
  }
}

// ── Comparison ────────────────────────────────────────────────────────────────

export interface CalibratorAssessment {
  readonly name: string
  /** Observations the calibrator was willing to score. */
  readonly covered: number
  /** Observations it refused (outside support, or too little local support). */
  readonly refused: number
  readonly brier: number | null
  readonly brierSkill: number | null
  readonly ece: number | null
  readonly mce: number | null
}

/**
 * Scores a fitted calibrator on held-out observations.
 *
 * Reports `refused` alongside every metric, and this is not a footnote: a
 * calibrator that answers on 5% of observations can have an excellent Brier
 * score and be useless, and one that answers on 100% by extrapolating can look
 * identical. Comparing two calibrators without comparing their coverage
 * compares nothing.
 *
 * The metrics are computed on the covered subset only, because there is no
 * defensible score to assign a refusal — assigning 0.5 would measure the base
 * rate, and dropping the row silently is what makes the coverage figure
 * mandatory here.
 */
export function assessCalibrator(
  calibrator: Calibrator,
  scores: readonly number[],
  outcomes: readonly boolean[],
  options: { bins?: number; minBinCount?: number } = {},
): CalibratorAssessment {
  if (scores.length !== outcomes.length) {
    throw new Error(`assessCalibrator: length mismatch, ${scores.length} vs ${outcomes.length}`)
  }
  const p: number[] = []
  const y: boolean[] = []
  let refused = 0
  for (let i = 0; i < scores.length; i++) {
    const r = calibrator.probability(scores[i])
    if (r === null) { refused++; continue }
    p.push(r.p)
    y.push(outcomes[i])
  }
  const curve = reliabilityCurve(p, y, options)
  return {
    name: calibrator.name,
    covered: p.length,
    refused,
    brier: brierScore(p, y),
    brierSkill: brierSkillScore(p, y),
    ece: curve.ece,
    mce: curve.mce,
  }
}
