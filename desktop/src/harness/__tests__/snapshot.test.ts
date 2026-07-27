import { describe, it, expect } from 'vitest'
import { inferBarMs, reconstructTicker, windowMarketData, analyseWindow } from '../snapshot'
import { extractFeatures, extractCategorical } from '../features'
import { syntheticSeries } from '../sources'
import { bar, HOUR } from './fixtures'

describe('inferBarMs', () => {
  it('is the median spacing, so one gap cannot double the answer', () => {
    const c = [bar(0, 1, 1, 1, 1), bar(HOUR, 1, 1, 1, 1), bar(2 * HOUR, 1, 1, 1, 1), bar(9 * HOUR, 1, 1, 1, 1)]
    expect(inferBarMs(c)).toBe(HOUR)
  })
  it('is null when there is nothing to measure', () => {
    expect(inferBarMs([])).toBeNull()
    expect(inferBarMs([bar(0, 1, 1, 1, 1)])).toBeNull()
  })
})

describe('reconstructTicker', () => {
  const hours = Array.from({ length: 40 }, (_, i) => bar(i * HOUR, 100 + i, 200 + i, 50 + i, 100 + i, 10))

  it('aggregates exactly the trailing 24 bars at a 1h bar duration', () => {
    const t = reconstructTicker('T', hours)
    expect(t.openTime).toBe(16 * HOUR)          // bars 16..39
    expect(t.openPrice).toBe(hours[16].open)
    expect(t.highPrice).toBe(200 + 39)
    expect(t.lowPrice).toBe(50 + 16)
    expect(t.volume).toBe(24 * 10)
  })

  it('never reads a bar after the window — the window IS the past', () => {
    const t = reconstructTicker('T', hours)
    expect(t.lastPrice).toBe(hours[hours.length - 1].close)
    expect(t.closeTime).toBe(hours[hours.length - 1].closeTime)
  })

  it('uses the whole window when it holds less than 24h', () => {
    const short = hours.slice(0, 5)
    const t = reconstructTicker('T', short)
    expect(t.openPrice).toBe(short[0].open)
    expect(t.volume).toBe(50)
  })

  it('collapses to a single bar when one bar already spans a day or more', () => {
    const daily = Array.from({ length: 10 }, (_, i) => ({
      ...bar(i * 86_400_000, 100, 110, 90, 105, 7),
      closeTime: i * 86_400_000 + 86_399_999,
    }))
    const t = reconstructTicker('T', daily)
    expect(t.volume).toBe(7)
    expect(t.highPrice).toBe(110)
  })

  it('reports weightedAvgPrice as quote/base, not the close', () => {
    const c = [
      { ...bar(0, 10, 10, 10, 10, 2), quoteVolume: 20 },
      { ...bar(HOUR, 20, 20, 20, 20, 8), quoteVolume: 160 },
    ]
    expect(reconstructTicker('T', c).weightedAvgPrice).toBe(180 / 10)
  })

  it('does not divide by zero when the window traded nothing', () => {
    const c = [bar(0, 10, 10, 10, 10, 0), bar(HOUR, 10, 10, 10, 10, 0)]
    const t = reconstructTicker('T', c)
    expect(Number.isFinite(t.weightedAvgPrice)).toBe(true)
    expect(Number.isFinite(t.priceChangePercent)).toBe(true)
  })
})

describe('windowMarketData', () => {
  const w = syntheticSeries({ symbol: 'W', timeframe: '1h', bars: 60, seed: 5 }).candles

  it('timestamps the analysis from the data, never from a clock', () => {
    expect(windowMarketData('W', '1h', w).fetchedAt).toBe(w[w.length - 1].closeTime)
  })

  it('copies the candles so the engine cannot mutate the harness\'s series', () => {
    const md = windowMarketData('W', '1h', w)
    expect(md.candles).not.toBe(w)
    expect(md.candles).toEqual([...w])
  })
})

describe('analyseWindow', () => {
  const w = syntheticSeries({ symbol: 'A', timeframe: '1h', bars: 200, seed: 17 }).candles

  it('is a pure function of the window', () => {
    expect(JSON.stringify(analyseWindow('A', '1h', w))).toBe(JSON.stringify(analyseWindow('A', '1h', w)))
  })

  it('produces the fields the feature extractor depends on', () => {
    const s = analyseWindow('A', '1h', w)
    const f = extractFeatures(s, w[w.length - 1].close)
    for (const k of ['rsi', 'atr_pct', 'confidence_score', 'trust_score', 'evidence_count']) {
      expect(f[k]).toBeTypeOf('number')
    }
    expect(Object.keys(extractCategorical(s)).sort()).toEqual([
      'direction', 'ema_alignment', 'grade', 'ms_strength', 'ms_trend', 'setup_quality', 'trend', 'vwap_side',
    ])
  })

  it('emits no raw price as a feature', () => {
    // Scaling every price by 1000 must not move a scale-free feature. Any
    // feature that changes is carrying price level and would let a model
    // identify the era instead of the market.
    const scaled = w.map(c => ({
      ...c, open: c.open * 1000, high: c.high * 1000, low: c.low * 1000, close: c.close * 1000,
      quoteVolume: c.quoteVolume * 1000,
    }))
    const a = extractFeatures(analyseWindow('A', '1h', w), w[w.length - 1].close)
    const b = extractFeatures(analyseWindow('A', '1h', scaled), scaled[scaled.length - 1].close)
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort())
    for (const k of Object.keys(a)) {
      // Floating point: a 1000x rescale is not bit-exact through exp/log paths.
      expect(Math.abs(a[k] - b[k])).toBeLessThan(1e-9 * Math.max(1, Math.abs(a[k])))
    }
  })

  it('emits only finite numbers', () => {
    const s = analyseWindow('A', '1h', w)
    for (const [k, v] of Object.entries(extractFeatures(s, w[w.length - 1].close))) {
      expect(Number.isFinite(v), `${k} = ${v}`).toBe(true)
    }
  })

  it('omits an unavailable indicator rather than defaulting it to zero', () => {
    // 30 bars is far short of EMA200; the key must be absent, not 0.
    const f = extractFeatures(analyseWindow('A', '1h', w.slice(0, 30)), w[29].close)
    expect('dist_ema200' in f).toBe(false)
    expect('dist_ema20' in f).toBe(true)
  })
})
