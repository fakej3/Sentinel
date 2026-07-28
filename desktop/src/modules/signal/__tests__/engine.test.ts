import { describe, it, expect } from 'vitest'
import { SignalEngine, assertWellFormedWindow, wilsonInterval, DEFAULT_SCALING_WINDOW } from '../index'
import { DEFAULT_FEATURES, FEATURE_NAMES } from '../features'
import { MIN_SCALING_WINDOW } from '../scaling'
import { LinearSignalModel, fitLinearSignalModel } from '../model'
import type { TrainingRow } from '../model'
import { fitIsotonic } from '../calibration'
import type { Calibrator, ScaledFeatures, SignalModel, RawScore } from '../types'
import type { Candle } from '../../market/types'
import { HOUR, makeInput, makeSeries } from './fixtures'

/** A small window keeps the O(n²) expanding-window drive affordable in tests. */
const WINDOW = MIN_SCALING_WINDOW

/** Drives an engine over expanding windows of a series, from `from` to the end. */
function drive(engine: SignalEngine, candles: readonly Candle[], from: number): ReturnType<SignalEngine['observe']>[] {
  const out: ReturnType<SignalEngine['observe']>[] = []
  for (let i = from; i < candles.length; i++) {
    out.push(engine.observe(makeInput(candles.slice(0, i + 1))))
  }
  return out
}

const SERIES = makeSeries({ n: 260, seed: 21, sigma: 0.012 })

describe('assertWellFormedWindow', () => {
  const ok = makeSeries({ n: 5, seed: 1 })

  it('accepts a well-formed window', () => {
    expect(() => assertWellFormedWindow(ok)).not.toThrow()
  })

  it('rejects a duplicated timestamp', () => {
    const dup = [...ok.slice(0, 3), { ...ok[2] }, ...ok.slice(3)]
    expect(() => assertWellFormedWindow(dup)).toThrow(/strictly chronological/)
  })

  it('rejects a reversed pair', () => {
    const rev = [...ok]
    ;[rev[1], rev[2]] = [rev[2], rev[1]]
    expect(() => assertWellFormedWindow(rev)).toThrow(/strictly chronological/)
  })

  it('rejects a candle that closes before it opens', () => {
    const bad = [...ok.slice(0, 2), { ...ok[2], closeTime: ok[2].openTime - 1 }, ...ok.slice(3)]
    expect(() => assertWellFormedWindow(bad)).toThrow(/at or before its open/)
  })

  it('rejects a non-finite timestamp', () => {
    expect(() => assertWellFormedWindow([{ ...ok[0], openTime: NaN }])).toThrow(/non-finite timestamp/)
  })

  it('ACCEPTS a gap — weekends and halts are ordinary market data', () => {
    const gapped = [...ok.slice(0, 3), ...ok.slice(3).map(c => ({
      ...c, openTime: c.openTime + 100 * HOUR, closeTime: c.closeTime + 100 * HOUR,
    }))]
    expect(() => assertWellFormedWindow(gapped)).not.toThrow()
  })
})

describe('SignalEngine — construction', () => {
  it('rejects a scaling window below the derived minimum', () => {
    expect(() => new SignalEngine({ scalingWindow: MIN_SCALING_WINDOW - 1 }))
      .toThrow(new RegExp(`scalingWindow must be an integer >= ${MIN_SCALING_WINDOW}`))
    expect(() => new SignalEngine({ scalingWindow: 100.5 })).toThrow(/integer/)
  })

  it('rejects an empty feature set', () => {
    expect(() => new SignalEngine({ features: [] })).toThrow(/no features configured/)
  })

  it('rejects duplicate feature names', () => {
    const spec = DEFAULT_FEATURES[0]
    expect(() => new SignalEngine({ features: [spec, spec] }))
      .toThrow(/duplicate feature names/)
  })

  it('rejects a model whose features this engine does not produce', () => {
    const alien: SignalModel = {
      name: 'alien', features: ['not_a_feature'],
      score: (): RawScore | null => null,
    }
    expect(() => new SignalEngine({ model: alien }))
      .toThrow(/wants features not produced by this engine: not_a_feature/)
  })

  it('defaults to the documented scaling window', () => {
    expect(DEFAULT_SCALING_WINDOW).toBe(252)
  })
})

describe('SignalEngine — chronology', () => {
  it('refuses a bar that is not after the previous one', () => {
    const e = new SignalEngine({ scalingWindow: WINDOW })
    e.observe(makeInput(SERIES.slice(0, 50)))
    expect(() => e.observe(makeInput(SERIES.slice(0, 49)))).toThrow(/strictly chronological/)
  })

  it('refuses a repeat of the same bar — an equal timestamp is not progress', () => {
    const e = new SignalEngine({ scalingWindow: WINDOW })
    e.observe(makeInput(SERIES.slice(0, 50)))
    expect(() => e.observe(makeInput(SERIES.slice(0, 50)))).toThrow(/strictly chronological/)
  })

  it('refuses an empty window', () => {
    expect(() => new SignalEngine().observe(makeInput([]))).toThrow(/empty candle window/)
  })

  it('refuses a malformed window before doing any work', () => {
    const e = new SignalEngine({ scalingWindow: WINDOW })
    const bad = [...SERIES.slice(0, 50)]
    ;[bad[10], bad[11]] = [bad[11], bad[10]]
    expect(() => e.observe(makeInput(bad))).toThrow(/strictly chronological/)
  })

  it('accepts a window containing a gap and still produces an observation', () => {
    const e = new SignalEngine({ scalingWindow: WINDOW })
    const gapped = [
      ...SERIES.slice(0, 100),
      ...SERIES.slice(100, 150).map(c => ({
        ...c, openTime: c.openTime + 500 * HOUR, closeTime: c.closeTime + 500 * HOUR,
      })),
    ]
    const o = e.observe(makeInput(gapped))
    expect(o.diagnostics.barsProvided).toBe(150)
    expect(o.diagnostics.featuresObserved).toBeGreaterThan(0)
    for (const name of FEATURE_NAMES) {
      const v = o.features[name].value
      expect(v === null || Number.isFinite(v), name).toBe(true)
    }
  })
})

describe('SignalEngine — no look-ahead', () => {
  // THE load-bearing property of the whole layer. Two series share bars 0-199
  // and diverge completely afterwards. Every output over the shared prefix must
  // be identical: if any statistic saw the future, the wild tail would change
  // the quiet prefix's numbers.
  const SPLIT = 200
  const base = SERIES.slice(0, SPLIT)
  const last = base[base.length - 1]
  const tail = (seed: number, sigma: number): Candle[] =>
    makeSeries({ n: 60, seed, sigma, start: last.close, startTime: SPLIT * HOUR })

  const quiet = [...base, ...tail(31, 0.004)]
  const wild = [...base, ...tail(32, 0.25)]

  it('a future bar cannot change any output for a past bar', () => {
    const a = drive(new SignalEngine({ scalingWindow: WINDOW }), quiet, 120)
    const b = drive(new SignalEngine({ scalingWindow: WINDOW }), wild, 120)
    const shared = SPLIT - 120
    expect(a.slice(0, shared)).toEqual(b.slice(0, shared))
  })

  it('and the futures really do differ, so the test above is not vacuous', () => {
    const a = drive(new SignalEngine({ scalingWindow: WINDOW }), quiet, 120)
    const b = drive(new SignalEngine({ scalingWindow: WINDOW }), wild, 120)
    expect(a[a.length - 1].scaled).not.toEqual(b[b.length - 1].scaled)
  })

  it('scales a value against its own past, never against itself', () => {
    // A z-scored feature at the first warm bar must have been scored against
    // exactly WINDOW prior observations, none of which is the current one.
    const obs = drive(new SignalEngine({ scalingWindow: WINDOW }), SERIES, 60)
    const firstWarm = obs.findIndex(o => o.diagnostics.scalerWarm)
    expect(firstWarm).toBeGreaterThan(0)
    // Before the scaler is warm, every feature that needs an ESTIMATED
    // statistic is null — the engine abstains rather than scaling against a
    // window too short to estimate one. Features declaring `scaling: 'none'`
    // are on a fixed scale and have no statistic to estimate, so they pass
    // through. The partition is read off the specs rather than listed here,
    // because a hand-maintained list would go stale the first time a feature's
    // scaling changed and would then silently assert nothing.
    const cold = obs[0]
    const needsEstimate = DEFAULT_FEATURES.filter(f => f.scaling !== 'none').map(f => f.name)
    const fixedScale = DEFAULT_FEATURES.filter(f => f.scaling === 'none').map(f => f.name)
    expect(needsEstimate.length).toBeGreaterThan(0)
    for (const name of needsEstimate) expect(cold.scaled[name], name).toBeNull()
    for (const name of fixedScale) expect(cold.scaled[name], name).toBe(cold.raw[name])
  })
})

describe('SignalEngine — determinism', () => {
  it('two engines given identical inputs produce identical outputs', () => {
    const a = drive(new SignalEngine({ scalingWindow: WINDOW }), SERIES, 150)
    const b = drive(new SignalEngine({ scalingWindow: WINDOW }), SERIES, 150)
    expect(a).toEqual(b)
  })

  it('produces bit-identical raw feature values across runs', () => {
    const a = drive(new SignalEngine({ scalingWindow: WINDOW }), SERIES, 200)
    const b = drive(new SignalEngine({ scalingWindow: WINDOW }), SERIES, 200)
    for (let i = 0; i < a.length; i++) {
      for (const name of FEATURE_NAMES) {
        expect(a[i].raw[name], `${name} at ${i}`).toBe(b[i].raw[name])
      }
    }
  })

  it('reports the same regime for the same window', () => {
    const a = new SignalEngine({ scalingWindow: WINDOW }).observe(makeInput(SERIES))
    const b = new SignalEngine({ scalingWindow: WINDOW }).observe(makeInput(SERIES))
    expect(a.regime).toEqual(b.regime)
    expect(a.regime.sampleSize).toBe(SERIES.length - 1)
  })
})

describe('SignalEngine — abstention', () => {
  const input = makeInput(SERIES)

  it('abstains with "no-model-score" when no model is configured', () => {
    const o = new SignalEngine({ scalingWindow: WINDOW }).observe(input)
    expect(o.prediction.probability).toBeNull()
    expect(o.prediction.abstained).toBe('no-model-score')
    expect(o.prediction.interval).toBeNull()
    expect(o.prediction.support).toBe(0)
    expect(o.prediction.modelName).toBe('none')
    expect(o.prediction.calibratorName).toBeNull()
    expect(o.model).toBeNull()
  })

  it('still reports features, scaling and regime with no model — that is how a training set is built', () => {
    const o = new SignalEngine({ scalingWindow: WINDOW }).observe(input)
    expect(Object.keys(o.features).length).toBe(15)
    expect(Object.keys(o.scaled).length).toBe(15)
    expect(o.regime.sampleSize).toBeGreaterThan(0)
  })

  it('abstains with "uncalibrated" when a model scores but no calibrator exists', () => {
    const rows: TrainingRow[] = Array.from({ length: 200 }, (_, i) => ({
      features: Object.fromEntries(FEATURE_NAMES.map(n => [n, Math.sin(i + n.length)])) as ScaledFeatures,
      outcome: (i % 2) as 0 | 1,
    }))
    const model = new LinearSignalModel(fitLinearSignalModel(rows, FEATURE_NAMES))
    const o = new SignalEngine({ scalingWindow: WINDOW, model }).observe(input)
    expect(o.prediction.abstained).toBe('uncalibrated')
    expect(o.prediction.rawScore).not.toBeNull()
    expect(o.prediction.modelName).toBe('linear-logistic')
  })

  it('distinguishes "outside-calibration-support" from "insufficient-support"', () => {
    // A hand-built calibrator makes the distinction observable: one score is
    // beyond the fitted range, the other is inside it but has a thin bin.
    const cal: Calibrator = {
      name: 'stub',
      bins: [{ lower: -1, upper: 1, probability: 0.6, n: 3 }],
      support: { min: -1, max: 1 },
      probability: () => null,
    }
    const fixed = (v: number): SignalModel => ({
      name: 'fixed', features: [...FEATURE_NAMES],
      score: (): RawScore => ({ value: v, used: [...FEATURE_NAMES], missing: [] }),
    })
    const inside = new SignalEngine({ scalingWindow: WINDOW, model: fixed(0), calibrator: cal }).observe(input)
    expect(inside.prediction.abstained).toBe('insufficient-support')
    const outside = new SignalEngine({ scalingWindow: WINDOW, model: fixed(99), calibrator: cal }).observe(input)
    expect(outside.prediction.abstained).toBe('outside-calibration-support')
  })

  it('names the calibrator even when it refuses', () => {
    const cal = fitIsotonic([0, 1], [false, true], { minSupport: 1 })
    const fixed: SignalModel = {
      name: 'fixed', features: [...FEATURE_NAMES],
      score: (): RawScore => ({ value: 50, used: [], missing: [] }),
    }
    const o = new SignalEngine({ scalingWindow: WINDOW, model: fixed, calibrator: cal }).observe(input)
    expect(o.prediction.calibratorName).toBe('isotonic')
    expect(o.prediction.abstained).toBe('outside-calibration-support')
  })
})

describe('wilsonInterval', () => {
  it('matches the closed form on a textbook case', () => {
    // p = 0.5, n = 100, z = 1.96: centre = 0.5, half = 1.96/1.0384·sqrt(0.0025 + 0.0000960)
    const z = 1.959963984540054
    const n = 100, p = 0.5
    const z2 = z * z
    const denom = 1 + z2 / n
    const centre = (p + z2 / (2 * n)) / denom
    const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
    const got = wilsonInterval(p, n)!
    expect(got.lower).toBeCloseTo(centre - half, 15)
    expect(got.upper).toBeCloseTo(centre + half, 15)
  })

  it('stays inside [0, 1] at the extremes, where a Wald interval would not', () => {
    for (const p of [0, 1]) {
      for (const n of [1, 5, 100]) {
        const i = wilsonInterval(p, n)!
        expect(i.lower).toBeGreaterThanOrEqual(0)
        expect(i.upper).toBeLessThanOrEqual(1)
      }
    }
  })

  it('narrows as the sample grows', () => {
    const widths = [10, 100, 1000, 10_000].map(n => {
      const i = wilsonInterval(0.5, n)!
      return i.upper - i.lower
    })
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1])
  })

  it('shrinks as 1/sqrt(n) for large n', () => {
    const a = wilsonInterval(0.5, 10_000)!
    const b = wilsonInterval(0.5, 40_000)!
    expect((b.upper - b.lower)).toBeCloseTo((a.upper - a.lower) / 2, 4)
  })

  it('refuses nonsensical input rather than returning a wrong interval', () => {
    expect(wilsonInterval(1.5, 10)).toBeNull()
    expect(wilsonInterval(-0.1, 10)).toBeNull()
    expect(wilsonInterval(NaN, 10)).toBeNull()
    expect(wilsonInterval(0.5, 0)).toBeNull()
    expect(wilsonInterval(0.5, 2.5)).toBeNull()
  })
})

describe('SignalEngine — end to end', () => {
  /**
   * Proves the PLUMBING, not the performance.
   *
   * The model and calibrator below are fitted on the same observations they are
   * then evaluated on. That is in-sample by construction and says nothing
   * whatever about whether the engine predicts anything — a walk-forward split
   * with an embargo is what answers that, and it lives in `src/harness/`. What
   * this test establishes is that a probability can reach the end of the
   * pipeline at all, carrying its support and its interval, and that every
   * stage's output is the input the next stage expects.
   */
  it('carries a probability through features, scaling, regime, model and calibration', () => {
    const series = makeSeries({ n: 320, seed: 77, drift: 0.001, sigma: 0.01 })
    const HORIZON = 5

    // Pass 1 — no model: collect scaled features and resolve outcomes.
    const collector = new SignalEngine({ scalingWindow: WINDOW })
    const observed = drive(collector, series, 120)
    const rows: TrainingRow[] = []
    for (let i = 0; i < observed.length; i++) {
      const barIndex = 120 + i
      const future = barIndex + HORIZON
      if (future >= series.length) break
      const r = Math.log(series[future].close / series[barIndex].close)
      rows.push({ features: observed[i].scaled, outcome: r > 0 ? 1 : 0, forwardReturn: r })
    }
    expect(rows.length).toBeGreaterThan(150)

    const weights = fitLinearSignalModel(rows, FEATURE_NAMES)
    const model = new LinearSignalModel(weights)

    // Pass 2 — score the same rows to obtain the calibration inputs.
    const scores: number[] = []
    const labels: boolean[] = []
    for (const row of rows) {
      const out = model.predict(row.features)
      if (out.linearPredictor === null) continue
      scores.push(out.linearPredictor)
      labels.push(row.outcome === 1)
    }
    expect(scores.length).toBeGreaterThan(100)
    const calibrator = fitIsotonic(scores, labels, { minSupport: 5 })

    // Pass 3 — the assembled engine.
    const engine = new SignalEngine({ scalingWindow: WINDOW, model, calibrator })
    const final = drive(engine, series, 120)

    const answered = final.filter(o => o.prediction.probability !== null)
    expect(answered.length).toBeGreaterThan(0)

    for (const o of answered) {
      const p = o.prediction.probability!
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
      expect(o.prediction.support).toBeGreaterThan(0)
      expect(o.prediction.interval!.lower).toBeLessThanOrEqual(p)
      expect(o.prediction.interval!.upper).toBeGreaterThanOrEqual(p)
      expect(o.prediction.abstained).toBeNull()
      expect(o.prediction.rawScore).not.toBeNull()
      expect(o.prediction.modelName).toBe('linear-logistic')
      expect(o.prediction.calibratorName).toBe('isotonic')
      // The model's own likelihood and the calibrated probability are DIFFERENT
      // objects. Nothing in the pipeline lets the former masquerade as the
      // latter, which is the type-level guarantee the layer exists to enforce.
      expect(o.model!.probabilityLong).not.toBeNull()
    }

    // Every refusal names a reason. A null probability without one would be an
    // unexplained absence, which is the state the old engine could not report.
    for (const o of final) {
      expect(o.prediction.probability === null).toBe(o.prediction.abstained !== null)
    }
  })

  it('is reproducible end to end — the same series twice gives the same predictions', () => {
    const series = makeSeries({ n: 220, seed: 88, sigma: 0.01 })
    const rows: TrainingRow[] = Array.from({ length: 300 }, (_, i) => ({
      features: Object.fromEntries(FEATURE_NAMES.map((n, j) => [n, Math.sin(i * 0.1 + j)])) as ScaledFeatures,
      outcome: (Math.sin(i * 0.7) > 0 ? 1 : 0) as 0 | 1,
    }))
    const weights = fitLinearSignalModel(rows, FEATURE_NAMES)
    const model = new LinearSignalModel(weights)
    const scores = rows.map(r => model.predict(r.features).linearPredictor!)
    const calibrator = fitIsotonic(scores, rows.map(r => r.outcome === 1), { minSupport: 5 })

    const run = (): unknown => drive(
      new SignalEngine({ scalingWindow: WINDOW, model, calibrator }), series, 150,
    ).map(o => o.prediction)

    expect(run()).toEqual(run())
  })
})
