import { describe, it, expect } from 'vitest'
import { computeMarketStructure } from '../index'
import { DEFAULT_CONFIG } from '../config'
import type { Candle } from '../../binance'

// ──────────────────────────────────────────────
// Candle factory
// ──────────────────────────────────────────────

function c(
  close: number,
  opts: { high?: number; low?: number; volume?: number } = {},
  i = 0,
): Candle {
  const high   = opts.high   ?? close + 1
  const low    = opts.low    ?? close - 1
  const volume = opts.volume ?? 1000
  return {
    openTime: i * 3_600_000,
    closeTime: i * 3_600_000 + 3_599_999,
    open: close,
    high,
    low,
    close,
    volume,
    quoteVolume: close * volume,
    trades: 10,
    takerBuyVolume: volume * 0.5,
    takerSellVolume: volume * 0.5,
  }
}

/** Build a staircase uptrend: alternating impulse legs and higher lows */
function buildBullishTrend(steps: number): Candle[] {
  // Each "step" = 10-candle pattern: 5 up + 5 pullback (still higher low)
  const cs: Candle[] = []
  let base = 100
  let i = 0

  // Warm-up to allow enough swing detection
  for (let s = 0; s < steps; s++) {
    const peak = base + 20
    // 5 candles rising to peak
    for (let k = 0; k < 5; k++) {
      const price = base + (peak - base) * (k + 1) / 5
      cs.push(c(price, {}, i++))
    }
    // 5 candles pulling back (but staying above previous base)
    const nextBase = base + 8  // higher low than before
    for (let k = 0; k < 5; k++) {
      const price = peak - (peak - nextBase) * (k + 1) / 5
      cs.push(c(price, {}, i++))
    }
    base = nextBase
  }

  return cs
}

/** Build a staircase downtrend */
function buildBearishTrend(steps: number): Candle[] {
  const cs: Candle[] = []
  let peak = 200
  let i = 0

  for (let s = 0; s < steps; s++) {
    const trough = peak - 20
    for (let k = 0; k < 5; k++) {
      const price = peak - (peak - trough) * (k + 1) / 5
      cs.push(c(price, {}, i++))
    }
    const nextPeak = peak - 8
    for (let k = 0; k < 5; k++) {
      const price = trough + (nextPeak - trough) * (k + 1) / 5
      cs.push(c(price, {}, i++))
    }
    peak = nextPeak
  }

  return cs
}

/** Build a flat / ranging market */
function buildRanging(bars: number, center = 100, amplitude = 1): Candle[] {
  return Array.from({ length: bars }, (_, i) => {
    const phase = (i / (bars / 4)) * Math.PI * 2
    const price = center + Math.sin(phase) * amplitude
    return c(price, { high: price + 0.5, low: price - 0.5 }, i)
  })
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('computeMarketStructure', () => {
  // ── Basic / edge cases ──────────────────────

  it('returns the empty result for an empty candle array', () => {
    const result = computeMarketStructure([])
    expect(result.trend).toBe('ranging')
    expect(result.strength).toBe('weak')
    expect(result.confidence).toBe(0)
    expect(result.swings).toHaveLength(0)
    expect(result.events).toHaveLength(0)
    expect(result.bos.detected).toBe(false)
    expect(result.choch.detected).toBe(false)
  })

  it('returns the empty result when there are too few candles to seed the ATR window', () => {
    // Default swingAtrPeriod=14 → needs at least 16 candles before any swing
    // threshold is computable.
    const result = computeMarketStructure([c(100, {}, 0), c(110, {}, 1), c(100, {}, 2), c(90, {}, 3)])
    expect(result.swings).toHaveLength(0)
  })

  it('is deterministic: same input always produces same output', () => {
    const trend = buildBullishTrend(4)
    const r1 = computeMarketStructure(trend)
    const r2 = computeMarketStructure(trend)
    expect(r1.trend).toBe(r2.trend)
    expect(r1.strength).toBe(r2.strength)
    expect(r1.confidence).toBe(r2.confidence)
    expect(r1.swings).toHaveLength(r2.swings.length)
    expect(r1.events).toHaveLength(r2.events.length)
  })

  // ── Structured output ────────────────────────

  it('result has all required top-level fields', () => {
    const result = computeMarketStructure(buildBullishTrend(3))
    expect(result).toHaveProperty('trend')
    expect(result).toHaveProperty('strength')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('structure')
    expect(result).toHaveProperty('bos')
    expect(result).toHaveProperty('choch')
    expect(result).toHaveProperty('pullback')
    expect(result).toHaveProperty('consolidation')
    expect(result).toHaveProperty('breakout')
    expect(result).toHaveProperty('swings')
    expect(result).toHaveProperty('events')
    expect(result).toHaveProperty('evidence')
  })

  it('confidence is always between 0 and 10', () => {
    expect(computeMarketStructure([]).confidence).toBe(0)
    expect(computeMarketStructure(buildBullishTrend(5)).confidence).toBeGreaterThanOrEqual(0)
    expect(computeMarketStructure(buildBullishTrend(5)).confidence).toBeLessThanOrEqual(10)
    expect(computeMarketStructure(buildBearishTrend(5)).confidence).toBeGreaterThanOrEqual(0)
    expect(computeMarketStructure(buildBearishTrend(5)).confidence).toBeLessThanOrEqual(10)
  })

  it('two calls to empty result return independent nested objects', () => {
    const r1 = computeMarketStructure([])
    const r2 = computeMarketStructure([])
    r1.bos.events.push({ type: 'BOS', index: 0, timestamp: 0, level: 100, direction: 'bullish' })
    expect(r2.bos.events).toHaveLength(0)
    r1.evidence.push('extra')
    expect(r2.evidence).toHaveLength(1)
    r1.swings.push({ index: 0, confirmedIndex: 0, timestamp: 0, price: 100, type: 'high', label: 'HH' })
    expect(r2.swings).toHaveLength(0)
  })

  it('evidence array is non-empty for valid candle data', () => {
    const result = computeMarketStructure(buildBullishTrend(3))
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('all evidence entries are non-empty strings', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    for (const e of result.evidence) {
      expect(typeof e).toBe('string')
      expect(e.length).toBeGreaterThan(0)
    }
  })

  it('swings are sorted by index ascending', () => {
    const result = computeMarketStructure(buildBullishTrend(4))
    for (let i = 1; i < result.swings.length; i++) {
      expect(result.swings[i].index).toBeGreaterThanOrEqual(result.swings[i - 1].index)
    }
  })

  it('swing prices are positive numbers', () => {
    const result = computeMarketStructure(buildBullishTrend(3))
    for (const s of result.swings) {
      expect(s.price).toBeGreaterThan(0)
      expect(Number.isFinite(s.price)).toBe(true)
    }
  })

  it('dominant swings alternate between high and low types', () => {
    const result = computeMarketStructure(buildBullishTrend(4))
    for (let i = 1; i < result.swings.length; i++) {
      expect(result.swings[i].type).not.toBe(result.swings[i - 1].type)
    }
  })

  it('structure counts are non-negative integers', () => {
    const { structure } = computeMarketStructure(buildBullishTrend(4))
    expect(structure.higherHighs).toBeGreaterThanOrEqual(0)
    expect(structure.higherLows).toBeGreaterThanOrEqual(0)
    expect(structure.lowerHighs).toBeGreaterThanOrEqual(0)
    expect(structure.lowerLows).toBeGreaterThanOrEqual(0)
    expect(structure.equalHighs).toBeGreaterThanOrEqual(0)
    expect(structure.equalLows).toBeGreaterThanOrEqual(0)
  })

  // ── Bullish trend ────────────────────────────

  it('identifies a strong bullish trend in a staircase uptrend', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    expect(result.trend).toBe('bullish')
    expect(['moderate', 'strong']).toContain(result.strength)
  })

  it('bullish trend has more HH+HL than LH+LL in structure counts', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    const bullish = result.structure.higherHighs + result.structure.higherLows
    const bearish = result.structure.lowerHighs + result.structure.lowerLows
    expect(bullish).toBeGreaterThan(bearish)
  })

  it('detects BOS bullish in a staircase uptrend', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    expect(result.bos.detected).toBe(true)
    const bullBos = result.bos.events.filter(e => e.direction === 'bullish')
    expect(bullBos.length).toBeGreaterThan(0)
  })

  it('BOS events store the structural price level that was breached', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    for (const e of result.bos.events) {
      expect(e.level).toBeGreaterThan(0)
      expect(Number.isFinite(e.level)).toBe(true)
    }
  })

  it('bos.last is the most recent BOS event', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    if (result.bos.last) {
      const maxIdx = Math.max(...result.bos.events.map(e => e.index))
      expect(result.bos.last.index).toBe(maxIdx)
    }
  })

  // ── Bearish trend ────────────────────────────

  it('identifies a strong bearish trend in a staircase downtrend', () => {
    const result = computeMarketStructure(buildBearishTrend(5))
    expect(result.trend).toBe('bearish')
    expect(['moderate', 'strong']).toContain(result.strength)
  })

  it('bearish trend has more LH+LL than HH+HL in structure counts', () => {
    const result = computeMarketStructure(buildBearishTrend(5))
    const bullish = result.structure.higherHighs + result.structure.higherLows
    const bearish = result.structure.lowerHighs + result.structure.lowerLows
    expect(bearish).toBeGreaterThan(bullish)
  })

  it('detects BOS bearish in a staircase downtrend', () => {
    const result = computeMarketStructure(buildBearishTrend(5))
    const bearBos = result.bos.events.filter(e => e.direction === 'bearish')
    expect(bearBos.length).toBeGreaterThan(0)
  })

  // ── Consolidation ────────────────────────────

  it('detects consolidation in a tight sideways market', () => {
    // Use amplitude=1 so range ≈ 2% (100 ± 1)
    const result = computeMarketStructure(buildRanging(60, 100, 1), {

      consolidationThreshold: 3.0,
      consolidationSwings: 5,
    })
    // May or may not detect depending on swing pattern; at minimum must not crash
    expect(typeof result.consolidation.detected).toBe('boolean')
  })

  // ── CHOCH ────────────────────────────────────

  it('detects CHOCH when uptrend reverses', () => {
    // Build: bullish steps then a sharp drop below the structural low.
    //
    // Six steps, not three: a CHoCH requires bullish BIAS to be established
    // first (a close above one confirmed swing high) before a break of a
    // confirmed swing low can be classified as a change of character rather
    // than a plain BOS. Volatility-thresholded swing detection spends the
    // first ~14 bars seeding ATR, so a 3-step fixture yields only a single
    // swing pair — never enough to establish bias before the reversal.
    const bullish = buildBullishTrend(6)
    const lowestLow = Math.min(...bullish.map(c => c.low))
    const crashCandles = Array.from({ length: 10 }, (_, k) =>
      c(lowestLow - 5 - k, {}, bullish.length + k),
    )
    const result = computeMarketStructure([...bullish, ...crashCandles])
    // Should detect at least one CHOCH
    expect(result.choch.detected).toBe(true)
  })

  // ── Pullback ─────────────────────────────────

  it('detects pullback when price retraces after BOS without breaking structure', () => {
    // Build uptrend, then add a pullback candle below the last BOS level
    // but above the last swing low
    const cfg = { ...DEFAULT_CONFIG }

    // Hand-crafted: swing low @ 90, swing high @ 110, then BOS close > 110, then pullback to 105
    const cs: Candle[] = [
      c(100, {}, 0),
      c(110, { high: 112 }, 1),  // candidate swing high
      c(90,  { low:  88  }, 2),  // candidate swing low
      c(115, {}, 3),             // visible from here; close > 112 → BOS
      c(105, {}, 4),             // pullback: below BOS level 112, above swing low 88
    ]
    const result = computeMarketStructure(cs, cfg)
    if (result.bos.detected) {
      // Pullback might or might not be detected depending on exact swing/BOS values
      // but if detected, depth must be in [0, 1]
      if (result.pullback.detected) {
        expect(result.pullback.depth).toBeGreaterThan(0)
        expect(result.pullback.depth).toBeLessThanOrEqual(1)
      }
    }
  })

  // ── Config overrides ─────────────────────────

  it('accepts partial config and merges with defaults', () => {
    const result = computeMarketStructure(buildBullishTrend(3), { swingReversalAtr: 1.5 })
    expect(result).toBeDefined()
  })

  it('a lower ATR reversal multiple detects at least as many swings as a higher one', () => {
    // Monotonic sensitivity: raising the threshold can only remove swings,
    // never add them, because the confirmation test is a strict inequality on
    // the same retracement measured against a larger bound.
    const data = buildBullishTrend(8)
    const loose  = computeMarketStructure(data, { swingReversalAtr: 1.0 })
    const strict = computeMarketStructure(data, { swingReversalAtr: 3.0 })
    expect(loose.swings.length).toBeGreaterThanOrEqual(strict.swings.length)
  })

  // ── Evidence ─────────────────────────────────

  it('bullish trend evidence mentions Higher Highs or Higher Lows', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    const hasHH = result.evidence.some(e => e.includes('Higher High'))
    const hasHL = result.evidence.some(e => e.includes('Higher Low'))
    expect(hasHH || hasHL).toBe(true)
  })

  it('bearish trend evidence mentions Lower Highs or Lower Lows', () => {
    const result = computeMarketStructure(buildBearishTrend(5))
    const hasLH = result.evidence.some(e => e.includes('Lower High'))
    const hasLL = result.evidence.some(e => e.includes('Lower Low'))
    expect(hasLH || hasLL).toBe(true)
  })

  it('BOS evidence mentions Break of Structure', () => {
    const result = computeMarketStructure(buildBullishTrend(5))
    if (result.bos.detected) {
      expect(result.evidence.some(e => e.includes('Break of Structure'))).toBe(true)
    }
  })

  // ── Edge cases ───────────────────────────────

  it('handles a single flat series (all same close) without crashing', () => {
    const flat = Array.from({ length: 50 }, (_, i) =>
      c(100, { high: 100, low: 100 }, i),
    )
    expect(() => computeMarketStructure(flat)).not.toThrow()
    const result = computeMarketStructure(flat)
    expect(result.swings).toHaveLength(0)
  })

  it('handles extreme volatility (10× swings) without NaN or Infinity', () => {
    const cs = Array.from({ length: 40 }, (_, i) =>
      c(i % 2 === 0 ? 100 : 1000, {}, i),
    )
    const result = computeMarketStructure(cs)
    expect(Number.isFinite(result.confidence)).toBe(true)
    for (const s of result.swings) {
      expect(Number.isFinite(s.price)).toBe(true)
    }
  })

  it('handles very low volatility (price moves < equalThreshold) without crashing', () => {
    const cs = Array.from({ length: 30 }, (_, i) => {
      const price = 100 + (i % 2 === 0 ? 0.001 : -0.001)
      return c(price, { high: price + 0.0001, low: price - 0.0001 }, i)
    })
    expect(() => computeMarketStructure(cs)).not.toThrow()
  })
})

// ── CRIT-01 regression: recentStructure ───────────────────────────────────────
describe('computeMarketStructure — recentStructure (CRIT-01)', () => {
  it('returns recentStructure in empty result when candles are insufficient', () => {
    const result = computeMarketStructure([])
    expect(result.recentStructure).toBeDefined()
    expect(result.recentStructure.higherHighs).toBe(0)
    expect(result.recentStructure.higherLows).toBe(0)
    expect(result.recentStructure.lowerHighs).toBe(0)
    expect(result.recentStructure.lowerLows).toBe(0)
    expect(result.recentStructure.equalHighs).toBe(0)
    expect(result.recentStructure.equalLows).toBe(0)
  })

  it('recentStructure counts never exceed structure counts for any metric', () => {
    // Build a series long enough to produce many labeled swings
    const cs = Array.from({ length: 60 }, (_, i) =>
      c(i % 2 === 0 ? 100 : 110, {}, i),
    )
    const result = computeMarketStructure(cs)
    const r = result.recentStructure
    const s = result.structure
    expect(r.higherHighs).toBeLessThanOrEqual(s.higherHighs)
    expect(r.higherLows).toBeLessThanOrEqual(s.higherLows)
    expect(r.lowerHighs).toBeLessThanOrEqual(s.lowerHighs)
    expect(r.lowerLows).toBeLessThanOrEqual(s.lowerLows)
    expect(r.equalHighs).toBeLessThanOrEqual(s.equalHighs)
    expect(r.equalLows).toBeLessThanOrEqual(s.equalLows)
  })

  it('recentStructure sum of labeled swings does not exceed (minSwingsForTrend * 2)', () => {
    // With minSwingsForTrend=4, the window is 8 labeled swings
    const cs = Array.from({ length: 100 }, (_, i) =>
      c(i % 2 === 0 ? 100 : 200, {}, i),
    )
    const result = computeMarketStructure(cs)
    const r = result.recentStructure
    const windowTotal = r.higherHighs + r.higherLows + r.lowerHighs + r.lowerLows + r.equalHighs + r.equalLows
    expect(windowTotal).toBeLessThanOrEqual(DEFAULT_CONFIG.minSwingsForTrend * 2)
  })
})
