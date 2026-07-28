/**
 * Transparent linear signal model.
 *
 * ── WHY A LINEAR MODEL, AND WHY ITS WEIGHTS ARE NOT IN THIS FILE ──────────────
 *
 * The engine being replaced combines evidence by counting: twenty-two booleans
 * are summed into a 0-10 score whose weights were authored rather than fitted.
 * Phase 4 measured the result to have NEGATIVE Brier skill in all twenty cells
 * of the evaluation grid — the score was worse than the base rate. The cause is
 * not the arithmetic; it is that nothing ever checked the numbers against an
 * outcome.
 *
 * So this file contains no coefficient values. Not one. `LinearSignalModel` is
 * a scorer that requires a `ModelWeights` object, and the only supported way to
 * obtain one is `fitLinearSignalModel`, which derives it from resolved
 * outcomes by penalised maximum likelihood. Writing plausible-looking weights
 * here would reproduce the defect precisely, with better documentation.
 *
 * ── WHAT "TRANSPARENT" MEANS HERE ─────────────────────────────────────────────
 *
 * Every quantity the model emits decomposes. `predict` returns the contribution
 * of each feature to the linear predictor, the share of predictive variance
 * each carries, which features were observed and which were imputed, and an
 * interval that widens when either the parameters or the inputs are poorly
 * determined. There is no step whose output cannot be traced to a coefficient
 * times an input.
 *
 * ── A PROBABILITY HERE IS NOT A CALIBRATED PROBABILITY ────────────────────────
 *
 * `ModelOutput.probabilityLong` is the logistic link applied to the linear
 * predictor. It is the model's INTERNAL likelihood, and on any real dataset it
 * will be miscalibrated — logistic regression is calibrated in-sample by
 * construction and rarely out of it. Only a `Calibrator` fitted on held-out
 * resolved outcomes may produce `Prediction.probability`, which is why
 * `score()` returns a `RawScore` and the assembly in `index.ts` routes it
 * through calibration before anything reaches a consumer. Presenting
 * `probabilityLong` to a user as a likelihood would be the same category error
 * as presenting the old 0-10 score as a percentage.
 *
 * ── STANDARDISED SPACE ────────────────────────────────────────────────────────
 *
 * The fit standardises every feature by its TRAINING mean and standard
 * deviation, and the scorer applies the same transform. Three things follow,
 * all of them load-bearing:
 *
 *   1. The ridge penalty becomes meaningful. Penalising raw coefficients
 *      penalises features for their units; penalising standardised ones
 *      penalises them for their effect.
 *   2. A missing feature imputes to exactly 0, which IS the training mean. The
 *      imputation is explicit rather than an accident of dropping a term.
 *   3. |coefficient| is directly comparable across features, so importance is
 *      readable off the fit instead of being invented.
 */
import type { RawScore, RegimeState, ScaledFeatures, SignalModel } from './types'

// ── Numerical primitives ──────────────────────────────────────────────────────

/** Logistic link, evaluated on the branch that cannot overflow. */
export function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z)
    return 1 / (1 + e)
  }
  const e = Math.exp(z)
  return e / (1 + e)
}

/**
 * Cholesky factor L of a symmetric positive-definite A, with A = L·Lᵀ.
 *
 * Returns null when A is not positive definite. With a strictly positive ridge
 * that cannot happen, so a null return means the caller has a bug rather than
 * a hard problem — and it is reported instead of producing silent garbage.
 */
export function cholesky(a: readonly (readonly number[])[]): number[][] | null {
  const n = a.length
  const l: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i][j]
      for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k]
      if (i === j) {
        if (!(s > 0)) return null
        l[i][i] = Math.sqrt(s)
      } else {
        l[i][j] = s / l[j][j]
      }
    }
  }
  return l
}

/** Solves A·x = b for symmetric positive-definite A, given its Cholesky factor. */
export function choleskySolve(l: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = l.length
  const y = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= l[i][k] * y[k]
    y[i] = s / l[i][i]
  }
  const x = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]
    for (let k = i + 1; k < n; k++) s -= l[k][i] * x[k]
    x[i] = s / l[i][i]
  }
  return x
}

/** Inverse of a symmetric positive-definite A, by solving against each unit vector. */
export function choleskyInverse(a: readonly (readonly number[])[]): number[][] | null {
  const l = cholesky(a)
  if (l === null) return null
  const n = a.length
  const inv: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const e = new Array<number>(n).fill(0)
  for (let c = 0; c < n; c++) {
    e.fill(0)
    e[c] = 1
    const col = choleskySolve(l, e)
    for (let r = 0; r < n; r++) inv[r][c] = col[r]
  }
  // Symmetrise. The two triangles differ only by rounding, and forcing them
  // equal keeps xᵀΣx exactly symmetric, which the variance formula assumes.
  for (let r = 0; r < n; r++) {
    for (let c = r + 1; c < n; c++) {
      const m = (inv[r][c] + inv[c][r]) / 2
      inv[r][c] = m
      inv[c][r] = m
    }
  }
  return inv
}

// ── Fitted weights ────────────────────────────────────────────────────────────

/** Training marginal of one feature, used for standardisation and imputation. */
export interface FeatureMoments {
  readonly mean: number
  /** Sample standard deviation over the non-null training values. */
  readonly sd: number
  /** Non-null training observations behind `mean` and `sd`. */
  readonly n: number
}

/**
 * Everything a fit produces. Serialisable, inspectable, and the only legitimate
 * source of coefficients.
 */
export interface ModelWeights {
  /** Feature order. Every array below is aligned to it. */
  readonly features: readonly string[]
  /** Intercept, in standardised space. */
  readonly intercept: number
  /** Coefficients in STANDARDISED space: log-odds per training standard deviation. */
  readonly coefficients: readonly number[]
  readonly moments: readonly FeatureMoments[]
  /**
   * Features excluded from the fit because they were constant or too sparse in
   * training. Their coefficients are exactly 0 and they can never contribute.
   */
  readonly dropped: readonly string[]
  /**
   * Sandwich covariance of [intercept, ...coefficients], H⁻¹(XᵀWX)H⁻¹ with
   * H = XᵀWX + λP. This is the variance of the penalised estimator; it does NOT
   * include the penalty's bias, so intervals built from it are honest about
   * noise and silent about shrinkage.
   */
  readonly covariance: readonly (readonly number[])[]
  readonly ridge: number
  readonly trainingRows: number
  /** Rows whose outcome was 1. Together with `trainingRows` this gives the base rate. */
  readonly trainingPositives: number
  /**
   * Minority-class events per fitted coefficient. Below ~10 a logistic fit is
   * conventionally regarded as unreliable (Peduzzi et al. 1996); reported
   * rather than enforced, because refusing to fit hides the diagnostic.
   */
  readonly eventsPerVariable: number
  readonly converged: boolean
  readonly iterations: number
  /**
   * OLS of realised forward return on the linear predictor: E[r | η] = a + b·η.
   * null when the caller supplied no forward returns. This is the ONLY source
   * of `expectedMove`; there is no closed form linking a classifier's
   * probability to a magnitude, and inventing one is how a 60% win rate comes
   * to be displayed as a price target.
   */
  readonly moveIntercept: number | null
  readonly moveSlope: number | null
  /** Rows behind the move fit. */
  readonly moveRows: number
}

// ── Prediction output ─────────────────────────────────────────────────────────

/** Why the model declined to predict. */
export type ModelAbstention =
  | 'too-many-missing-features'
  | 'no-usable-features'

/** One feature's traced effect on this prediction. */
export interface FeatureContribution {
  readonly name: string
  /** The scaled input, before standardisation. null when the feature was missing. */
  readonly value: number | null
  /** True when `value` was null and the training mean was substituted. */
  readonly imputed: boolean
  /** Standardised-space coefficient. */
  readonly coefficient: number
  /** coefficient × standardised value. Sums, with the intercept, to the linear predictor. */
  readonly contribution: number
  /**
   * β² as a share of Σβ² over all features. The feature's a-priori share of the
   * predictor's variance — a property of the FIT, identical for every
   * observation, and not to be read as this bar's influence (that is
   * `contribution`).
   */
  readonly importance: number
}

export interface ModelOutput {
  /** Logistic link of the linear predictor. UNCALIBRATED — see the file header. */
  readonly probabilityLong: number | null
  /** Exactly 1 − probabilityLong. Present because the caller should never compute it. */
  readonly probabilityShort: number | null
  /**
   * probabilityLong − 0.5, in [-0.5, 0.5]. Signed, positive = long.
   * Zero means the model is indifferent, not that it is confident of a flat.
   */
  readonly edge: number | null
  /**
   * Standard error of the linear predictor, combining parameter uncertainty
   * (xᵀΣx) with imputation uncertainty (Σβ² over the missing features, which
   * have unit variance in standardised space). In log-odds units.
   */
  readonly uncertainty: number | null
  /** 95% interval on `probabilityLong`, from ±z·uncertainty on the log-odds scale. */
  readonly interval: { readonly lower: number; readonly upper: number } | null
  /**
   * Fitted E[forward return | η], in whatever unit the training returns used.
   * null whenever the weights carry no move fit.
   */
  readonly expectedMove: number | null
  readonly abstain: ModelAbstention | null
  /** The linear predictor itself. This, not the probability, is what a calibrator consumes. */
  readonly linearPredictor: number | null
  readonly contributions: readonly FeatureContribution[]
  readonly observed: number
  readonly imputed: number
}

/** 95% two-sided normal quantile. */
const Z95 = 1.959963984540054

/**
 * Minimum share of Σβ² that must come from OBSERVED features.
 *
 * Set at the break-even point rather than by taste: below 0.5 the imputed
 * features carry more of the predictor's a-priori variance than the observed
 * ones, so the prediction is determined more by the training means than by this
 * bar. That is the point at which reporting a probability stops being a
 * statement about the market.
 */
export const MIN_OBSERVED_INFORMATION = 0.5

// ── The model ─────────────────────────────────────────────────────────────────

export class LinearSignalModel implements SignalModel {
  readonly name: string
  readonly features: readonly string[]
  private readonly sumSquaredBeta: number

  constructor(
    readonly weights: ModelWeights,
    name = 'linear-logistic',
    private readonly minObservedInformation = MIN_OBSERVED_INFORMATION,
  ) {
    if (weights.features.length !== weights.coefficients.length) {
      throw new Error(
        `ModelWeights: ${weights.features.length} features but ${weights.coefficients.length} coefficients`,
      )
    }
    if (weights.features.length !== weights.moments.length) {
      throw new Error(
        `ModelWeights: ${weights.features.length} features but ${weights.moments.length} moments`,
      )
    }
    const p = weights.features.length + 1
    if (weights.covariance.length !== p || weights.covariance.some(r => r.length !== p)) {
      throw new Error(`ModelWeights: covariance must be ${p}x${p}`)
    }
    this.name = name
    this.features = weights.features
    let s = 0
    for (const b of weights.coefficients) s += b * b
    this.sumSquaredBeta = s
  }

  /**
   * The `SignalModel` contract: a raw, unbounded, signed score.
   *
   * The score IS the linear predictor. `regime` is deliberately unused — the
   * regime statistics enter as ordinary features (`volatility_regime`,
   * `trend_persistence`), so consuming them again here would double-count them
   * and, worse, would put a second, unfitted decision path next to the fitted
   * one. It stays in the signature because the interface is shared with models
   * that may condition on regime explicitly.
   */
  score(features: ScaledFeatures, _regime: RegimeState): RawScore | null {
    const out = this.predict(features)
    if (out.linearPredictor === null) return null
    const used: string[] = []
    const missing: string[] = []
    for (const c of out.contributions) {
      if (c.imputed) missing.push(c.name)
      else used.push(c.name)
    }
    return { value: out.linearPredictor, used, missing }
  }

  /** The full, traced prediction. Deterministic: pure arithmetic in a fixed order. */
  predict(features: ScaledFeatures): ModelOutput {
    const names = this.weights.features
    const betas = this.weights.coefficients
    const moments = this.weights.moments

    const contributions: FeatureContribution[] = []
    // Standardised design row, intercept first, aligned to the covariance.
    const x = new Array<number>(names.length + 1).fill(0)
    x[0] = 1

    let eta = this.weights.intercept
    let observedBetaSq = 0
    let missingBetaSq = 0
    let observed = 0
    let imputed = 0

    for (let j = 0; j < names.length; j++) {
      const raw = features[names[j]] ?? null
      const m = moments[j]
      const b = betas[j]
      const usable = raw !== null && Number.isFinite(raw) && m.sd > 0
      // Standardised value; 0 is exactly the training mean, so a missing
      // feature contributes nothing to eta beyond what the intercept already
      // encodes about the average observation.
      const z = usable ? (raw - m.mean) / m.sd : 0
      x[j + 1] = z
      eta += b * z
      if (usable) {
        observed++
        observedBetaSq += b * b
      } else {
        imputed++
        missingBetaSq += b * b
      }
      contributions.push({
        name: names[j],
        value: usable ? raw : null,
        imputed: !usable,
        coefficient: b,
        contribution: b * z,
        importance: this.sumSquaredBeta > 0 ? (b * b) / this.sumSquaredBeta : 0,
      })
    }

    const abstain = this.abstentionFor(observedBetaSq, missingBetaSq)
    if (abstain !== null) {
      return {
        probabilityLong: null, probabilityShort: null, edge: null,
        uncertainty: null, interval: null, expectedMove: null,
        abstain, linearPredictor: null, contributions, observed, imputed,
      }
    }

    // Var(eta) = xᵀΣx  (parameter uncertainty)
    //          + Σ_{j missing} β_j²  (the unknown standardised value has unit
    //            variance by construction, since standardisation used the
    //            training sd). Adding these treats the two sources as
    //            independent, which they are: Σ is a property of the fit and
    //            the missingness is a property of this observation.
    let quad = 0
    const cov = this.weights.covariance
    for (let r = 0; r < x.length; r++) {
      const xr = x[r]
      if (xr === 0) continue
      const row = cov[r]
      let inner = 0
      for (let c = 0; c < x.length; c++) inner += row[c] * x[c]
      quad += xr * inner
    }
    const variance = Math.max(0, quad) + missingBetaSq
    const se = Math.sqrt(variance)

    const p = sigmoid(eta)
    const expectedMove = this.weights.moveSlope === null || this.weights.moveIntercept === null
      ? null
      : this.weights.moveIntercept + this.weights.moveSlope * eta

    return {
      probabilityLong: p,
      probabilityShort: 1 - p,
      edge: p - 0.5,
      uncertainty: se,
      // The interval is built on the log-odds scale and mapped through the
      // link, so it can never leave [0, 1] and is never symmetric about p —
      // both of which a naive p ± z·se interval gets wrong.
      interval: { lower: sigmoid(eta - Z95 * se), upper: sigmoid(eta + Z95 * se) },
      expectedMove,
      abstain: null,
      linearPredictor: eta,
      contributions,
      observed,
      imputed,
    }
  }

  private abstentionFor(observedBetaSq: number, missingBetaSq: number): ModelAbstention | null {
    const total = observedBetaSq + missingBetaSq
    // A fit whose coefficients are all zero has nothing to say regardless of
    // what is present, and dividing by `total` below would be 0/0.
    if (!(total > 0)) return 'no-usable-features'
    if (observedBetaSq / total < this.minObservedInformation) return 'too-many-missing-features'
    return null
  }
}

// ── Fitting ───────────────────────────────────────────────────────────────────

/** One resolved observation. `outcome` is 1 when the forward return was positive. */
export interface TrainingRow {
  readonly features: ScaledFeatures
  readonly outcome: 0 | 1
  /**
   * Realised forward return over the same horizon, in any consistent unit
   * (ATR multiples and log returns are both fine — `expectedMove` inherits it).
   * Omit to fit no move model.
   */
  readonly forwardReturn?: number
}

export interface FitOptions {
  /**
   * L2 penalty on the standardised coefficients. The intercept is never
   * penalised — shrinking it would pull the fitted base rate toward 0.5, which
   * is a claim about the market rather than about the coefficients.
   *
   * PROVENANCE: λ = 1 on standardised features is exactly a N(0, 1) Gaussian
   * prior on each coefficient, i.e. "a one-standard-deviation move in a feature
   * shifts the log-odds by about 1" as a prior expectation. In this domain that
   * is a very generous prior — it corresponds to a feature that alone moves a
   * 50% probability to 73% — so it constrains only pathologies: separable data,
   * near-collinear features, and the infinite coefficients both produce. It is
   * a regulariser, not a tuned hyperparameter, and it must be selected by
   * cross-validation before it is treated as one.
   */
  readonly ridge?: number
  readonly maxIterations?: number
  /** Convergence on max |Δβ| between Newton steps. */
  readonly tolerance?: number
  /**
   * Minimum non-null training observations for a feature to be fitted at all.
   * Defaults to `MIN_FEATURE_SUPPORT`.
   */
  readonly minFeatureSupport?: number
}

/**
 * Minimum non-null training rows before a feature may receive a coefficient.
 *
 * PROVENANCE: the same estimator argument as `MIN_SCALING_WINDOW` in
 * `scaling.ts`. Standardisation divides by a sample standard deviation whose
 * own relative standard error is ≈ 1/√(2(n−1)); at n = 30 that is 13%. Below
 * it the feature is dropped rather than fitted against a scale that is mostly
 * noise.
 */
export const MIN_FEATURE_SUPPORT = 30

const DEFAULT_RIDGE = 1
const DEFAULT_MAX_ITERATIONS = 100
const DEFAULT_TOLERANCE = 1e-10

/**
 * Fits a ridge-penalised logistic regression by iteratively reweighted least
 * squares (Newton–Raphson on the penalised log-likelihood).
 *
 * Deterministic in the strict sense required of this layer: no randomness, no
 * shuffling, no iteration over unordered collections. The same rows in the same
 * order produce bit-identical weights, and — because the update visits features
 * in `featureNames` order and rows in input order — the same rows in a
 * different order produce weights that differ only by floating-point
 * association. `fitLinearSignalModel` therefore does NOT sort or reorder its
 * input.
 *
 * The caller is responsible for the rows being causally valid. This function
 * cannot detect look-ahead: it sees a design matrix, not a timeline. The
 * walk-forward machinery that guarantees causality lives in `src/harness/`.
 */
export function fitLinearSignalModel(
  rows: readonly TrainingRow[],
  featureNames: readonly string[],
  options: FitOptions = {},
): ModelWeights {
  const ridge = options.ridge ?? DEFAULT_RIDGE
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE
  const minFeatureSupport = options.minFeatureSupport ?? MIN_FEATURE_SUPPORT

  if (!(ridge > 0)) {
    // A zero ridge admits infinite coefficients on separable data and a
    // singular Hessian on collinear features. Both fail loudly here rather
    // than quietly producing a model that predicts 1.0 with total confidence.
    throw new Error(`ridge must be > 0, got ${ridge}`)
  }
  if (featureNames.length === 0) throw new Error('fitLinearSignalModel: no features given')
  if (new Set(featureNames).size !== featureNames.length) {
    throw new Error('fitLinearSignalModel: duplicate feature names')
  }
  if (rows.length === 0) throw new Error('fitLinearSignalModel: no training rows')
  for (const r of rows) {
    if (r.outcome !== 0 && r.outcome !== 1) {
      throw new Error(`fitLinearSignalModel: outcome must be 0 or 1, got ${r.outcome}`)
    }
  }

  const k = featureNames.length
  const n = rows.length

  // ── Training moments, over non-null values only ─────────────────────────────
  const moments: FeatureMoments[] = []
  const dropped: string[] = []
  for (let j = 0; j < k; j++) {
    const vals: number[] = []
    for (const r of rows) {
      const v = r.features[featureNames[j]] ?? null
      if (v !== null && Number.isFinite(v)) vals.push(v)
    }
    if (vals.length < 2) {
      moments.push({ mean: vals.length === 1 ? vals[0] : 0, sd: 0, n: vals.length })
      dropped.push(featureNames[j])
      continue
    }
    let sum = 0
    for (const v of vals) sum += v
    const mean = sum / vals.length
    let ss = 0
    for (const v of vals) ss += (v - mean) ** 2
    const sd = Math.sqrt(ss / (vals.length - 1))
    moments.push({ mean, sd, n: vals.length })
    if (!(sd > 0) || vals.length < minFeatureSupport) dropped.push(featureNames[j])
  }
  const fitted = featureNames.map(f => !dropped.includes(f))

  // ── Design matrix in standardised space, intercept first ────────────────────
  const p = k + 1
  const X: number[][] = []
  const y: number[] = []
  for (const r of rows) {
    const row = new Array<number>(p).fill(0)
    row[0] = 1
    for (let j = 0; j < k; j++) {
      if (!fitted[j]) continue
      const v = r.features[featureNames[j]] ?? null
      const m = moments[j]
      row[j + 1] = v !== null && Number.isFinite(v) ? (v - m.mean) / m.sd : 0
    }
    X.push(row)
    y.push(r.outcome)
  }

  // ── Penalised IRLS ──────────────────────────────────────────────────────────
  // Penalty is applied to coefficients only, never the intercept. Dropped
  // features get a penalty too, which pins their (all-zero-column) coefficients
  // at exactly 0 and keeps the Hessian positive definite.
  const beta = new Array<number>(p).fill(0)
  // Seeding the intercept at the empirical log-odds starts Newton at the
  // intercept-only MLE, which is its exact solution when every coefficient is
  // 0 — so the first step is already a descent on the coefficients rather than
  // a correction of the base rate.
  let positives = 0
  for (const v of y) positives += v
  const baseRate = positives / n
  beta[0] = baseRate <= 0 || baseRate >= 1 ? 0 : Math.log(baseRate / (1 - baseRate))

  let converged = false
  let iterations = 0
  let hessian: number[][] = []
  let fisher: number[][] = []

  for (let it = 0; it < maxIterations; it++) {
    iterations = it + 1
    const grad = new Array<number>(p).fill(0)
    fisher = Array.from({ length: p }, () => new Array<number>(p).fill(0))

    for (let i = 0; i < n; i++) {
      const xi = X[i]
      let eta = 0
      for (let a = 0; a < p; a++) eta += beta[a] * xi[a]
      const mu = sigmoid(eta)
      const resid = y[i] - mu
      const w = mu * (1 - mu)
      for (let a = 0; a < p; a++) {
        if (xi[a] === 0) continue
        grad[a] += xi[a] * resid
        const wxa = w * xi[a]
        for (let b = a; b < p; b++) fisher[a][b] += wxa * xi[b]
      }
    }
    for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) fisher[a][b] = fisher[b][a]

    // Penalised gradient and Hessian. H = XᵀWX + λP, P = diag(0, 1, …, 1).
    hessian = fisher.map(r => [...r])
    for (let a = 1; a < p; a++) {
      grad[a] -= ridge * beta[a]
      hessian[a][a] += ridge
    }
    // The intercept column is never penalised, so on a degenerate dataset
    // (every y identical) W → 0 and H[0][0] → 0. A small floor keeps the
    // factorisation defined; it perturbs nothing when W is non-degenerate.
    if (!(hessian[0][0] > 0)) hessian[0][0] = Number.EPSILON

    const l = cholesky(hessian)
    if (l === null) {
      throw new Error('fitLinearSignalModel: penalised Hessian is not positive definite')
    }
    const step = choleskySolve(l, grad)
    let maxStep = 0
    for (let a = 0; a < p; a++) {
      beta[a] += step[a]
      maxStep = Math.max(maxStep, Math.abs(step[a]))
    }
    if (maxStep < tolerance) {
      converged = true
      break
    }
  }

  // ── Covariance: the sandwich H⁻¹ (XᵀWX) H⁻¹ ─────────────────────────────────
  const hInv = choleskyInverse(hessian)
  if (hInv === null) throw new Error('fitLinearSignalModel: Hessian inverse is undefined')
  const covariance = multiply(multiply(hInv, fisher), hInv)

  // ── Optional magnitude model: OLS of forward return on the linear predictor ─
  let moveIntercept: number | null = null
  let moveSlope: number | null = null
  let moveRows = 0
  const etas: number[] = []
  const rets: number[] = []
  for (let i = 0; i < n; i++) {
    const r = rows[i].forwardReturn
    if (r === undefined || !Number.isFinite(r)) continue
    let eta = 0
    for (let a = 0; a < p; a++) eta += beta[a] * X[i][a]
    etas.push(eta)
    rets.push(r)
  }
  moveRows = etas.length
  if (moveRows >= 2) {
    let se = 0, sr = 0
    for (let i = 0; i < moveRows; i++) { se += etas[i]; sr += rets[i] }
    const me = se / moveRows, mr = sr / moveRows
    let sxy = 0, sxx = 0
    for (let i = 0; i < moveRows; i++) {
      const d = etas[i] - me
      sxy += d * (rets[i] - mr)
      sxx += d * d
    }
    if (sxx > 0) {
      moveSlope = sxy / sxx
      moveIntercept = mr - moveSlope * me
    } else {
      // The linear predictor is constant, so there is no slope to estimate.
      // The unconditional mean is still the best available estimate of E[r].
      moveSlope = 0
      moveIntercept = mr
    }
  }

  const fittedCount = fitted.filter(Boolean).length
  const minorityEvents = Math.min(positives, n - positives)

  return {
    features: [...featureNames],
    intercept: beta[0],
    coefficients: beta.slice(1),
    moments,
    dropped,
    covariance,
    ridge,
    trainingRows: n,
    trainingPositives: positives,
    eventsPerVariable: fittedCount > 0 ? minorityEvents / fittedCount : 0,
    converged,
    iterations,
    moveIntercept,
    moveSlope,
    moveRows,
  }
}

function multiply(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number[][] {
  const n = a.length, m = b[0].length, inner = b.length
  const out: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(0))
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < inner; k++) {
      const aik = a[i][k]
      if (aik === 0) continue
      for (let j = 0; j < m; j++) out[i][j] += aik * b[k][j]
    }
  }
  return out
}
