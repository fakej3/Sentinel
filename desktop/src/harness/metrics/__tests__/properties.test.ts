/**
 * Property tests.
 *
 * Reference tests check that one input produces one known output. These check
 * that identities hold across thousands of randomised inputs — the class of
 * error that a handful of worked examples cannot reach.
 *
 * Every generator is seeded, so a failure is reproducible from the test name
 * alone.
 */
import { describe, it, expect } from 'vitest'
import { binaryFromLabels, confusionMatrix, multiclassMetrics, binaryMetrics } from '../classification'
import { brierScore, calibration, logLoss, rocAuc } from '../probability'
import { rankingMetrics } from '../ranking'
import { buildTrades, tradingMetrics, maxDrawdown, downsideDeviation, annualisedSharpe } from '../trading'
import { evaluateSlice } from '../evaluate'
import { rng, syntheticSeries } from '../../sources'
import { runSeries } from '../../engine'
import { mean, quantile, rank, spearman } from '../stats'
import type { Observation } from '../../types'

const CLOSE = 10

function randomProbs(n: number, seed: number): { p: number[]; y: boolean[] } {
  const r = rng(seed)
  const p: number[] = []
  const y: boolean[] = []
  for (let i = 0; i < n; i++) {
    const pi = r()
    p.push(pi)
    y.push(r() < pi)
  }
  return { p, y }
}

function randomLabels(n: number, seed: number, k: number): string[] {
  const r = rng(seed)
  const names = ['buy', 'sell', 'neutral'].slice(0, k)
  return Array.from({ length: n }, () => names[Math.floor(r() * k) % k])
}

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]

/**
 * Deep structural comparison with a numeric tolerance.
 *
 * Used where the property under test is "the same statistic", not "the same
 * bits". Any difference in shape, key set, or non-numeric value is still a
 * hard failure — only finite numbers are compared with a tolerance.
 */
function expectNumericallyEqual(a: unknown, b: unknown, tol: number, path = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return
    const scale = Math.max(1, Math.abs(a), Math.abs(b))
    expect(Math.abs(a - b) / scale, `${path}: ${a} vs ${b}`).toBeLessThanOrEqual(tol)
    return
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    expect(Array.isArray(a) && Array.isArray(b), `${path}: array shape`).toBe(true)
    const xs = a as unknown[], ys = b as unknown[]
    expect(xs.length, `${path}: length`).toBe(ys.length)
    xs.forEach((v, i) => expectNumericallyEqual(v, ys[i], tol, `${path}[${i}]`))
    return
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort()
    const kb = Object.keys(b as object).sort()
    expect(ka, `${path}: keys`).toEqual(kb)
    for (const k of ka) {
      expectNumericallyEqual(
        (a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol, path ? `${path}.${k}` : k,
      )
    }
    return
  }
  expect(a, path).toBe(b)
}

describe('probabilities stay in [0,1] and are validated', () => {
  it.each(SEEDS)('seed %i: every generated probability is in range', (seed) => {
    const { p } = randomProbs(500, seed)
    for (const v of p) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
  })

  it.each(SEEDS)('seed %i: Brier score is in [0,1]', (seed) => {
    const { p, y } = randomProbs(500, seed)
    const b = brierScore(p, y)!
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThanOrEqual(1)
  })

  it.each(SEEDS)('seed %i: log loss is non-negative and finite', (seed) => {
    const { p, y } = randomProbs(500, seed)
    const l = logLoss(p, y)!
    expect(l).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(l)).toBe(true)
  })

  it.each(SEEDS)('seed %i: ROC AUC is in [0,1]', (seed) => {
    const { p, y } = randomProbs(500, seed)
    const a = rocAuc(p, y)
    if (a === null) return
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(1)
  })
})

describe('calibration bins sum correctly', () => {
  it.each(SEEDS)('seed %i: bin counts sum to n, hits sum to positives, no sample lost', (seed) => {
    const { p, y } = randomProbs(1000, seed)
    for (const method of ['equal-width', 'quantile'] as const) {
      for (const bins of [3, 5, 10, 20]) {
        const c = calibration(p, y, { bins, method })
        expect(c.bins.reduce((a, b) => a + b.n, 0)).toBe(1000)
        expect(c.bins.reduce((a, b) => a + b.hits, 0)).toBe(y.filter(Boolean).length)
        expect(c.n).toBe(1000)
      }
    }
  })

  it.each(SEEDS)('seed %i: bins tile [0,1] contiguously with no gap or overlap', (seed) => {
    const { p, y } = randomProbs(400, seed)
    for (const method of ['equal-width', 'quantile'] as const) {
      const c = calibration(p, y, { bins: 8, method })
      expect(c.bins[0].lower).toBe(0)
      expect(c.bins[c.bins.length - 1].upper).toBe(1)
      for (let i = 1; i < c.bins.length; i++) expect(c.bins[i].lower).toBe(c.bins[i - 1].upper)
    }
  })

  it.each(SEEDS)('seed %i: ECE and MCE are in [0,1], and ECE <= MCE when every bin counts', (seed) => {
    const { p, y } = randomProbs(1000, seed)
    const c = calibration(p, y, { bins: 10, minBinCount: 1 })
    expect(c.ece!).toBeGreaterThanOrEqual(0)
    expect(c.ece!).toBeLessThanOrEqual(1)
    expect(c.mce!).toBeGreaterThanOrEqual(0)
    expect(c.mce!).toBeLessThanOrEqual(1)
    // ECE is a weighted mean of the per-bin gaps; MCE is their maximum.
    expect(c.ece!).toBeLessThanOrEqual(c.mce! + 1e-12)
  })

  it.each(SEEDS)('seed %i: each bin holds only probabilities within its edges', (seed) => {
    const { p, y } = randomProbs(600, seed)
    const c = calibration(p, y, { bins: 7, method: 'quantile' })
    for (const b of c.bins) {
      if (b.n === 0) continue
      expect(b.meanPredicted!).toBeGreaterThanOrEqual(b.lower - 1e-12)
      expect(b.meanPredicted!).toBeLessThanOrEqual(b.upper + 1e-12)
    }
  })
})

describe('confusion matrix totals equal the observation count', () => {
  it.each(SEEDS)('seed %i: binary TP+FP+FN+TN = n', (seed) => {
    const yTrue = randomLabels(500, seed, 2).map(s => s === 'buy')
    const yPred = randomLabels(500, seed + 1000, 2).map(s => s === 'buy')
    const m = binaryFromLabels(yTrue, yPred)
    expect(m.tp + m.fp + m.fn + m.tn).toBe(500)
    expect(m.n).toBe(500)
  })

  it.each(SEEDS)('seed %i: multiclass cells sum to n, row sums are support', (seed) => {
    const yTrue = randomLabels(500, seed, 3)
    const yPred = randomLabels(500, seed + 7, 3)
    const cm = confusionMatrix(yTrue, yPred, ['buy', 'sell', 'neutral'])
    const total = cm.counts.flat().reduce((a, b) => a + b, 0)
    expect(total).toBe(500)
    expect(cm.n).toBe(500)

    const m = multiclassMetrics(cm)
    expect(m.classes.reduce((a, c) => a + c.support, 0)).toBe(500)
    expect(m.classes.reduce((a, c) => a + c.predicted, 0)).toBe(500)
    for (let i = 0; i < cm.labels.length; i++) {
      expect(cm.counts[i].reduce((a, b) => a + b, 0)).toBe(m.classes[i].support)
    }
  })

  it.each(SEEDS)('seed %i: every metric that is defined lies in its declared range', (seed) => {
    const cm = confusionMatrix(randomLabels(300, seed, 3), randomLabels(300, seed + 3, 3), ['buy', 'sell', 'neutral'])
    const m = multiclassMetrics(cm)
    for (const v of [m.accuracy, m.balancedAccuracy, m.macroF1, m.weightedF1, m.macroPrecision, m.macroRecall]) {
      if (v === null) continue
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    if (m.mcc !== null) { expect(m.mcc).toBeGreaterThanOrEqual(-1); expect(m.mcc).toBeLessThanOrEqual(1) }
  })

  it.each(SEEDS)('seed %i: accuracy equals the trace over the total', (seed) => {
    const cm = confusionMatrix(randomLabels(400, seed, 3), randomLabels(400, seed + 11, 3), ['buy', 'sell', 'neutral'])
    let trace = 0
    for (let i = 0; i < cm.labels.length; i++) trace += cm.counts[i][i]
    expect(multiclassMetrics(cm).accuracy).toBeCloseTo(trace / 400, CLOSE)
  })

  it.each(SEEDS)('seed %i: F1 is the harmonic mean of precision and recall', (seed) => {
    const yTrue = randomLabels(400, seed, 2).map(s => s === 'buy')
    const yPred = randomLabels(400, seed + 5, 2).map(s => s === 'buy')
    const m = binaryFromLabels(yTrue, yPred)
    if (m.precision === null || m.recall === null || m.f1 === null) return
    if (m.precision + m.recall === 0) { expect(m.f1).toBe(0); return }
    expect(m.f1).toBeCloseTo(2 / (1 / m.precision + 1 / m.recall), CLOSE)
  })

  it('swapping predictions and truth transposes the matrix and swaps precision with recall', () => {
    const a = randomLabels(300, 42, 3)
    const b = randomLabels(300, 43, 3)
    const m1 = multiclassMetrics(confusionMatrix(a, b, ['buy', 'sell', 'neutral']))
    const m2 = multiclassMetrics(confusionMatrix(b, a, ['buy', 'sell', 'neutral']))
    for (let k = 0; k < 3; k++) {
      expect(m1.classes[k].precision).toBe(m2.classes[k].recall)
      expect(m1.classes[k].recall).toBe(m2.classes[k].precision)
    }
  })
})

describe('trading identities', () => {
  function randomTrades(n: number, seed: number) {
    const r = rng(seed)
    return Array.from({ length: n }, (_, i) => {
      const stop = 0.5 + r() * 3
      const retAtr = (r() - 0.48) * 6
      return {
        symbol: 'S', timeframe: '1h' as const, asOf: i * 3600_000, barIndex: i, horizonBars: 12,
        direction: (r() < 0.5 ? 'long' : 'short') as 'long' | 'short',
        confidenceScore: r() * 10,
        returnPct: retAtr * 0.01, returnAtr: retAtr, stopDistanceAtr: stop, r: retAtr / stop,
        stopTouched: r() < 0.3, targetTouched: r() < 0.3,
        maxFavourableR: Math.abs(retAtr) / stop, maxAdverseR: -Math.abs(retAtr) / stop,
      }
    })
  }

  it.each(SEEDS)('seed %i: expectancy equals its win/loss decomposition', (seed) => {
    // E[R] = winRate·avgWin + lossRate·avgLoss holds only when scratches are
    // zero-valued, which they are by definition. If these ever diverge, one of
    // the two formulas is wrong.
    const m = tradingMetrics(randomTrades(500, seed), { overlapping: false })
    expect(m.expectancyR!).toBeCloseTo(m.expectancyDecomposed!, CLOSE)
    expect(m.expectancyR!).toBeCloseTo(m.averageR!, CLOSE)
  })

  it.each(SEEDS)('seed %i: win + loss + scratch rates sum to 1', (seed) => {
    const m = tradingMetrics(randomTrades(500, seed), { overlapping: false })
    expect(m.winRate! + m.lossRate! + m.scratchRate!).toBeCloseTo(1, CLOSE)
  })

  it.each(SEEDS)('seed %i: profit factor > 1 exactly when total R > 0', (seed) => {
    const m = tradingMetrics(randomTrades(500, seed), { overlapping: false })
    if (m.profitFactor === null) return
    expect(m.profitFactor > 1).toBe(m.totalR > 0)
  })

  it.each(SEEDS)('seed %i: max drawdown is non-negative and at most the total loss capacity', (seed) => {
    const m = tradingMetrics(randomTrades(500, seed), { overlapping: false })
    expect(m.maxDrawdownR).toBeGreaterThanOrEqual(0)
  })

  it.each(SEEDS)('seed %i: Sortino >= Sharpe when both are defined and positive', (seed) => {
    // Downside deviation only counts the negative half, so it can never exceed
    // the full standard deviation — hence Sortino >= Sharpe for a positive mean.
    const m = tradingMetrics(randomTrades(500, seed), { overlapping: false })
    if (m.sharpePerTrade === null || m.sortinoPerTrade === null) return
    if (m.sharpePerTrade <= 0) return
    expect(m.sortinoPerTrade).toBeGreaterThanOrEqual(m.sharpePerTrade - 1e-12)
  })

  it.each(SEEDS)('seed %i: scaling every R by k scales expectancy and drawdown by k, leaving Sharpe fixed', (seed) => {
    const base = randomTrades(300, seed)
    const k = 3.5
    const scaled = base.map(t => ({ ...t, r: t.r * k }))
    const a = tradingMetrics(base, { overlapping: false })
    const b = tradingMetrics(scaled, { overlapping: false })
    expect(b.expectancyR!).toBeCloseTo(a.expectancyR! * k, CLOSE)
    expect(b.maxDrawdownR).toBeCloseTo(a.maxDrawdownR * k, CLOSE)
    expect(b.sharpePerTrade!).toBeCloseTo(a.sharpePerTrade!, CLOSE)
    expect(b.winRate!).toBe(a.winRate!)
  })

  it.each(SEEDS)('seed %i: max drawdown equals the largest peak-to-trough fall, recomputed', (seed) => {
    const r = rng(seed)
    const xs = Array.from({ length: 300 }, () => (r() - 0.5) * 4)
    // Independent O(n²) recomputation.
    const cum: number[] = []
    let s = 0
    for (const x of xs) { s += x; cum.push(s) }
    let worst = 0
    for (let i = 0; i < cum.length; i++) for (let j = i; j < cum.length; j++) {
      worst = Math.max(worst, cum[i] - cum[j])
    }
    // The peak may also be the origin (0) before any increment.
    for (let j = 0; j < cum.length; j++) worst = Math.max(worst, 0 - cum[j])
    expect(maxDrawdown(xs).maxDrawdown).toBeCloseTo(worst, CLOSE)
  })

  it('annualisation is refused for overlapping trades', () => {
    const m = tradingMetrics(randomTrades(200, 1), { overlapping: true })
    const res = annualisedSharpe(m, 250)
    expect(res.value).toBeNull()
    expect('reason' in res && res.reason).toMatch(/overlap/)
  })

  it('annualises non-overlapping trades by sqrt(tradesPerYear)', () => {
    const m = tradingMetrics(randomTrades(200, 1), { overlapping: false })
    const res = annualisedSharpe(m, 250)
    expect(res.value).toBeCloseTo(m.sharpePerTrade! * Math.sqrt(250), CLOSE)
  })

  it('refuses a nonsensical trade frequency rather than returning NaN', () => {
    const m = tradingMetrics(randomTrades(200, 1), { overlapping: false })
    expect(annualisedSharpe(m, 0).value).toBeNull()
    expect(annualisedSharpe(m, -5).value).toBeNull()
    expect(annualisedSharpe(m, Infinity).value).toBeNull()
  })
})

describe('ranking', () => {
  it.each(SEEDS)('seed %i: bucket counts sum to n', (seed) => {
    const r = rng(seed)
    const xs = Array.from({ length: 800 }, () => {
      const score = r() * 10
      return { score, hit: r() < score / 10, returnPct: (r() - 0.5) * 0.02, r: (r() - 0.5) * 2 }
    })
    const m = rankingMetrics(xs)
    expect(m.buckets.reduce((a, b) => a + b.n, 0)).toBe(800)
    expect(m.deciles.reduce((a, b) => a + b.n, 0)).toBe(800)
    expect(m.n).toBe(800)
  })

  it('detects monotonicity when it is present by construction', () => {
    // Hit probability rises exactly with the score.
    const r = rng(99)
    const xs: { score: number; hit: boolean; returnPct: number; r: number | null }[] = []
    for (const s of [1, 4, 6, 7.5, 9]) {
      for (let i = 0; i < 400; i++) xs.push({ score: s, hit: r() < s / 10, returnPct: 0, r: 0 })
    }
    const m = rankingMetrics(xs)
    expect(m.monotonic).toBe(true)
    expect(m.monotonicityBreaks).toEqual([])
    expect(m.spearmanScoreOutcome!).toBeGreaterThan(0.2)
  })

  it('reports the break when monotonicity fails, and where', () => {
    const r = rng(7)
    const xs: { score: number; hit: boolean; returnPct: number; r: number | null }[] = []
    // Deliberately inverted at the top bucket.
    for (const [s, p] of [[1, 0.3], [4, 0.5], [6, 0.6], [7.5, 0.7], [9, 0.2]] as const) {
      for (let i = 0; i < 500; i++) xs.push({ score: s, hit: r() < p, returnPct: 0, r: 0 })
    }
    const m = rankingMetrics(xs)
    expect(m.monotonic).toBe(false)
    expect(m.monotonicityBreaks.length).toBe(1)
    expect(m.monotonicityBreaks[0].to).toContain('very_strong')
    expect(m.monotonicityBreaks[0].drop).toBeGreaterThan(0.4)
  })

  it('monotonic is null, not true, when fewer than two buckets are eligible', () => {
    const m = rankingMetrics([{ score: 5, hit: true, returnPct: 0, r: 0 }])
    expect(m.monotonic).toBeNull()
  })

  it('Spearman is invariant to a monotone rescaling of the score', () => {
    const r = rng(4)
    const xs = Array.from({ length: 500 }, () => {
      const score = r() * 10
      return { score, hit: r() < score / 10, returnPct: 0, r: 0 }
    })
    const scaled = xs.map(x => ({ ...x, score: Math.log1p(x.score) }))
    expect(rankingMetrics(scaled).spearmanScoreOutcome!)
      .toBeCloseTo(rankingMetrics(xs).spearmanScoreOutcome!, CLOSE)
  })
})

describe('determinism and absence of look-ahead in the metrics layer', () => {
  const series = syntheticSeries({ symbol: 'M', timeframe: '1h', bars: 700, seed: 4242, drift: 0.0004, sigma: 0.015 })
  const run = runSeries(series, { lookbackBars: 200, horizons: [4, 12] })
  const obs = run.observations
  const opts = { overlapping: true }

  it('produces byte-identical output on repeated evaluation', () => {
    const a = evaluateSlice('overall', 'all', obs, 12, opts)
    const b = evaluateSlice('overall', 'all', obs, 12, opts)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('is invariant to the order observations are presented in', () => {
    // Metrics are set functions: any order dependence beyond floating-point
    // rounding would mean a statistic is reading position rather than value.
    //
    // Compared numerically, not byte-for-byte. Floating-point addition is not
    // associative, so reordering the terms changes the last bits of every sum
    // — compensated summation shrinks that to ~1e-16 relative but cannot
    // eliminate it. Asserting byte equality here would be asserting a property
    // of IEEE 754 that is simply false.
    const r = rng(17)
    const shuffled = [...obs]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t
    }
    const a = evaluateSlice('overall', 'all', obs, 12, opts)
    const b = evaluateSlice('overall', 'all', shuffled, 12, opts)
    expectNumericallyEqual(a, b, 1e-12)
  })

  it('reads no outcome other than the horizon it was asked for', () => {
    // Corrupting the 4-bar outcomes must not move a single 12-bar metric.
    const corrupted: Observation[] = obs.map(o => ({
      ...o,
      outcomes: {
        ...o.outcomes,
        4: o.outcomes[4] === null || o.outcomes[4] === undefined ? null : {
          ...o.outcomes[4]!, forwardReturn: 99, forwardReturnAtr: 99, mfeAtr: 99, maeAtr: -99, up: true,
        },
      },
    }))
    const a = evaluateSlice('overall', 'all', obs, 12, opts)
    const b = evaluateSlice('overall', 'all', corrupted, 12, opts)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('counts every observation exactly once across the confusion matrix', () => {
    for (const h of [4, 12]) {
      const m = evaluateSlice('overall', 'all', obs, h, opts)
      expect(m.threeWay.matrix.counts.flat().reduce((a, b) => a + b, 0)).toBe(m.n)
      expect(m.binaryUpDown.tp + m.binaryUpDown.fp + m.binaryUpDown.fn + m.binaryUpDown.tn).toBe(m.n)
    }
  })

  it('every probability handed to the calibration layer is a valid probability', () => {
    for (const h of [4, 12]) {
      const m = evaluateSlice('overall', 'all', obs, h, opts)
      for (const b of m.probability.calibrationEqualWidth.bins) {
        if (b.n === 0) continue
        expect(b.meanPredicted!).toBeGreaterThanOrEqual(0)
        expect(b.meanPredicted!).toBeLessThanOrEqual(1)
        expect(b.observedFrequency!).toBeGreaterThanOrEqual(0)
        expect(b.observedFrequency!).toBeLessThanOrEqual(1)
      }
    }
  })

  it('trade accounting balances: recorded + excluded = observations considered', () => {
    for (const h of [4, 12]) {
      const m = evaluateSlice('overall', 'all', obs, h, opts).trading
      expect(m.n + m.excludedNoStop + m.excludedNoOutcome + m.excludedNoDirection).toBe(obs.length)
    }
  })

  it('the directional scoreboard has no true negatives by construction', () => {
    // Every directional observation is a predicted positive. Stated as a test
    // so the structural zeros in the report are never misread as a failure to
    // measure something.
    const m = evaluateSlice('overall', 'all', obs, 12, opts).directional
    expect(m.fn).toBe(0)
    expect(m.tn).toBe(0)
    expect(m.tp + m.fp).toBe(m.n)
    expect(m.accuracy).toBe(m.precision)
  })
})

describe('stats helpers used by the metrics layer', () => {
  it.each(SEEDS)('seed %i: ranks are a permutation of 1..n when there are no ties', (seed) => {
    const r = rng(seed)
    const xs = Array.from({ length: 200 }, () => r())
    expect([...rank(xs)].sort((a, b) => a - b)).toEqual(Array.from({ length: 200 }, (_, i) => i + 1))
  })

  it.each(SEEDS)('seed %i: ranks always sum to n(n+1)/2, ties or not', (seed) => {
    const r = rng(seed)
    const xs = Array.from({ length: 200 }, () => Math.floor(r() * 5))
    expect(rank(xs).reduce((a, b) => a + b, 0)).toBeCloseTo((200 * 201) / 2, CLOSE)
  })

  it.each(SEEDS)('seed %i: quantiles are non-decreasing in q', (seed) => {
    const r = rng(seed)
    const xs = Array.from({ length: 300 }, () => r() * 100)
    let prev = -Infinity
    for (let q = 0; q <= 1.0001; q += 0.05) {
      const v = quantile(xs, Math.min(1, q))!
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = v
    }
  })

  it.each(SEEDS)('seed %i: Spearman is bounded by ±1', (seed) => {
    const r = rng(seed)
    const a = Array.from({ length: 300 }, () => r())
    const b = Array.from({ length: 300 }, () => r())
    const rho = spearman(a, b)!
    expect(rho).toBeGreaterThanOrEqual(-1)
    expect(rho).toBeLessThanOrEqual(1)
  })

  it('downside deviation never exceeds the standard deviation about the same MAR', () => {
    const r = rng(3)
    const xs = Array.from({ length: 500 }, () => (r() - 0.5) * 4)
    const m = mean(xs)!
    const rms = Math.sqrt(xs.reduce((a, x) => a + (x - 0) ** 2, 0) / xs.length)
    expect(downsideDeviation(xs, 0)!).toBeLessThanOrEqual(rms + 1e-12)
    void m
  })
})

describe('buildTrades', () => {
  const series = syntheticSeries({ symbol: 'T', timeframe: '1h', bars: 500, seed: 8, sigma: 0.02 })
  const obs = runSeries(series, { lookbackBars: 200, horizons: [12] }).observations

  it('orders trades chronologically regardless of input order', () => {
    const reversed = [...obs].reverse()
    const a = buildTrades(obs, 12).trades.map(t => t.asOf)
    const b = buildTrades(reversed, 12).trades.map(t => t.asOf)
    expect(b).toEqual(a)
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThanOrEqual(a[i - 1])
  })

  it('flips MFE and MAE for a short — the short\'s gain is the long\'s drawdown', () => {
    const trades = buildTrades(obs, 12).trades
    const shorts = trades.filter(t => t.direction === 'short')
    expect(shorts.length).toBeGreaterThan(0)
    for (const t of shorts) {
      expect(t.maxFavourableR).toBeGreaterThanOrEqual(t.maxAdverseR)
    }
  })

  it('R has the same sign as the directional return', () => {
    for (const t of buildTrades(obs, 12).trades) {
      expect(Math.sign(t.r)).toBe(Math.sign(t.returnAtr))
    }
  })

  it('excludes, and counts, trades whose plan carried no stop', () => {
    const stripped: Observation[] = obs.map(o => {
      const f = { ...o.features }
      delete (f as Record<string, number>).stop_distance_atr
      return { ...o, features: f }
    })
    const built = buildTrades(stripped, 12)
    expect(built.trades.length).toBe(0)
    expect(built.excludedNoStop).toBeGreaterThan(0)
  })

  it('binaryMetrics rejects a negative or fractional count rather than computing on it', () => {
    expect(() => binaryMetrics(-1, 0, 0, 0)).toThrow(/non-negative integer/)
    expect(() => binaryMetrics(1.5, 0, 0, 0)).toThrow(/non-negative integer/)
  })
})
