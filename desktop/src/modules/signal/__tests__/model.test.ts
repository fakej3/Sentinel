import { describe, it, expect } from 'vitest'
import {
  LinearSignalModel, MIN_FEATURE_SUPPORT, cholesky, choleskyInverse, choleskySolve,
  fitLinearSignalModel, sigmoid,
} from '../model'
import type { ModelWeights, TrainingRow } from '../model'
import type { RegimeState, ScaledFeatures } from '../types'
import { gauss, uniform } from './fixtures'

const NO_REGIME: RegimeState = {
  varianceRatio: null, returnAutocorr: null, volatilityRatio: null, sampleSize: 0,
}

/**
 * Generates rows from a KNOWN logistic model, so the fit can be checked against
 * the truth rather than against itself.
 *
 *     P(y = 1) = sigmoid(intercept + Σ β_j x_j),  x_j ~ N(0, 1)
 */
function logisticRows(
  n: number, seed: number, intercept: number, betas: readonly number[],
  options: { forwardReturn?: (eta: number) => number } = {},
): TrainingRow[] {
  const z = gauss(seed)
  const u = uniform(seed ^ 0x9e3779b9)
  const names = betas.map((_, j) => `f${j}`)
  const rows: TrainingRow[] = []
  for (let i = 0; i < n; i++) {
    const features: Record<string, number> = {}
    let eta = intercept
    for (let j = 0; j < betas.length; j++) {
      const x = z()
      features[names[j]] = x
      eta += betas[j] * x
    }
    const outcome: 0 | 1 = u() < sigmoid(eta) ? 1 : 0
    rows.push(options.forwardReturn === undefined
      ? { features, outcome }
      : { features, outcome, forwardReturn: options.forwardReturn(eta) })
  }
  return rows
}

const NAMES = (k: number): string[] => Array.from({ length: k }, (_, j) => `f${j}`)

describe('sigmoid', () => {
  it('is 0.5 at zero and symmetric', () => {
    expect(sigmoid(0)).toBe(0.5)
    for (const z of [0.1, 1, 5, 40]) expect(sigmoid(-z)).toBeCloseTo(1 - sigmoid(z), 15)
  })

  it('does not overflow at extreme arguments', () => {
    expect(sigmoid(1000)).toBe(1)
    expect(sigmoid(-1000)).toBe(0)
    expect(Number.isFinite(sigmoid(-1e308))).toBe(true)
  })
})

describe('cholesky', () => {
  const A = [[4, 12, -16], [12, 37, -43], [-16, -43, 98]]   // textbook SPD example

  it('reproduces the textbook factor', () => {
    // The standard worked example: L = [[2,0,0],[6,1,0],[-8,5,3]].
    const l = cholesky(A)!
    expect(l[0]).toEqual([2, 0, 0])
    expect(l[1]).toEqual([6, 1, 0])
    expect(l[2]).toEqual([-8, 5, 3])
  })

  it('satisfies A = L·Lᵀ', () => {
    const l = cholesky(A)!
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0
        for (let k = 0; k < 3; k++) s += l[i][k] * l[j][k]
        expect(s).toBeCloseTo(A[i][j], 12)
      }
    }
  })

  it('returns null rather than NaN for a non-positive-definite matrix', () => {
    expect(cholesky([[1, 2], [2, 1]])).toBeNull()      // eigenvalues 3 and -1
    expect(cholesky([[0, 0], [0, 0]])).toBeNull()
  })

  it('solves A·x = b', () => {
    const l = cholesky(A)!
    const b = [1, 2, 3]
    const x = choleskySolve(l, b)
    for (let i = 0; i < 3; i++) {
      let s = 0
      for (let j = 0; j < 3; j++) s += A[i][j] * x[j]
      expect(s).toBeCloseTo(b[i], 10)
    }
  })

  it('inverts to the identity', () => {
    const inv = choleskyInverse(A)!
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0
        for (let k = 0; k < 3; k++) s += A[i][k] * inv[k][j]
        expect(s).toBeCloseTo(i === j ? 1 : 0, 10)
      }
    }
  })

  it('produces an exactly symmetric inverse', () => {
    const inv = choleskyInverse(A)!
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(inv[i][j]).toBe(inv[j][i])
  })
})

describe('fitLinearSignalModel — recovery', () => {
  it('recovers known coefficients on data generated from a known model', () => {
    // n = 20000 standardised predictors with P ≈ 0.5. The asymptotic standard
    // error of a logistic coefficient is 1/√(n·E[w]) with w = p(1−p) ≤ 0.25,
    // so se ≥ 1/√(20000·0.25) = 0.0141. Four standard errors is 0.057; the
    // tolerance below is DERIVED from that, not chosen to make the test pass.
    const truth = [0.5, -0.8, 0.3]
    const rows = logisticRows(20_000, 101, 0.2, truth)
    const w = fitLinearSignalModel(rows, NAMES(3), { ridge: 0.01 })
    expect(w.converged).toBe(true)
    for (let j = 0; j < truth.length; j++) {
      expect(Math.abs(w.coefficients[j] - truth[j]), `beta[${j}]`).toBeLessThan(0.06)
    }
    expect(Math.abs(w.intercept - 0.2)).toBeLessThan(0.06)
  })

  it('recovers a null model as null — no coefficient is invented from noise', () => {
    // The most important negative result in the file. Phase 8 found no
    // detectable information in any indicator on real data; a fitter that
    // manufactures coefficients on pure noise would turn that into an edge.
    const rows = logisticRows(20_000, 202, 0, [0, 0, 0])
    const w = fitLinearSignalModel(rows, NAMES(3), { ridge: 0.01 })
    for (let j = 0; j < 3; j++) expect(Math.abs(w.coefficients[j])).toBeLessThan(0.06)
  })

  it('reports the base rate it was trained on', () => {
    const rows = logisticRows(2000, 303, 1.0, [0.5])
    const w = fitLinearSignalModel(rows, NAMES(1))
    expect(w.trainingRows).toBe(2000)
    expect(w.trainingPositives).toBeGreaterThan(1000)
    expect(w.trainingPositives).toBeLessThan(2000)
  })
})

describe('fitLinearSignalModel — regularisation', () => {
  it('shrinks coefficients monotonically as the ridge grows', () => {
    const rows = logisticRows(2000, 404, 0, [1.0, -1.0])
    const norms = [0.01, 1, 10, 100, 1000].map(ridge => {
      const w = fitLinearSignalModel(rows, NAMES(2), { ridge })
      return Math.hypot(...w.coefficients)
    })
    for (let i = 1; i < norms.length; i++) {
      expect(norms[i], `ridge step ${i}`).toBeLessThan(norms[i - 1])
    }
  })

  it('keeps coefficients finite on perfectly separable data', () => {
    // Unpenalised logistic regression diverges here: the likelihood is
    // maximised at |beta| → ∞. The ridge is the reason this terminates.
    const rows: TrainingRow[] = []
    for (let i = 0; i < 200; i++) {
      const x = (i - 100) / 50
      rows.push({ features: { f0: x }, outcome: x > 0 ? 1 : 0 })
    }
    const w = fitLinearSignalModel(rows, ['f0'], { ridge: 1 })
    expect(Number.isFinite(w.coefficients[0])).toBe(true)
    expect(Math.abs(w.coefficients[0])).toBeLessThan(100)
  })

  it('never shrinks the intercept — the base rate is not a coefficient', () => {
    // Every feature is noise, so the fit must reproduce the base rate exactly
    // no matter how hard the coefficients are penalised.
    const rows: TrainingRow[] = []
    const u = uniform(505)
    for (let i = 0; i < 4000; i++) rows.push({ features: { f0: u() - 0.5 }, outcome: u() < 0.8 ? 1 : 0 })
    const base = rows.filter(r => r.outcome === 1).length / rows.length
    const w = fitLinearSignalModel(rows, ['f0'], { ridge: 1e6 })
    expect(sigmoid(w.intercept)).toBeCloseTo(base, 6)
  })
})

describe('fitLinearSignalModel — determinism', () => {
  const rows = logisticRows(1500, 606, 0.1, [0.6, -0.4])

  it('produces bit-identical weights for identical input', () => {
    const a = fitLinearSignalModel(rows, NAMES(2))
    const b = fitLinearSignalModel(rows, NAMES(2))
    expect(a).toEqual(b)
    expect(a.coefficients[0]).toBe(b.coefficients[0])
    expect(a.covariance).toEqual(b.covariance)
  })

  it('produces identical predictions from identical weights', () => {
    const w = fitLinearSignalModel(rows, NAMES(2))
    const m1 = new LinearSignalModel(w)
    const m2 = new LinearSignalModel(w)
    const x: ScaledFeatures = { f0: 0.3, f1: -1.1 }
    expect(m1.predict(x)).toEqual(m2.predict(x))
  })
})

describe('fitLinearSignalModel — rejection', () => {
  const rows = logisticRows(100, 707, 0, [0.5])

  it('rejects a non-positive ridge', () => {
    expect(() => fitLinearSignalModel(rows, ['f0'], { ridge: 0 })).toThrow(/ridge must be > 0/)
    expect(() => fitLinearSignalModel(rows, ['f0'], { ridge: -1 })).toThrow(/ridge must be > 0/)
  })

  it('rejects empty inputs', () => {
    expect(() => fitLinearSignalModel([], ['f0'])).toThrow(/no training rows/)
    expect(() => fitLinearSignalModel(rows, [])).toThrow(/no features/)
  })

  it('rejects duplicate feature names', () => {
    expect(() => fitLinearSignalModel(rows, ['f0', 'f0'])).toThrow(/duplicate feature names/)
  })

  it('rejects a non-binary outcome', () => {
    const bad = [{ features: { f0: 1 }, outcome: 2 as unknown as 0 }]
    expect(() => fitLinearSignalModel(bad, ['f0'])).toThrow(/outcome must be 0 or 1/)
  })
})

describe('fitLinearSignalModel — feature eligibility', () => {
  it('drops a constant feature instead of dividing by a zero standard deviation', () => {
    const rows = logisticRows(500, 808, 0, [0.5]).map(r => ({ ...r, features: { ...r.features, flat: 7 } }))
    const w = fitLinearSignalModel(rows, ['f0', 'flat'])
    expect(w.dropped).toContain('flat')
    expect(w.coefficients[1]).toBe(0)
    expect(w.moments[1].sd).toBe(0)
  })

  it('drops a feature with too little training support', () => {
    const rows = logisticRows(500, 909, 0, [0.5]).map((r, i) => ({
      ...r,
      features: { ...r.features, sparse: i < MIN_FEATURE_SUPPORT - 1 ? i : null },
    }))
    const w = fitLinearSignalModel(rows, ['f0', 'sparse'])
    expect(w.dropped).toContain('sparse')
    expect(w.coefficients[1]).toBe(0)
  })

  it('reports events per variable so an underpowered fit is visible', () => {
    const rows = logisticRows(60, 1010, 0, [0.5, 0.5, 0.5])
    const w = fitLinearSignalModel(rows, NAMES(3))
    // minority events / fitted coefficients — below ~10 the fit is
    // conventionally unreliable, and the number says so rather than hiding it.
    expect(w.eventsPerVariable).toBeCloseTo(Math.min(w.trainingPositives, 60 - w.trainingPositives) / 3, 12)
  })
})

describe('fitLinearSignalModel — magnitude model', () => {
  it('is absent when no forward returns are supplied', () => {
    const w = fitLinearSignalModel(logisticRows(300, 1111, 0, [0.5]), ['f0'])
    expect(w.moveSlope).toBeNull()
    expect(w.moveIntercept).toBeNull()
    expect(w.moveRows).toBe(0)
    expect(new LinearSignalModel(w).predict({ f0: 1 }).expectedMove).toBeNull()
  })

  it('recovers a linear relationship between the predictor and the return', () => {
    // Forward return is constructed as exactly 0.02·eta − 0.001, so OLS of the
    // return on the linear predictor must recover those two numbers.
    const rows = logisticRows(4000, 1212, 0, [0.8, -0.5], { forwardReturn: eta => 0.02 * eta - 0.001 })
    const w = fitLinearSignalModel(rows, NAMES(2), { ridge: 0.01 })
    expect(w.moveRows).toBe(4000)
    // The fitted eta differs slightly from the generating eta (coefficients are
    // estimated), so the recovered slope is 0.02 up to that estimation error.
    expect(w.moveSlope!).toBeCloseTo(0.02, 3)

    // The INTERCEPT is not recovered to the same precision, and the reason is
    // worth stating rather than absorbing into a loose tolerance. Standardised
    // features have exactly zero sample mean, so E[eta_hat] is exactly the
    // fitted intercept b0, and the OLS intercept is therefore
    //     a = E[r] − slope·b0 = -0.001 − slope·b0.
    // b0 estimates 0 with standard error 1/sqrt(n·E[w]); with Var(eta) = 0.89,
    // E[p(1−p)] ≈ 0.19, giving se(b0) ≈ 1/sqrt(4000·0.19) = 0.036. Four of
    // those, scaled by the slope, is 0.02 × 0.145 = 0.0029 — which is the
    // tolerance, DERIVED. An earlier version of this test asserted 3 decimal
    // places and failed, because 3 decimal places was a guess.
    expect(Math.abs(w.moveIntercept! - (-0.001))).toBeLessThan(0.003)

    // The exact OLS identity, which holds to floating point regardless of n:
    // the fitted line passes through the means of both variables.
    let sumEta = 0, sumR = 0
    for (const r of rows) {
      let eta = w.intercept
      for (let j = 0; j < 2; j++) {
        const v = r.features[`f${j}`]!
        eta += w.coefficients[j] * ((v - w.moments[j].mean) / w.moments[j].sd)
      }
      sumEta += eta
      sumR += r.forwardReturn!
    }
    expect(w.moveIntercept! + w.moveSlope! * (sumEta / 4000)).toBeCloseTo(sumR / 4000, 12)
    const out = new LinearSignalModel(w).predict({ f0: 1, f1: 0 })
    expect(out.expectedMove!).toBeCloseTo(w.moveIntercept! + w.moveSlope! * out.linearPredictor!, 12)
  })
})

describe('LinearSignalModel — output structure', () => {
  const weights = fitLinearSignalModel(logisticRows(3000, 1313, 0.1, [0.9, -0.6, 0.2]), NAMES(3), { ridge: 0.01 })
  const model = new LinearSignalModel(weights)
  const x: ScaledFeatures = { f0: 0.5, f1: -0.5, f2: 1.5 }

  it('reports probabilityShort as exactly the complement of probabilityLong', () => {
    const o = model.predict(x)
    expect(o.probabilityShort!).toBe(1 - o.probabilityLong!)
  })

  it('reports edge as probabilityLong minus one half', () => {
    const o = model.predict(x)
    expect(o.edge!).toBe(o.probabilityLong! - 0.5)
  })

  it('decomposes exactly: intercept plus every contribution equals the linear predictor', () => {
    const o = model.predict(x)
    let s = weights.intercept
    for (const c of o.contributions) s += c.contribution
    expect(s).toBeCloseTo(o.linearPredictor!, 12)
  })

  it('applies the logistic link to the linear predictor and nothing else', () => {
    const o = model.predict(x)
    expect(o.probabilityLong!).toBe(sigmoid(o.linearPredictor!))
  })

  it('reports importances that sum to one', () => {
    const o = model.predict(x)
    let s = 0
    for (const c of o.contributions) s += c.importance
    expect(s).toBeCloseTo(1, 12)
  })

  it('ranks importance by the magnitude of the standardised coefficient', () => {
    const o = model.predict(x)
    const byName = new Map(o.contributions.map(c => [c.name, c.importance]))
    // The generating coefficients were 0.9, -0.6, 0.2, so f0 > f1 > f2.
    expect(byName.get('f0')!).toBeGreaterThan(byName.get('f1')!)
    expect(byName.get('f1')!).toBeGreaterThan(byName.get('f2')!)
  })

  it('returns a raw score naming which features it used and which it did not', () => {
    const s = model.score({ f0: 0.5, f1: null, f2: 1.5 }, NO_REGIME)!
    expect(s.value).toBeCloseTo(model.predict({ f0: 0.5, f1: null, f2: 1.5 }).linearPredictor!, 15)
    expect(s.used.sort()).toEqual(['f0', 'f2'])
    expect(s.missing).toEqual(['f1'])
  })

  it('ignores the regime argument — regime enters as a feature, not a second path', () => {
    const hot: RegimeState = { varianceRatio: 3, returnAutocorr: 0.9, volatilityRatio: 5, sampleSize: 999 }
    expect(model.score(x, hot)).toEqual(model.score(x, NO_REGIME))
  })
})

describe('LinearSignalModel — monotonicity', () => {
  const weights = fitLinearSignalModel(logisticRows(3000, 1414, 0, [1.2, -0.9]), NAMES(2), { ridge: 0.01 })
  const model = new LinearSignalModel(weights)

  it('is monotonically increasing in a feature with a positive coefficient', () => {
    expect(weights.coefficients[0]).toBeGreaterThan(0)
    let prev = -Infinity
    for (const v of [-3, -2, -1, 0, 1, 2, 3]) {
      const p = model.predict({ f0: v, f1: 0 }).probabilityLong!
      expect(p).toBeGreaterThan(prev)
      prev = p
    }
  })

  it('is monotonically decreasing in a feature with a negative coefficient', () => {
    expect(weights.coefficients[1]).toBeLessThan(0)
    let prev = Infinity
    for (const v of [-3, -2, -1, 0, 1, 2, 3]) {
      const p = model.predict({ f0: 0, f1: v }).probabilityLong!
      expect(p).toBeLessThan(prev)
      prev = p
    }
  })

  it('keeps the probability strictly inside [0, 1] at extreme inputs', () => {
    for (const v of [-1e6, 1e6]) {
      const p = model.predict({ f0: v, f1: 0 }).probabilityLong!
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
      expect(Number.isFinite(p)).toBe(true)
    }
  })
})

describe('LinearSignalModel — uncertainty and abstention', () => {
  const weights = fitLinearSignalModel(logisticRows(3000, 1515, 0, [1.0, -0.8, 0.6, 0.4]), NAMES(4), { ridge: 0.01 })
  const model = new LinearSignalModel(weights)

  it('brackets the probability with its interval', () => {
    const o = model.predict({ f0: 0.4, f1: 0.1, f2: -0.2, f3: 0.9 })
    expect(o.interval!.lower).toBeLessThanOrEqual(o.probabilityLong!)
    expect(o.interval!.upper).toBeGreaterThanOrEqual(o.probabilityLong!)
    expect(o.interval!.lower).toBeGreaterThanOrEqual(0)
    expect(o.interval!.upper).toBeLessThanOrEqual(1)
  })

  it('widens the interval when a feature is missing', () => {
    const full = model.predict({ f0: 0.4, f1: 0.1, f2: -0.2, f3: 0.9 })
    const part = model.predict({ f0: 0.4, f1: null, f2: -0.2, f3: 0.9 })
    expect(part.uncertainty!).toBeGreaterThan(full.uncertainty!)
  })

  it('inflates the variance by exactly the missing coefficient squared', () => {
    // Var(eta) = xᵀΣx + Σ_{missing} β². Zeroing a feature's input leaves the
    // first term unchanged, so the difference of the two variances must be
    // exactly β² for the feature that went missing.
    const observedZero = model.predict({ f0: 0.4, f1: 0, f2: -0.2, f3: 0.9 })
    const missing = model.predict({ f0: 0.4, f1: null, f2: -0.2, f3: 0.9 })
    const beta1 = weights.coefficients[1]
    // f1 = 0 in scaled space is not 0 in standardised space unless the training
    // mean is 0, so compare against the standardised-zero point instead.
    const atMean = model.predict({ f0: 0.4, f1: weights.moments[1].mean, f2: -0.2, f3: 0.9 })
    expect(missing.uncertainty! ** 2 - atMean.uncertainty! ** 2).toBeCloseTo(beta1 * beta1, 10)
    expect(observedZero.abstain).toBeNull()
  })

  it('reports how many features were observed and how many imputed', () => {
    const o = model.predict({ f0: 0.4, f1: null, f2: null, f3: 0.9 })
    expect(o.observed).toBe(2)
    expect(o.imputed).toBe(2)
    expect(o.contributions.filter(c => c.imputed).map(c => c.name)).toEqual(['f1', 'f2'])
  })

  it('gives an imputed feature a contribution of exactly zero', () => {
    // Standardisation puts the training mean at 0, so imputing the mean adds
    // nothing to the linear predictor. That is the point of standardising.
    const o = model.predict({ f0: 0.4, f1: null, f2: -0.2, f3: 0.9 })
    // `=== 0`, not `toBe(0)`: the product of a negative coefficient and a zero
    // input is IEEE-754 negative zero, and Object.is distinguishes -0 from +0.
    // The claim being made is the arithmetic one — the term adds nothing —
    // and -0 satisfies it. Asserting +0 would be asserting a sign bit.
    expect(o.contributions.find(c => c.name === 'f1')!.contribution === 0).toBe(true)
  })

  it('abstains once the missing features carry most of the predictive variance', () => {
    // beta = (1.0, -0.8, 0.6, 0.4) roughly, so Σβ² ≈ 2.16. Dropping f0 and f1
    // removes ≈ 1.64, which is 76% — past the break-even point of 0.5.
    const o = model.predict({ f0: null, f1: null, f2: -0.2, f3: 0.9 })
    expect(o.abstain).toBe('too-many-missing-features')
    expect(o.probabilityLong).toBeNull()
    expect(o.linearPredictor).toBeNull()
    expect(o.interval).toBeNull()
    // The trace survives the abstention — a refusal must still be explicable.
    expect(o.contributions.length).toBe(4)
  })

  it('abstains when every feature is missing', () => {
    expect(model.predict({}).abstain).toBe('too-many-missing-features')
  })

  it('scores null when it abstains, so a caller cannot use the score anyway', () => {
    expect(model.score({ f0: null, f1: null, f2: null, f3: null }, NO_REGIME)).toBeNull()
  })

  it('abstains with "no-usable-features" when every coefficient is zero', () => {
    const zeroed: ModelWeights = { ...weights, coefficients: [0, 0, 0, 0] }
    expect(new LinearSignalModel(zeroed).predict({ f0: 1, f1: 1, f2: 1, f3: 1 }).abstain)
      .toBe('no-usable-features')
  })

  it('honours a caller-supplied information threshold', () => {
    const strict = new LinearSignalModel(weights, 'strict', 0.99)
    expect(strict.predict({ f0: 0.4, f1: null, f2: -0.2, f3: 0.9 }).abstain).toBe('too-many-missing-features')
    const lax = new LinearSignalModel(weights, 'lax', 0)
    expect(lax.predict({ f0: null, f1: null, f2: null, f3: 0.9 }).abstain).toBeNull()
  })

  it('treats a NaN input as missing rather than propagating it', () => {
    const o = model.predict({ f0: 0.4, f1: NaN, f2: -0.2, f3: 0.9 })
    expect(o.contributions.find(c => c.name === 'f1')!.imputed).toBe(true)
    expect(Number.isFinite(o.probabilityLong!)).toBe(true)
  })

  it('treats an Infinity input as missing rather than producing an infinite score', () => {
    const o = model.predict({ f0: 0.4, f1: Infinity, f2: -0.2, f3: 0.9 })
    expect(o.contributions.find(c => c.name === 'f1')!.imputed).toBe(true)
    expect(Number.isFinite(o.linearPredictor!)).toBe(true)
  })

  it('treats an unknown feature key as absent rather than reading it', () => {
    const withJunk = model.predict({ f0: 0.4, f1: 0.1, f2: -0.2, f3: 0.9, unknown: 99 })
    const without = model.predict({ f0: 0.4, f1: 0.1, f2: -0.2, f3: 0.9 })
    expect(withJunk.linearPredictor).toBe(without.linearPredictor)
    expect(withJunk.contributions.length).toBe(4)
  })
})

describe('LinearSignalModel — construction', () => {
  const weights = fitLinearSignalModel(logisticRows(300, 1616, 0, [0.5, 0.5]), NAMES(2))

  it('rejects weights whose arrays disagree in length', () => {
    expect(() => new LinearSignalModel({ ...weights, coefficients: [1] }))
      .toThrow(/2 features but 1 coefficients/)
    expect(() => new LinearSignalModel({ ...weights, moments: [weights.moments[0]] }))
      .toThrow(/2 features but 1 moments/)
  })

  it('rejects a covariance of the wrong shape', () => {
    expect(() => new LinearSignalModel({ ...weights, covariance: [[1, 0], [0, 1]] }))
      .toThrow(/covariance must be 3x3/)
  })

  it('exposes the feature list it consumes', () => {
    expect(new LinearSignalModel(weights).features).toEqual(['f0', 'f1'])
    expect(new LinearSignalModel(weights, 'named').name).toBe('named')
  })
})
