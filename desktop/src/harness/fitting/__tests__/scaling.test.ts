import { describe, it, expect } from 'vitest'
import { scaleCorpus } from '../scaling'
import type { Corpus } from '../corpus'
import { FEATURE_NAMES, DEFAULT_FEATURES } from '../../../modules/signal/features'
import { MIN_SCALING_WINDOW, RollingScaler } from '../../../modules/signal/scaling'

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/**
 * A corpus of `symbols` blocks of `perSymbol` rows.
 *
 * `nullRate` injects unavailable values so the null path is exercised: a scaler
 * that silently treated NaN as 0 would agree with the reference on clean data
 * and diverge on real data, where features go unavailable constantly.
 */
function makeCorpus(symbols: number, perSymbol: number, seed: number, nullRate = 0.1): Corpus {
  const r = lcg(seed)
  const n = symbols * perSymbol
  const symbolIdx = new Int32Array(n)
  const dateIdx = new Int32Array(n)
  const features: Record<string, Float64Array> = {}
  for (const name of FEATURE_NAMES) features[name] = new Float64Array(n)

  let k = 0
  for (let s = 0; s < symbols; s++) {
    for (let t = 0; t < perSymbol; t++) {
      symbolIdx[k] = s
      dateIdx[k] = t
      for (const name of FEATURE_NAMES) {
        // Heavy tails and repeated values, so ties and outliers both occur.
        features[name][k] = r() < nullRate ? NaN
          : r() < 0.2 ? Math.round(r() * 4)
          : Math.tan((r() - 0.5) * 3)
      }
      k++
    }
  }
  return {
    rows: n, symbols: Array.from({ length: symbols }, (_, i) => `S${i}`),
    dates: Array.from({ length: perSymbol }, (_, i) => i * 86_400_000),
    symbolIdx, dateIdx, features, aux: {}, forwardReturn: {},
    lookbackBars: 200, horizons: [5], skipped: {},
  }
}

/** The reference: the live engine's own scaler, driven one row at a time. */
function referenceScale(corpus: Corpus, window: number): Record<string, (number | null)[]> {
  const specs = DEFAULT_FEATURES.map(f => ({ name: f.name, scaling: f.scaling }))
  const out: Record<string, (number | null)[]> = {}
  for (const name of FEATURE_NAMES) out[name] = []

  let current = -1
  let scaler = new RollingScaler(specs, window)
  for (let r = 0; r < corpus.rows; r++) {
    if (corpus.symbolIdx[r] !== current) {
      current = corpus.symbolIdx[r]
      scaler = new RollingScaler(specs, window)
    }
    const raw: Record<string, number | null> = {}
    for (const name of FEATURE_NAMES) {
      const v = corpus.features[name][r]
      raw[name] = Number.isFinite(v) ? v : null
    }
    const scaled = scaler.scaleNext(raw, corpus.dateIdx[r])
    for (const name of FEATURE_NAMES) out[name].push(scaled[name])
  }
  return out
}

describe('scaleCorpus matches the live engine bit for bit', () => {
  // This is the load-bearing claim of the file. The fast scaler exists purely
  // for speed; if it disagrees with `RollingScaler` anywhere then every number
  // in the study describes a scaler that is not the one Sentinel would ship.
  for (const window of [MIN_SCALING_WINDOW, 60, 126]) {
    it(`agrees exactly at window ${window}`, () => {
      const corpus = makeCorpus(4, 300, 7 + window)
      const fast = scaleCorpus(corpus, window)
      const ref = referenceScale(corpus, window)
      for (const name of FEATURE_NAMES) {
        for (let r = 0; r < corpus.rows; r++) {
          const a = fast.columns[name][r]
          const b = ref[name][r]
          if (b === null) {
            expect(Number.isNaN(a), `${name}[${r}] should be NaN`).toBe(true)
          } else {
            // toBe, not toBeCloseTo: identical traversal order over the window
            // makes exact equality achievable, and anything less would leave
            // room for a different summation order to hide here.
            expect(a, `${name}[${r}]`).toBe(b)
          }
        }
      }
    })
  }

  it('agrees when a feature is unavailable on every row', () => {
    const corpus = makeCorpus(2, 200, 99, 0)
    // Blank one feature entirely — it must never warm, and must not block others.
    const blanked = { ...corpus.features, ema_slope: new Float64Array(corpus.rows).fill(NaN) }
    const c2: Corpus = { ...corpus, features: blanked }
    const fast = scaleCorpus(c2, MIN_SCALING_WINDOW)
    const ref = referenceScale(c2, MIN_SCALING_WINDOW)
    for (let r = 0; r < c2.rows; r++) {
      expect(Number.isNaN(fast.columns['ema_slope'][r])).toBe(true)
      expect(ref['ema_slope'][r]).toBeNull()
    }
    for (let r = 0; r < c2.rows; r++) {
      const b = ref['ema_distance'][r]
      if (b !== null) expect(fast.columns['ema_distance'][r]).toBe(b)
    }
  })
})

describe('scaleCorpus — causality and input contract', () => {
  it('resets the trailing window at a symbol boundary', () => {
    // Otherwise symbol B's first bars would be scaled against symbol A's
    // history, which is not look-ahead but is a different and equally wrong
    // measurement: a $3 stock ranked against a $900 one.
    const corpus = makeCorpus(2, 100, 11, 0)
    const scaled = scaleCorpus(corpus, MIN_SCALING_WINDOW)
    // Row 100 is symbol 1's first row: nothing has warmed for it yet.
    for (const f of DEFAULT_FEATURES) {
      if (f.scaling === 'none') continue
      expect(Number.isNaN(scaled.columns[f.name][100]), f.name).toBe(true)
    }
  })

  it('a future row cannot change a past scaled value', () => {
    const base = makeCorpus(1, 200, 21, 0)
    const mutated: Corpus = {
      ...base,
      features: Object.fromEntries(FEATURE_NAMES.map(name => {
        const col = Float64Array.from(base.features[name])
        for (let r = 150; r < 200; r++) col[r] = 1e9
        return [name, col]
      })),
    }
    const a = scaleCorpus(base, MIN_SCALING_WINDOW)
    const b = scaleCorpus(mutated, MIN_SCALING_WINDOW)
    for (const name of FEATURE_NAMES) {
      for (let r = 0; r < 150; r++) {
        const x = a.columns[name][r], y = b.columns[name][r]
        if (Number.isNaN(x)) expect(Number.isNaN(y)).toBe(true)
        else expect(y, `${name}[${r}]`).toBe(x)
      }
    }
  })

  it('rejects rows that are not grouped by symbol', () => {
    const c = makeCorpus(2, 50, 31, 0)
    const shuffled = Int32Array.from(c.symbolIdx)
    shuffled[10] = 1
    shuffled[11] = 0
    expect(() => scaleCorpus({ ...c, symbolIdx: shuffled }, MIN_SCALING_WINDOW))
      .toThrow(/must be grouped by symbol/)
  })

  it('rejects rows that do not ascend in date within a symbol', () => {
    const c = makeCorpus(1, 50, 41, 0)
    const dates = Int32Array.from(c.dateIdx)
    ;[dates[20], dates[21]] = [dates[21], dates[20]]
    expect(() => scaleCorpus({ ...c, dateIdx: dates }, MIN_SCALING_WINDOW))
      .toThrow(/must ascend in date/)
  })

  it('rejects a window below the derived minimum', () => {
    const c = makeCorpus(1, 50, 51, 0)
    expect(() => scaleCorpus(c, MIN_SCALING_WINDOW - 1)).toThrow(/window must be an integer/)
  })
})
