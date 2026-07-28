import { describe, it, expect } from 'vitest'
import {
  MIN_CALIBRATION_SUPPORT, assessCalibrator, brierScore, brierSkillScore,
  fitIsotonic, fitPlatt, reliabilityCurve,
} from '../calibration'
import { sigmoid } from '../model'
import { gauss, uniform } from './fixtures'

/** Repeats a pattern so blocks clear MIN_CALIBRATION_SUPPORT without changing their means. */
function repeat<T>(xs: readonly T[], times: number): T[] {
  const out: T[] = []
  for (let i = 0; i < times; i++) out.push(...xs)
  return out
}

describe('brierScore', () => {
  it('is 0 for a perfect, certain forecast', () => {
    expect(brierScore([1, 0, 1], [true, false, true])).toBe(0)
  })

  it('is 1 for a perfectly wrong, certain forecast', () => {
    expect(brierScore([0, 1], [true, false])).toBe(1)
  })

  it('is 0.25 for a forecast of one half, whatever happens', () => {
    expect(brierScore([0.5, 0.5, 0.5, 0.5], [true, false, true, false])).toBe(0.25)
  })

  it('matches the definition on a worked example', () => {
    //  ((0.8-1)² + (0.3-0)² + (0.6-1)²) / 3 = (0.04 + 0.09 + 0.16) / 3 = 0.29 / 3
    expect(brierScore([0.8, 0.3, 0.6], [true, false, true])!).toBeCloseTo(0.29 / 3, 15)
  })

  it('is null on an empty sample rather than 0', () => {
    expect(brierScore([], [])).toBeNull()
  })

  it('rejects a probability outside [0, 1] instead of clamping it', () => {
    expect(() => brierScore([1.3], [true])).toThrow(/must be a finite number in \[0, 1\]/)
    expect(() => brierScore([-0.1], [true])).toThrow(/\[0, 1\]/)
    expect(() => brierScore([NaN], [true])).toThrow(/\[0, 1\]/)
  })

  it('rejects a length mismatch', () => {
    expect(() => brierScore([0.5], [true, false])).toThrow(/length mismatch/)
  })

  it('does not depend on the order of the observations', () => {
    const p = [0.1, 0.9, 0.4, 0.7, 0.2]
    const y = [false, true, false, true, true]
    const idx = [4, 0, 3, 1, 2]
    expect(brierScore(idx.map(i => p[i]), idx.map(i => y[i]))!)
      .toBeCloseTo(brierScore(p, y)!, 15)
  })
})

describe('brierSkillScore', () => {
  it('is exactly 0 for a constant forecast of the base rate', () => {
    const y = [true, true, true, false, false, false, false, false, false, false]  // base 0.3
    expect(brierSkillScore(y.map(() => 0.3), y)!).toBeCloseTo(0, 12)
  })

  it('is 1 for a perfect forecast', () => {
    const y = [true, false, true, false]
    expect(brierSkillScore(y.map(v => (v ? 1 : 0)), y)).toBe(1)
  })

  it('is negative for a forecast worse than the base rate', () => {
    const y = [true, true, true, false]
    expect(brierSkillScore(y.map(v => (v ? 0.1 : 0.9)), y)!).toBeLessThan(0)
  })

  it('is null when every outcome is identical — no skill is definable', () => {
    expect(brierSkillScore([0.7, 0.7], [true, true])).toBeNull()
  })
})

describe('reliabilityCurve', () => {
  it('reports near-zero calibration error for a well-calibrated forecast', () => {
    // Draw p uniformly, then draw the outcome WITH probability p. The forecast
    // is calibrated by construction, so ECE measures only sampling noise.
    const u = uniform(31)
    const p: number[] = []
    const y: boolean[] = []
    for (let i = 0; i < 50_000; i++) { const pi = u(); p.push(pi); y.push(u() < pi) }
    const c = reliabilityCurve(p, y)
    // Each of 10 bins holds ~5000 draws, so a bin frequency has standard error
    // ~0.5/sqrt(5000) = 0.007. ECE is a weighted mean of |deviations|, whose
    // expectation is sqrt(2/pi)·0.007 ≈ 0.0056. The bound below is 3x that.
    expect(c.ece!).toBeLessThan(0.017)
    expect(c.n).toBe(50_000)
  })

  it('measures the exact bias of a systematically overconfident forecast', () => {
    // Every forecast is 0.9 but the event happens 60% of the time, so the
    // calibration error is exactly 0.30 by construction.
    const y = Array.from({ length: 1000 }, (_, i) => i % 10 < 6)
    const c = reliabilityCurve(y.map(() => 0.9), y)
    expect(c.ece!).toBeCloseTo(0.3, 12)
    expect(c.mce!).toBeCloseTo(0.3, 12)
  })

  it('uses the mean forecast in a bin, not the bin midpoint', () => {
    // All forecasts are 0.11 and all outcomes false. Against the mean the error
    // is 0.11; against the midpoint of [0.1, 0.2) it would be 0.15.
    const y = Array.from({ length: 100 }, () => false)
    const c = reliabilityCurve(y.map(() => 0.11), y)
    expect(c.ece!).toBeCloseTo(0.11, 12)
  })

  it('places p = 1 in the top bin rather than dropping it', () => {
    const c = reliabilityCurve([1, 1, 1], [true, true, true])
    expect(c.bins[9].n).toBe(3)
    let total = 0
    for (const b of c.bins) total += b.n
    expect(total).toBe(3)
  })

  it('restricts MCE to bins with enough observations', () => {
    // One lone sample in the top bin, disagreeing completely; 200 in the bottom
    // bin, agreeing. With a floor of 10 the lone bin cannot set MCE.
    const p = [...Array.from({ length: 200 }, () => 0.05), 0.95]
    const y = [...Array.from({ length: 200 }, () => false), false]
    expect(reliabilityCurve(p, y, { minBinCount: 10 }).mce!).toBeCloseTo(0.05, 12)
    expect(reliabilityCurve(p, y, { minBinCount: 1 }).mce!).toBeCloseTo(0.95, 12)
  })

  it('rejects a non-positive bin count', () => {
    expect(() => reliabilityCurve([0.5], [true], { bins: 0 })).toThrow(/positive integer/)
  })

  it('handles an empty sample without throwing', () => {
    const c = reliabilityCurve([], [])
    expect(c.ece).toBeNull()
    expect(c.mce).toBeNull()
    expect(c.n).toBe(0)
  })
})

describe('fitIsotonic — the PAVA fit itself', () => {
  it('reproduces the textbook pooling on an alternating sequence', () => {
    // Scores 1..5 with outcomes 1,0,1,0,1. PAVA pools (1,2) to 0.5, then
    // (3,4) to 0.5, leaving [0.5, 0.5, 1.0] — worked out by hand above the
    // implementation and asserted here, not read off the output.
    const c = fitIsotonic([1, 2, 3, 4, 5], [true, false, true, false, true], { minSupport: 1 })
    expect(c.bins.map(b => b.probability)).toEqual([0.5, 0.5, 1])
    expect(c.bins.map(b => b.n)).toEqual([2, 2, 1])
    expect(c.bins.map(b => [b.lower, b.upper])).toEqual([[1, 2], [3, 4], [5, 5]])
  })

  it('leaves an already-monotone sequence untouched', () => {
    const c = fitIsotonic([1, 2, 3, 4], [false, false, true, true], { minSupport: 1 })
    expect(c.bins.map(b => b.probability)).toEqual([0, 0, 1, 1])
  })

  it('pools a fully reversed sequence into one block at the overall mean', () => {
    const c = fitIsotonic([1, 2, 3, 4], [true, true, false, false], { minSupport: 1 })
    expect(c.bins.length).toBe(1)
    expect(c.bins[0].probability).toBe(0.5)
    expect(c.bins[0].n).toBe(4)
  })

  it('pools exact ties into one block, so the fit is a function of the score', () => {
    const c = fitIsotonic([5, 5, 5, 5], [true, false, true, true], { minSupport: 1 })
    expect(c.bins.length).toBe(1)
    expect(c.bins[0].probability).toBe(0.75)
    expect(c.probability(5)!.p).toBe(0.75)
  })

  it('produces a non-decreasing fit for any input', () => {
    const z = gauss(41)
    const u = uniform(42)
    const s = Array.from({ length: 3000 }, () => z())
    const y = s.map(() => u() < 0.5)                // outcomes unrelated to score
    const c = fitIsotonic(s, y, { minSupport: 1 })
    for (let i = 1; i < c.bins.length; i++) {
      expect(c.bins[i].probability).toBeGreaterThanOrEqual(c.bins[i - 1].probability)
    }
  })

  it('is monotone as a function too, not only across blocks', () => {
    const c = fitIsotonic([1, 2, 3, 4, 5, 6], [false, true, false, true, true, true], { minSupport: 1 })
    let prev = -Infinity
    for (const s of [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6]) {
      const p = c.probability(s)!.p
      expect(p).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })

  it('recovers a known monotone relationship', () => {
    // P(y) = sigmoid(s). Isotonic assumes only monotonicity, so it should track
    // the true curve without being told its shape.
    const u = uniform(51)
    const s: number[] = []
    const y: boolean[] = []
    for (let i = 0; i < 40_000; i++) {
      const si = -3 + 6 * (i / 40_000)
      s.push(si)
      y.push(u() < sigmoid(si))
    }
    const c = fitIsotonic(s, y)
    for (const q of [-2, -1, 0, 1, 2]) {
      const got = c.probability(q)
      expect(got).not.toBeNull()
      // Local support around q is a few thousand points; a binomial proportion
      // from 2000 draws has se ≈ 0.011, and isotonic adds pooling bias, so
      // 0.05 is a generous but principled bound.
      expect(Math.abs(got!.p - sigmoid(q)), `at ${q}`).toBeLessThan(0.05)
    }
  })

  it('is deterministic under a permutation of tied scores', () => {
    const s = [1, 1, 1, 2, 2, 3]
    const a = fitIsotonic(s, [true, false, true, false, true, true], { minSupport: 1 })
    const b = fitIsotonic(s, [false, true, true, true, false, true], { minSupport: 1 })
    expect(a.bins).toEqual(b.bins)
  })
})

describe('fitIsotonic — refusal', () => {
  const c = fitIsotonic(
    repeat([1, 2, 3, 4, 5], 20),
    repeat([false, false, true, true, true], 20),
    { minSupport: 1 },
  )

  it('reports the support it was fitted on', () => {
    expect(c.support).toEqual({ min: 1, max: 5 })
  })

  it('refuses below the fitted minimum', () => {
    expect(c.probability(0.999)).toBeNull()
    expect(c.probability(-1000)).toBeNull()
  })

  it('refuses above the fitted maximum', () => {
    expect(c.probability(5.001)).toBeNull()
    expect(c.probability(1000)).toBeNull()
  })

  it('answers exactly at the boundaries, which are inside the support', () => {
    expect(c.probability(1)).not.toBeNull()
    expect(c.probability(5)).not.toBeNull()
  })

  it('refuses a non-finite score', () => {
    expect(c.probability(NaN)).toBeNull()
    expect(c.probability(Infinity)).toBeNull()
    expect(c.probability(-Infinity)).toBeNull()
  })

  it('refuses a block with too little support, and says how much it had when it answers', () => {
    // Twelve observations per distinct score, against a floor of 25.
    const thin = fitIsotonic(repeat([1, 2, 3], 12), repeat([false, true, true], 12))
    expect(thin.probability(2)).toBeNull()
    const thick = fitIsotonic(repeat([1, 2, 3], 40), repeat([false, true, true], 40))
    expect(thick.probability(2)!.n).toBeGreaterThanOrEqual(MIN_CALIBRATION_SUPPORT)
  })

  it('reports the block size behind every answer', () => {
    // Twenty observations per distinct score. Scores 3, 4 and 5 all have block
    // mean 1, and PAVA pools only VIOLATIONS of monotonicity — equal means are
    // already non-decreasing — so they stay three blocks of 20 rather than
    // merging into one of 60.
    const r = c.probability(3)!
    expect(r.n).toBe(20)
    expect(r.p).toBe(1)
    expect(c.bins.map(b => b.n)).toEqual([20, 20, 20, 20, 20])
    expect(c.bins.map(b => b.probability)).toEqual([0, 0, 1, 1, 1])
  })

  it('rejects a non-finite training score rather than fitting around it', () => {
    expect(() => fitIsotonic([1, NaN], [true, false])).toThrow(/must be finite/)
  })

  it('rejects a length mismatch and an empty sample', () => {
    expect(() => fitIsotonic([1, 2], [true])).toThrow(/length mismatch/)
    expect(() => fitIsotonic([], [])).toThrow(/no observations/)
  })
})

describe('fitPlatt', () => {
  const u = uniform(61)
  const s: number[] = []
  const y: boolean[] = []
  for (let i = 0; i < 20_000; i++) {
    const si = -4 + 8 * (i / 20_000)
    s.push(si)
    y.push(u() < sigmoid(1.5 * si - 0.5))
  }
  const c = fitPlatt(s, y)

  it('recovers the generating sigmoid', () => {
    // Platt parameterises p = 1/(1 + exp(A·s + B)), so recovering
    // p = sigmoid(1.5·s − 0.5) means A = −1.5 and B = +0.5.
    expect(c.parameters.a).toBeCloseTo(-1.5, 1)
    expect(c.parameters.b).toBeCloseTo(0.5, 1)
    expect(c.parameters.converged).toBe(true)
  })

  it('tracks the true probability across the fitted range', () => {
    for (const q of [-3, -1.5, 0, 1.5, 3]) {
      expect(Math.abs(c.probability(q)!.p - sigmoid(1.5 * q - 0.5)), `at ${q}`).toBeLessThan(0.03)
    }
  })

  it('is monotone in the score', () => {
    let prev = -Infinity
    for (let q = -4; q <= 4; q += 0.25) {
      const p = c.probability(q)?.p
      if (p === undefined) continue
      expect(p).toBeGreaterThan(prev)
      prev = p
    }
  })

  it('refuses outside the fitted score range', () => {
    expect(c.support.min).toBeCloseTo(-4, 6)
    expect(c.probability(c.support.min - 1e-6)).toBeNull()
    expect(c.probability(c.support.max + 1e-6)).toBeNull()
    expect(c.probability(1e9)).toBeNull()
  })

  it('does not diverge on perfectly separable data', () => {
    // The target smoothing of Lin, Lin & Weng is the whole reason this
    // terminates: without it the likelihood is maximised at A = -infinity.
    const ss = Array.from({ length: 400 }, (_, i) => (i - 200) / 40)
    const yy = ss.map(v => v > 0)
    const sep = fitPlatt(ss, yy, { minSupport: 1 })
    expect(Number.isFinite(sep.parameters.a)).toBe(true)
    expect(Math.abs(sep.parameters.a)).toBeLessThan(1e4)
    expect(sep.probability(2)!.p).toBeGreaterThan(sep.probability(-2)!.p)
  })

  it('handles a single-class sample without producing NaN', () => {
    const only = fitPlatt([1, 2, 3, 4], [true, true, true, true], { minSupport: 1 })
    for (const q of [1, 2, 3, 4]) {
      const p = only.probability(q)!.p
      expect(Number.isFinite(p)).toBe(true)
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })

  it('handles a degenerate score range without dividing by a zero bin width', () => {
    const flat = fitPlatt([2, 2, 2, 2], [true, false, true, false], { minSupport: 1 })
    expect(flat.support).toEqual({ min: 2, max: 2 })
    expect(Number.isFinite(flat.probability(2)!.p)).toBe(true)
  })

  it('is deterministic', () => {
    expect(fitPlatt(s, y).parameters).toEqual(fitPlatt(s, y).parameters)
  })

  it('refuses where local training support is thin, however smooth the curve is', () => {
    // 200 scores packed at one end plus a single outlier stretches the support
    // across bins that contain almost nothing.
    const packed = [...Array.from({ length: 200 }, (_, i) => i / 1000), 100]
    const outcomes = packed.map((_, i) => i % 2 === 0)
    const thin = fitPlatt(packed, outcomes, { minSupport: 25 })
    expect(thin.probability(50)).toBeNull()      // empty middle of the range
    expect(thin.probability(0.1)).not.toBeNull() // dense end
  })
})

describe('isotonic versus Platt', () => {
  it('isotonic tracks a non-sigmoid relationship that Platt cannot', () => {
    // A U-shaped-then-rising truth is monotone in neither direction over the
    // whole range, but the segment used here IS monotone and sharply stepped.
    // Isotonic has a parameter per distinct score; Platt has two.
    const u = uniform(71)
    const s: number[] = []
    const y: boolean[] = []
    for (let i = 0; i < 30_000; i++) {
      const si = i / 30_000                      // in [0, 1)
      const truth = si < 0.5 ? 0.1 : 0.9         // a step, not a sigmoid
      s.push(si)
      y.push(u() < truth)
    }
    const iso = fitIsotonic(s, y)
    const platt = fitPlatt(s, y)
    const err = (c: { probability(x: number): { p: number } | null }): number => {
      let e = 0, n = 0
      for (let q = 0.02; q < 0.99; q += 0.02) {
        const r = c.probability(q)
        if (r === null) continue
        e += Math.abs(r.p - (q < 0.5 ? 0.1 : 0.9))
        n++
      }
      return e / n
    }
    expect(err(iso)).toBeLessThan(err(platt))
  })
})

describe('assessCalibrator', () => {
  const train = { s: repeat([1, 2, 3, 4, 5], 40), y: repeat([false, false, true, true, true], 40) }
  const cal = fitIsotonic(train.s, train.y, { minSupport: 1 })

  it('reports coverage alongside every metric', () => {
    // Half the held-out scores sit outside the fitted support, so half must be
    // refused. A Brier score without this number would be uninterpretable.
    const a = assessCalibrator(cal, [1, 3, 5, 99, -99, 500], [false, true, true, true, false, true])
    expect(a.covered).toBe(3)
    expect(a.refused).toBe(3)
    expect(a.name).toBe('isotonic')
  })

  it('scores a calibrator that reproduces the training relationship well', () => {
    const a = assessCalibrator(cal, train.s, train.y)
    expect(a.covered).toBe(200)
    expect(a.refused).toBe(0)
    // The isotonic fit is exact on its own training data here: scores 1-2 map
    // to 0 and 3-5 to 1, and the outcomes are deterministic given the score.
    expect(a.brier!).toBeCloseTo(0, 12)
    expect(a.brierSkill!).toBeCloseTo(1, 12)
    expect(a.ece!).toBeCloseTo(0, 12)
  })

  it('reports nulls rather than throwing when everything is refused', () => {
    const a = assessCalibrator(cal, [999, -999], [true, false])
    expect(a.covered).toBe(0)
    expect(a.refused).toBe(2)
    expect(a.brier).toBeNull()
    expect(a.ece).toBeNull()
  })

  it('rejects a length mismatch', () => {
    expect(() => assessCalibrator(cal, [1, 2], [true])).toThrow(/length mismatch/)
  })
})
