import { describe, it, expect } from 'vitest'
import { runWalkForward, rowsInDateRange, DEFAULT_GRID } from '../pipeline'
import type { FoldConfig, HyperGrid } from '../pipeline'
import type { Corpus } from '../corpus'
import { scaleCorpus } from '../scaling'
import type { ScaledCorpus } from '../scaling'
import { evaluateScores } from '../evaluate'
import { coefficientStability } from '../analysis'
import { FEATURE_NAMES } from '../../../modules/signal/features'
import { MIN_SCALING_WINDOW } from '../../../modules/signal/scaling'

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function gauss(u: () => number): () => number {
  let spare: number | null = null
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v }
    let a = 0, b = 0, q = 0
    do { a = u() * 2 - 1; b = u() * 2 - 1; q = a * a + b * b } while (q === 0 || q >= 1)
    const f = Math.sqrt(-2 * Math.log(q) / q)
    spare = b * f
    return a * f
  }
}

const SYMBOLS = 40
const DATES = 600
const DRIVER = 'ema_distance'

/**
 * A corpus with every feature iid noise, and the forward return optionally
 * driven by one of them.
 *
 * `beta = 0` gives the null: a pipeline that reports an edge here is broken.
 * `beta > 0` gives a planted signal: a pipeline that CANNOT find it here would
 * make any null result on real data uninterpretable, because "no edge found"
 * and "cannot find edges" would look identical.
 */
function syntheticCorpus(seed: number, beta: number, noise = 0.02): Corpus {
  const u = lcg(seed)
  const z = gauss(u)
  const n = SYMBOLS * DATES
  const symbolIdx = new Int32Array(n)
  const dateIdx = new Int32Array(n)
  const features: Record<string, Float64Array> = {}
  for (const f of FEATURE_NAMES) features[f] = new Float64Array(n)
  const fwd = new Float64Array(n)

  let k = 0
  for (let s = 0; s < SYMBOLS; s++) {
    for (let d = 0; d < DATES; d++) {
      symbolIdx[k] = s
      dateIdx[k] = d
      for (const f of FEATURE_NAMES) features[f][k] = z()
      fwd[k] = beta * features[DRIVER][k] * noise + z() * noise
      k++
    }
  }
  return {
    rows: n,
    symbols: Array.from({ length: SYMBOLS }, (_, i) => `S${i}`),
    dates: Array.from({ length: DATES }, (_, i) => i),
    symbolIdx, dateIdx, features, aux: {},
    forwardReturn: { 5: fwd },
    lookbackBars: 200, horizons: [5], skipped: {},
  }
}

const GRID: HyperGrid = { windows: [MIN_SCALING_WINDOW], ridges: [1], calibrations: ['none'] }

const CONFIG: FoldConfig = {
  firstDate: MIN_SCALING_WINDOW,
  trainDates: 200,
  testDates: 50,
  embargoDates: 5,
  mode: 'rolling',
  innerFolds: 2,
  innerTestDates: 40,
  calibrationFraction: 0.25,
  searchStride: 1,
}

function scaledFor(corpus: Corpus): ReadonlyMap<number, ScaledCorpus> {
  return new Map([[MIN_SCALING_WINDOW, scaleCorpus(corpus, MIN_SCALING_WINDOW)]])
}

function run(corpus: Corpus, overrides: Partial<FoldConfig> = {}): ReturnType<typeof runWalkForward> {
  return runWalkForward(corpus, {
    horizon: 5,
    config: { ...CONFIG, ...overrides },
    grid: GRID,
    scaledByWindow: scaledFor(corpus),
  })
}

describe('runWalkForward — embargo is enforced, not advisory', () => {
  it('refuses an embargo shorter than the longest horizon', () => {
    const corpus = syntheticCorpus(1, 0)
    const wide: Corpus = { ...corpus, horizons: [5, 20] }
    expect(() => runWalkForward(wide, {
      horizon: 5,
      config: { ...CONFIG, embargoDates: 19 },
      grid: GRID,
      scaledByWindow: scaledFor(wide),
    })).toThrow(/embargoDates 19 < max horizon 20/)
  })

  it('leaves a gap of at least the embargo between train and test on every fold', () => {
    const r = run(syntheticCorpus(2, 0))
    expect(r.folds.length).toBeGreaterThan(2)
    for (const f of r.folds) {
      expect(f.testStart - f.trainEnd).toBeGreaterThanOrEqual(CONFIG.embargoDates)
      expect(f.trainEnd).toBeGreaterThan(f.trainStart)
      expect(f.testEnd).toBeGreaterThan(f.testStart)
    }
  })

  it('tests each date at most once, and never trains on a date it tests', () => {
    const r = run(syntheticCorpus(3, 0))
    const tested = new Set<number>()
    for (const f of r.folds) {
      for (let d = f.testStart; d < f.testEnd; d++) {
        expect(tested.has(d), `date ${d} tested twice`).toBe(false)
        tested.add(d)
      }
      expect(f.trainEnd).toBeLessThanOrEqual(f.testStart)
    }
  })

  it('never emits a prediction for a date outside its own test block', () => {
    const r = run(syntheticCorpus(4, 0))
    const byFold = new Map(r.folds.map(f => [f.fold, f]))
    for (const p of r.predictions) {
      const f = byFold.get(p.fold)!
      expect(p.dateIdx).toBeGreaterThanOrEqual(f.testStart)
      expect(p.dateIdx).toBeLessThan(f.testEnd)
    }
  })
})

describe('runWalkForward — no look-ahead', () => {
  it('a fold cannot be changed by data after its test block', () => {
    // THE test. Replace everything after date 400 with wildly different values
    // and require every prediction before 400 to be byte-identical. A leak
    // anywhere — scaling, fitting, calibration, split arithmetic — shows up
    // here as a changed number.
    const base = syntheticCorpus(5, 0)
    const u = lcg(999)
    const corrupted: Corpus = {
      ...base,
      features: Object.fromEntries(FEATURE_NAMES.map(f => {
        const col = Float64Array.from(base.features[f])
        for (let r = 0; r < base.rows; r++) if (base.dateIdx[r] >= 400) col[r] = (u() - 0.5) * 1000
        return [f, col]
      })),
      forwardReturn: {
        5: (() => {
          const col = Float64Array.from(base.forwardReturn[5])
          for (let r = 0; r < base.rows; r++) if (base.dateIdx[r] >= 400) col[r] = (u() - 0.5) * 10
          return col
        })(),
      },
    }

    const a = run(base)
    const b = run(corrupted)
    const before = (p: { dateIdx: number }): boolean => p.dateIdx < 400

    const pa = a.predictions.filter(before)
    const pb = b.predictions.filter(before)
    expect(pa.length).toBeGreaterThan(1000)
    expect(pb.length).toBe(pa.length)
    for (let i = 0; i < pa.length; i++) {
      expect(pa[i].row).toBe(pb[i].row)
      expect(pa[i].score).toBe(pb[i].score)
      expect(pa[i].probability).toBe(pb[i].probability)
    }
  })

  it('a fold whose train block is untouched keeps identical coefficients', () => {
    const base = syntheticCorpus(6, 0)
    const u = lcg(31)
    const corrupted: Corpus = {
      ...base,
      features: Object.fromEntries(FEATURE_NAMES.map(f => {
        const col = Float64Array.from(base.features[f])
        for (let r = 0; r < base.rows; r++) if (base.dateIdx[r] >= 450) col[r] = (u() - 0.5) * 500
        return [f, col]
      })),
    }
    const a = run(base)
    const b = run(corrupted)
    for (let i = 0; i < a.folds.length; i++) {
      if (a.folds[i].trainEnd > 450) continue
      expect(b.folds[i].weights.coefficients).toEqual(a.folds[i].weights.coefficients)
      expect(b.folds[i].weights.intercept).toBe(a.folds[i].weights.intercept)
    }
  })
})

describe('runWalkForward — determinism', () => {
  it('produces identical predictions across runs', () => {
    const corpus = syntheticCorpus(7, 0)
    const a = run(corpus)
    const b = run(corpus)
    expect(a.predictions).toEqual(b.predictions)
    expect(a.folds.map(f => f.weights.coefficients)).toEqual(b.folds.map(f => f.weights.coefficients))
  })

  it('produces identical results under the full hyperparameter grid', () => {
    // The search visits combinations in a fixed order and breaks ties by first
    // encountered, so two runs must agree on the selection as well as the fit.
    const corpus = syntheticCorpus(8, 0)
    const opts = {
      horizon: 5,
      config: CONFIG,
      grid: { windows: [MIN_SCALING_WINDOW, 40], ridges: [1, 10], calibrations: DEFAULT_GRID.calibrations },
      scaledByWindow: new Map([
        [MIN_SCALING_WINDOW, scaleCorpus(corpus, MIN_SCALING_WINDOW)],
        [40, scaleCorpus(corpus, 40)],
      ]),
    }
    const a = runWalkForward(corpus, opts)
    const b = runWalkForward(corpus, opts)
    expect(a.folds.map(f => f.chosen.window)).toEqual(b.folds.map(f => f.chosen.window))
    expect(a.folds.map(f => f.chosen.ridge)).toEqual(b.folds.map(f => f.chosen.ridge))
    expect(a.folds.map(f => f.chosen.calibration)).toEqual(b.folds.map(f => f.chosen.calibration))
    expect(a.predictions).toEqual(b.predictions)
  })
})

describe('runWalkForward — the pipeline can find an edge, and does not invent one', () => {
  it('finds NOTHING when the label is independent of every feature', () => {
    // The null calibration for the whole fitting pipeline.
    const corpus = syntheticCorpus(11, 0)
    const r = run(corpus)
    const rows = r.predictions.map(p => ({
      dateIdx: p.dateIdx,
      score: p.score,
      probability: p.probability,
      forwardReturn: corpus.forwardReturn[5][p.row],
    }))
    const ev = evaluateScores(rows, r.predictions.length, { name: 'null', horizon: 5 })
    const rank = ev.marketNeutral.rankIc!
    expect(rank.lower).toBeLessThan(0)
    expect(rank.upper).toBeGreaterThan(0)
  })

  it('RECOVERS a planted edge, out of sample', () => {
    // Without this, a null result on real data would be uninterpretable: "no
    // edge exists" and "this pipeline cannot detect edges" would produce the
    // same output.
    const corpus = syntheticCorpus(12, 1.5)
    const r = run(corpus)
    const rows = r.predictions.map(p => ({
      dateIdx: p.dateIdx,
      score: p.score,
      probability: p.probability,
      forwardReturn: corpus.forwardReturn[5][p.row],
    }))
    const ev = evaluateScores(rows, r.predictions.length, { name: 'planted', horizon: 5 })
    expect(ev.marketNeutral.rankIc!.point).toBeGreaterThan(0.1)
    expect(ev.marketNeutral.rankIc!.lower).toBeGreaterThan(0)
    expect(ev.marketNeutral.longShort!.lower).toBeGreaterThan(0)
  })

  it('attributes the planted edge to the RIGHT feature, with a stable sign', () => {
    const corpus = syntheticCorpus(13, 1.5)
    const r = run(corpus)
    const stability = coefficientStability(r.folds)
    const driver = stability.find(s => s.name === DRIVER)!
    expect(driver.meanCoefficient!).toBeGreaterThan(0)
    expect(driver.signAgreement).toBe(1)
    expect(driver.signFlips).toBe(false)
    // And it should dominate: every other feature is pure noise.
    const others = stability.filter(s => s.name !== DRIVER)
    for (const o of others) {
      expect(Math.abs(o.meanCoefficient!), o.name).toBeLessThan(Math.abs(driver.meanCoefficient!))
    }
    expect(driver.meanImportance!).toBeGreaterThan(0.5)
  })

  it('leaves noise features with unstable signs even when a real one is present', () => {
    // The stability diagnostic must discriminate, not merely report 100% for
    // everything when the fit happens to be good.
    const corpus = syntheticCorpus(14, 1.5)
    const stability = coefficientStability(run(corpus).folds)
    const flipped = stability.filter(s => s.name !== DRIVER && s.signFlips).length
    expect(flipped).toBeGreaterThan(stability.length / 3)
  })
})

describe('rowsInDateRange', () => {
  const corpus = syntheticCorpus(21, 0)

  it('returns only rows inside the half-open range', () => {
    const rows = rowsInDateRange(corpus, 5, 100, 150)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(corpus.dateIdx[r]).toBeGreaterThanOrEqual(100)
      expect(corpus.dateIdx[r]).toBeLessThan(150)
    }
  })

  it('excludes rows whose label is missing', () => {
    const holed = Float64Array.from(corpus.forwardReturn[5])
    for (let r = 0; r < corpus.rows; r++) if (corpus.dateIdx[r] === 120) holed[r] = NaN
    const rows = rowsInDateRange({ ...corpus, forwardReturn: { 5: holed } }, 5, 100, 150)
    for (const r of rows) expect(corpus.dateIdx[r]).not.toBe(120)
  })

  it('applies the stride without changing the range', () => {
    const all = rowsInDateRange(corpus, 5, 100, 150, 1)
    const strided = rowsInDateRange(corpus, 5, 100, 150, 4)
    expect(strided.length).toBe(Math.ceil(all.length / 4))
    expect(strided[0]).toBe(all[0])
  })

  it('rejects a horizon the corpus does not carry', () => {
    expect(() => rowsInDateRange(corpus, 7, 0, 100)).toThrow(/no horizon 7/)
  })
})
