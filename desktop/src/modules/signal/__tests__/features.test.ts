import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FEATURES, DIRECTIONAL_FEATURES, FEATURE_NAMES,
  extractFeatures, toRawFeatures,
  emaDistance, emaSlope, emaSeparation, rsiNormalized, adxNormalized,
  atrPercentile, bollingerPosition, bollingerWidth, swingStrength,
  marketEfficiencyRatio, supportResistanceDistance,
} from '../features'
import type { FeatureContext, FeatureSpec } from '../types'
import { makeInput, makeSeries, rescale } from './fixtures'
import type { Candle } from '../../market/types'

function ctxFor(candles: readonly Candle[]): FeatureContext {
  const input = makeInput(candles)
  return {
    candles: input.candles,
    timeframe: input.timeframe,
    indicators: input.indicators,
    marketStructure: input.marketStructure,
    supportResistance: input.supportResistance,
    higherTimeframes: new Map(),
  }
}

const TREND_UP = makeSeries({ n: 400, seed: 11, drift: 0.004, sigma: 0.006 })
const TREND_DOWN = makeSeries({ n: 400, seed: 12, drift: -0.004, sigma: 0.006 })
const WALK = makeSeries({ n: 400, seed: 13, sigma: 0.01 })

describe('registry', () => {
  it('has the fifteen required features, uniquely named', () => {
    expect(DEFAULT_FEATURES.length).toBe(15)
    expect(new Set(FEATURE_NAMES).size).toBe(15)
  })

  it('declares every directional feature as a member of the registry', () => {
    for (const name of DIRECTIONAL_FEATURES) expect(FEATURE_NAMES).toContain(name)
  })

  it('separates directional features from regime and state features', () => {
    // The load-bearing distinction: a regime statistic read as a directional
    // vote is what `adxBelowWeakThreshold` does in the engine being replaced.
    const nonDirectional = FEATURE_NAMES.filter(n => !DIRECTIONAL_FEATURES.includes(n))
    expect(nonDirectional.sort()).toEqual([
      'atr_percentile', 'bollinger_width', 'market_efficiency_ratio',
      'trend_persistence', 'volatility_regime', 'volume_anomaly',
    ])
  })

  it('emits no boolean anywhere — every value is a number or null', () => {
    const vs = extractFeatures(ctxFor(WALK))
    for (const [name, v] of Object.entries(vs)) {
      expect(typeof v.value === 'number' || v.value === null, `${name} produced ${typeof v.value}`).toBe(true)
      expect(typeof v.confidence).toBe('number')
      expect(v.confidence).toBeGreaterThanOrEqual(0)
      expect(v.confidence).toBeLessThanOrEqual(1)
      expect(typeof v.explanation).toBe('string')
      expect(v.explanation.length).toBeGreaterThan(0)
    }
  })

  it('reports a validity of "ok" exactly when a value is present', () => {
    for (const series of [TREND_UP, WALK, makeSeries({ n: 5, seed: 1 })]) {
      for (const v of Object.values(extractFeatures(ctxFor(series)))) {
        expect(v.value !== null).toBe(v.validity === 'ok')
        if (v.validity !== 'ok') expect(v.confidence).toBe(0)
      }
    }
  })
})

describe('scale freedom', () => {
  // The whole feature set is expressed in ATR multiples, ratios, log ratios or
  // bounded indices. That is not a convention — it is a THEOREM about this
  // design, and if any future feature carries a price level it breaks here
  // rather than silently letting a model learn to separate eras.
  it('every feature is invariant to a 1000x price rescaling', () => {
    const a = extractFeatures(ctxFor(WALK))
    const b = extractFeatures(ctxFor(rescale(WALK, 1000)))
    for (const name of FEATURE_NAMES) {
      expect(b[name].validity, name).toBe(a[name].validity)
      if (a[name].value === null) continue
      // Relative tolerance 1e-9: the operations are exact ratios, so the only
      // difference admissible is float rounding, which is ~1e-16 relative and
      // accumulates over at most a few hundred additions.
      const scale = Math.max(1, Math.abs(a[name].value!))
      expect(Math.abs(b[name].value! - a[name].value!) / scale, name).toBeLessThan(1e-9)
    }
  })

  it('is invariant to a 0.001x rescaling too, so the property is not one-sided', () => {
    const a = extractFeatures(ctxFor(WALK))
    const b = extractFeatures(ctxFor(rescale(WALK, 0.001)))
    for (const name of FEATURE_NAMES) {
      if (a[name].value === null) continue
      const scale = Math.max(1, Math.abs(a[name].value!))
      expect(Math.abs(b[name].value! - a[name].value!) / scale, name).toBeLessThan(1e-9)
    }
  })
})

describe('sign convention: positive = bullish', () => {
  const up = ctxFor(TREND_UP)
  const down = ctxFor(TREND_DOWN)

  it('holds for the trend family on an unambiguous trend', () => {
    for (const f of [emaDistance, emaSlope, emaSeparation]) {
      expect(f.extract(up).value!, `${f.name} up`).toBeGreaterThan(0)
      expect(f.extract(down).value!, `${f.name} down`).toBeLessThan(0)
    }
  })

  it('holds for the oscillator and momentum families', () => {
    expect(rsiNormalized.extract(up).value!).toBeGreaterThan(0)
    expect(rsiNormalized.extract(down).value!).toBeLessThan(0)
    expect(adxNormalized.extract(up).value!).toBeGreaterThan(0)
    expect(adxNormalized.extract(down).value!).toBeLessThan(0)
  })

  it('holds for swing structure', () => {
    expect(swingStrength.extract(up).value!).toBeGreaterThan(0)
    expect(swingStrength.extract(down).value!).toBeLessThan(0)
  })
})

describe('bounds', () => {
  const cs = [TREND_UP, TREND_DOWN, WALK].map(ctxFor)

  it('rsi_normalized stays in [-1, 1] — it is (rsi - 50) / 50', () => {
    for (const c of cs) {
      const v = rsiNormalized.extract(c).value
      if (v === null) continue
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('adx_normalized stays in [-1, 1] — (adx/100) times a DI share in [-1, 1]', () => {
    for (const c of cs) {
      const v = adxNormalized.extract(c).value
      if (v === null) continue
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
    }
  })

  it('swing_strength stays in [-1, 1] — it is a normalised count difference', () => {
    for (const c of cs) {
      const v = swingStrength.extract(c).value
      if (v === null) continue
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
    }
  })

  it('atr_percentile stays in [-0.5, 0.5] — it is a centred midrank', () => {
    for (const c of cs) {
      const v = atrPercentile.extract(c).value
      if (v === null) continue
      expect(v).toBeGreaterThanOrEqual(-0.5)
      expect(v).toBeLessThanOrEqual(0.5)
    }
  })

  it('market_efficiency_ratio stays in [0, 1] — |net| can never exceed path length', () => {
    for (const c of cs) {
      const v = marketEfficiencyRatio.extract(c).value
      if (v === null) continue
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('bollinger_width is non-negative — upper >= lower and middle > 0', () => {
    for (const c of cs) {
      const v = bollingerWidth.extract(c).value
      if (v === null) continue
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('atr_percentile actually behaves like a percentile', () => {
  // REGRESSION. The first version of this feature ranked the Wilder-smoothed
  // current ATR% against a distribution of UNSMOOTHED per-bar true ranges.
  // Those are different distributions — a 14-period average has a fraction of a
  // single bar's variance — so the statistic was crushed toward its middle.
  // Measured on this exact series: sd 0.069 and range [-0.140, 0.210] before
  // the fix; sd 0.272 and range [-0.495, 0.495] after. Both assertions below
  // separate those two states by a factor of about four.
  const series = makeSeries({ n: 500, seed: 909, sigma: 0.01 })
  const values: number[] = []
  for (let i = 200; i < series.length; i++) {
    const v = atrPercentile.extract(ctxFor(series.slice(0, i + 1))).value
    if (v !== null) values.push(v)
  }

  it('produced enough observations for the claim to mean anything', () => {
    expect(values.length).toBe(300)
  })

  it('uses most of its nominal range rather than hugging the middle', () => {
    const span = Math.max(...values) - Math.min(...values)
    // A midrank over a window of 100 that includes the current value is bounded
    // by ±0.495, so the full attainable span is 0.99. Requiring 80% of it means
    // the feature must actually reach near both extremes at some point.
    expect(span).toBeGreaterThan(0.8 * 0.99)
  })

  it('has close to the dispersion a percentile is supposed to have', () => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1))
    // A percentile of an exchangeable window is uniform on [-0.5, 0.5], whose
    // standard deviation is 1/sqrt(12) = 0.2887. ATR is autocorrelated so the
    // realised value sits somewhat below that; requiring 70% of it rejects the
    // broken form (which reached 24%) without asserting exchangeability the
    // data does not have.
    expect(sd).toBeGreaterThan(0.7 / Math.sqrt(12))
  })

  it('is bounded by the attainable midrank limits, not merely by [-0.5, 0.5]', () => {
    // With a window of exactly 100 including the current bar, the extreme
    // midranks are (0 + 0.5)/100 - 0.5 and (99 + 0.5)/100 - 0.5.
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(-0.495)
      expect(v).toBeLessThanOrEqual(0.495)
    }
  })

  it('ranks the same ATR% the indicator module reports, not a private variant', () => {
    // The feature builds its own ATR% series rather than reading
    // `indicators.atrPercent`, so the two must be shown to agree — otherwise
    // the explanation string would quote a number no other part of the engine
    // recognises. Same Wilder period, same candles, same formula.
    const ctx = ctxFor(WALK)
    const explanation = atrPercentile.extract(ctx).explanation
    const quoted = Number(/current ATR of ([0-9.]+)%/.exec(explanation)![1])
    expect(quoted).toBeCloseTo(ctx.indicators.atrPercent!, 2)
  })

  it('reads high after a volatility expansion and low after a contraction', () => {
    const calm = makeSeries({ n: 200, seed: 61, sigma: 0.004 })
    const last = calm[calm.length - 1]
    const loud = makeSeries({
      n: 30, seed: 62, sigma: 0.05, start: last.close, startTime: last.openTime + 1,
    })
    expect(atrPercentile.extract(ctxFor([...calm, ...loud])).value!).toBeGreaterThan(0.4)

    const noisy = makeSeries({ n: 200, seed: 63, sigma: 0.05 })
    const quiet = makeSeries({
      n: 30, seed: 64, sigma: 0.002,
      start: noisy[noisy.length - 1].close, startTime: noisy[noisy.length - 1].openTime + 1,
    })
    expect(atrPercentile.extract(ctxFor([...noisy, ...quiet])).value!).toBeLessThan(-0.2)
  })
})

describe('derived values, checked against the construction', () => {
  it('market_efficiency_ratio is exactly 1 on a monotone series', () => {
    // A strictly rising close series has |net| = path by definition, because
    // every increment has the same sign.
    const rising: Candle[] = Array.from({ length: 60 }, (_, i) => ({
      openTime: i * 1000, closeTime: i * 1000 + 999,
      open: 100 + i, high: 100 + i + 0.5, low: 100 + i - 0.5, close: 100 + i + 1,
      volume: 1000, quoteVolume: 100_000, trades: 10, takerBuyVolume: 500, takerSellVolume: 500,
    }))
    expect(marketEfficiencyRatio.extract(ctxFor(rising)).value!).toBeCloseTo(1, 12)
  })

  it('bollinger_position is 0 when price sits exactly on the midline', () => {
    const c = ctxFor(WALK)
    const bb = c.indicators.bollingerBands!
    const shifted: FeatureContext = {
      ...c,
      candles: [...c.candles.slice(0, -1), { ...c.candles[c.candles.length - 1], close: bb.middle }],
    }
    expect(bollingerPosition.extract(shifted).value!).toBeCloseTo(0, 12)
  })

  it('bollinger_position is +1 exactly at the upper band', () => {
    const c = ctxFor(WALK)
    const bb = c.indicators.bollingerBands!
    const shifted: FeatureContext = {
      ...c,
      candles: [...c.candles.slice(0, -1), { ...c.candles[c.candles.length - 1], close: bb.upper }],
    }
    expect(bollingerPosition.extract(shifted).value!).toBeCloseTo(1, 12)
  })

  it('sr_distance is 0 when price is equidistant from support and resistance', () => {
    const c = ctxFor(WALK)
    const sup = c.supportResistance.nearestSupport
    const res = c.supportResistance.nearestResistance
    if (sup === null || res === null) return   // no pair on this seed; nothing to assert
    const mid = (sup.center + res.center) / 2
    const shifted: FeatureContext = {
      ...c,
      candles: [...c.candles.slice(0, -1), { ...c.candles[c.candles.length - 1], close: mid }],
    }
    expect(supportResistanceDistance.extract(shifted).value!).toBeCloseTo(0, 9)
  })
})

describe('degenerate input', () => {
  it('every feature abstains on an empty window, and none throws', () => {
    const ctx: FeatureContext = ctxFor(makeSeries({ n: 400, seed: 5 }))
    const empty: FeatureContext = { ...ctx, candles: [] }
    const vs = extractFeatures(empty)
    for (const name of FEATURE_NAMES) {
      expect(vs[name].value, name).toBeNull()
      expect(vs[name].validity, name).not.toBe('ok')
    }
  })

  it('every feature abstains on a window far too short to compute anything', () => {
    const vs = extractFeatures(ctxFor(makeSeries({ n: 3, seed: 6 })))
    for (const name of FEATURE_NAMES) expect(vs[name].value, name).toBeNull()
  })

  it('a NaN close never becomes a NaN feature — it becomes an absence', () => {
    const c = ctxFor(WALK)
    const poisoned: FeatureContext = {
      ...c,
      candles: [...c.candles.slice(0, -1), { ...c.candles[c.candles.length - 1], close: NaN }],
    }
    const vs = extractFeatures(poisoned)
    for (const name of FEATURE_NAMES) {
      const v = vs[name].value
      expect(v === null || Number.isFinite(v), `${name} produced ${v}`).toBe(true)
    }
  })

  it('a flat market produces no NaN and no Infinity', () => {
    const flat: Candle[] = Array.from({ length: 300 }, (_, i) => ({
      openTime: i * 1000, closeTime: i * 1000 + 999,
      open: 100, high: 100, low: 100, close: 100,
      volume: 1000, quoteVolume: 100_000, trades: 10, takerBuyVolume: 500, takerSellVolume: 500,
    }))
    const vs = extractFeatures(ctxFor(flat))
    for (const name of FEATURE_NAMES) {
      const v = vs[name].value
      expect(v === null || Number.isFinite(v), `${name} produced ${v}`).toBe(true)
    }
  })

  it('a zero-volume window does not produce a -Infinity log volume', () => {
    const c = ctxFor(WALK)
    const zeroed: FeatureContext = {
      ...c,
      candles: c.candles.map(x => ({ ...x, volume: 0, quoteVolume: 0 })),
    }
    const v = extractFeatures(zeroed)['volume_anomaly']
    expect(v.value === null || Number.isFinite(v.value)).toBe(true)
  })
})

describe('extractFeatures', () => {
  it('converts a throwing feature into an unavailable one rather than failing the bar', () => {
    const bomb: FeatureSpec = {
      name: 'bomb', family: 'test', timeframe: 'base', scaling: 'none',
      extract: () => { throw new Error('detonated') },
    }
    const vs = extractFeatures(ctxFor(WALK), [...DEFAULT_FEATURES, bomb])
    expect(vs['bomb'].value).toBeNull()
    expect(vs['bomb'].validity).toBe('degenerate-input')
    expect(vs['bomb'].explanation).toContain('detonated')
    // The other fifteen still resolved.
    expect(Object.keys(vs).length).toBe(16)
  })

  it('is deterministic — identical input gives identical output', () => {
    const a = extractFeatures(ctxFor(WALK))
    const b = extractFeatures(ctxFor(WALK))
    expect(a).toEqual(b)
  })

  it('toRawFeatures keeps only "ok" values and nulls the rest', () => {
    const vs = extractFeatures(ctxFor(makeSeries({ n: 40, seed: 7 })))
    const raw = toRawFeatures(vs)
    for (const name of FEATURE_NAMES) {
      expect(raw[name]).toBe(vs[name].validity === 'ok' ? vs[name].value : null)
    }
  })
})
