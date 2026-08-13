/**
 * Phase 12 — Frozen-truth cross-layer integration tests.
 *
 * These tests serve two purposes:
 *
 * 1. FROZEN TRUTH — Pin the exact output of each pipeline stage for a
 *    carefully designed 32-candle fixture. Every expected value is derived
 *    by hand arithmetic; the test catches regressions in ATR computation,
 *    swing confirmation, BOS detection, and Fibonacci level mathematics.
 *
 * 2. CROSS-LAYER IDENTITY — Verify that downstream pipeline stages consume
 *    the exact price/timestamp values that upstream stages produced, rather
 *    than independently recomputing them. A regression in wiring — e.g.
 *    Fibonacci anchoring to a different swing than market structure detected,
 *    or a BOS event citing a price that no swing ever had — would break the
 *    single-source-of-truth principle and cause drawings to misalign from
 *    analysis.
 *
 * ── Fixture design ────────────────────────────────────────────────────────────
 *
 * 32 candles, step-by-1 closes, default ±0.5 range (high=close+0.5, low=close-0.5).
 * Config: { swingAtrPeriod: 3, swingReversalAtr: 2.0 }
 *
 * ATR derivation (all steps of ±1):
 *   TR = max(1.0, |close±0.5 − prevClose|) = max(1.0, 1.5) = 1.5   (for ±1 steps)
 *   ATR seed (period=3) = mean(1.5, 1.5, 1.5) = 1.5   — stable thereafter.
 *   Threshold = swingReversalAtr × ATR = 2.0 × 1.5 = 3.0
 *
 * Swing confirmation (high H = close+0.5):
 *   H confirms when some later bar's low ≤ H − 3.0, i.e. close ≤ close_at_H − 2.0
 *   → price must fall exactly 2 full closes from the peak (symmetric for lows).
 *
 * Candle sequence (closes):
 *   [100, 101, 102, 103, 104, 105, 106, 107, 108, 107, 106, 105, 104, 105, 106, 107,
 *     108, 109, 110, 111, 110, 109, 108, 107, 108, 109, 110, 111, 112, 113, 112, 111]
 *
 * Hand-derived swing table:
 *   i | type | index | confirmedIndex | price
 *   0 | high |   8   |      10        | 108.5   (label: null — first of type)
 *   1 | low  |  12   |      14        | 103.5   (label: null — first of type)
 *   2 | high |  19   |      21        | 111.5   (label: HH)
 *   3 | low  |  23   |      25        | 106.5   (label: HL)
 *   4 | high |  29   |      31        | 113.5   (label: HH)
 *
 * Hand-derived BOS events:
 *   bar 17: close=109 > 108.5  → BOS bullish  (level = swing price at index 8)
 *   bar 28: close=112 > 111.5  → BOS bullish  (level = swing price at index 19)
 *
 * Hand-derived Fibonacci (most recent HH+HL impulse: index 29 + index 23):
 *   swingHigh.price = 113.5,  swingLow.price = 106.5,  range = 7.0
 *   direction = 'bullish'
 */

import { describe, it, expect } from 'vitest'
import type { Candle } from '../../binance'
import { computeMarketStructure } from '../../market-structure/index'
import { computeFibonacci } from '../compute'
import type { SupportResistanceResult } from '../../support-resistance/types'

const CLOSE_PREC = 10   // decimal places for price comparisons

// ── Fixture ───────────────────────────────────────────────────────────────────

const CLOSES: readonly number[] = [
  100, 101, 102, 103, 104, 105, 106, 107, 108, 107, 106, 105, 104, 105, 106, 107,
  108, 109, 110, 111, 110, 109, 108, 107, 108, 109, 110, 111, 112, 113, 112, 111,
]
const HOUR = 3_600_000
const CFG = { swingAtrPeriod: 3, swingReversalAtr: 2.0 }

function makeCandles(): Candle[] {
  return CLOSES.map((close, i): Candle => ({
    openTime:       i * HOUR,
    closeTime:      i * HOUR + HOUR - 1,
    open:           close,
    high:           close + 0.5,
    low:            close - 0.5,
    close,
    volume:         1_000,
    quoteVolume:    close * 1_000,
    trades:         10,
    takerBuyVolume: 500,
    takerSellVolume: 500,
  }))
}

const EMPTY_SR: SupportResistanceResult = {
  zones:             [],
  activeSupport:     [],
  activeResistance:  [],
  nearestSupport:    null,
  nearestResistance: null,
  currentZone:       null,
  evidence:          [],
}

// ── Phase 12a — Frozen-truth: swing detection output ─────────────────────────

describe('Phase 12a — frozen-truth swing detection', () => {
  const ms = computeMarketStructure(makeCandles(), CFG)

  it('detects exactly 5 swings', () => {
    expect(ms.swings).toHaveLength(5)
  })

  it('swing 0: first HIGH at index 8, confirmedIndex 10, price 108.5', () => {
    const s = ms.swings[0]
    expect(s.type).toBe('high')
    expect(s.index).toBe(8)
    expect(s.confirmedIndex).toBe(10)
    expect(s.price).toBeCloseTo(108.5, CLOSE_PREC)
    expect(s.timestamp).toBe(8 * HOUR)
    expect(s.label).toBeNull()
  })

  it('swing 1: first LOW at index 12, confirmedIndex 14, price 103.5', () => {
    const s = ms.swings[1]
    expect(s.type).toBe('low')
    expect(s.index).toBe(12)
    expect(s.confirmedIndex).toBe(14)
    expect(s.price).toBeCloseTo(103.5, CLOSE_PREC)
    expect(s.timestamp).toBe(12 * HOUR)
    expect(s.label).toBeNull()
  })

  it('swing 2: HH at index 19, confirmedIndex 21, price 111.5', () => {
    const s = ms.swings[2]
    expect(s.type).toBe('high')
    expect(s.index).toBe(19)
    expect(s.confirmedIndex).toBe(21)
    expect(s.price).toBeCloseTo(111.5, CLOSE_PREC)
    expect(s.timestamp).toBe(19 * HOUR)
    expect(s.label).toBe('HH')
  })

  it('swing 3: HL at index 23, confirmedIndex 25, price 106.5', () => {
    const s = ms.swings[3]
    expect(s.type).toBe('low')
    expect(s.index).toBe(23)
    expect(s.confirmedIndex).toBe(25)
    expect(s.price).toBeCloseTo(106.5, CLOSE_PREC)
    expect(s.timestamp).toBe(23 * HOUR)
    expect(s.label).toBe('HL')
  })

  it('swing 4: HH at index 29, confirmedIndex 31, price 113.5', () => {
    const s = ms.swings[4]
    expect(s.type).toBe('high')
    expect(s.index).toBe(29)
    expect(s.confirmedIndex).toBe(31)
    expect(s.price).toBeCloseTo(113.5, CLOSE_PREC)
    expect(s.timestamp).toBe(29 * HOUR)
    expect(s.label).toBe('HH')
  })

  it('identifies bullish trend from HH/HL structure', () => {
    expect(ms.trend).toBe('bullish')
  })
})

// ── Phase 12b — Frozen-truth: BOS events ─────────────────────────────────────

describe('Phase 12b — frozen-truth BOS events', () => {
  const ms = computeMarketStructure(makeCandles(), CFG)

  it('produces exactly 2 BOS events and no CHoCH', () => {
    expect(ms.bos.events).toHaveLength(2)
    expect(ms.choch.events).toHaveLength(0)
  })

  it('BOS 0: bullish break of 108.5 at bar 17', () => {
    // close[17]=109 > lastHigh.price=108.5 (swing at index=8, confirmed at 10)
    const e = ms.bos.events[0]
    expect(e.type).toBe('BOS')
    expect(e.direction).toBe('bullish')
    expect(e.index).toBe(17)
    expect(e.timestamp).toBe(17 * HOUR)
    expect(e.level).toBeCloseTo(108.5, CLOSE_PREC)
  })

  it('BOS 1: bullish break of 111.5 at bar 28', () => {
    // close[28]=112 > lastHigh.price=111.5 (swing at index=19, confirmed at 21)
    const e = ms.bos.events[1]
    expect(e.type).toBe('BOS')
    expect(e.direction).toBe('bullish')
    expect(e.index).toBe(28)
    expect(e.timestamp).toBe(28 * HOUR)
    expect(e.level).toBeCloseTo(111.5, CLOSE_PREC)
  })
})

// ── Phase 12c — Cross-layer: BOS levels are exact swing prices ────────────────
//
// Every BOS / CHoCH event level must be the price of a detected swing.
// A regression where detectBosChoch independently computed the price from
// candle data (rather than from the swing object) would show up here.

describe('Phase 12c — cross-layer: BOS/CHoCH levels are exact swing prices', () => {
  const ms = computeMarketStructure(makeCandles(), CFG)

  it('each BOS event level equals an exact swing price', () => {
    const swingPrices = new Set(ms.swings.map(s => s.price))
    for (const e of ms.events) {
      expect(swingPrices.has(e.level),
        `event level ${e.level} at bar ${e.index} is not a detected swing price`
      ).toBe(true)
    }
  })

  it('the two BOS levels reference the swings at indices 8 and 19 specifically', () => {
    const swingAtIndex8  = ms.swings.find(s => s.index === 8)!
    const swingAtIndex19 = ms.swings.find(s => s.index === 19)!
    expect(ms.bos.events[0].level).toBeCloseTo(swingAtIndex8.price,  CLOSE_PREC)
    expect(ms.bos.events[1].level).toBeCloseTo(swingAtIndex19.price, CLOSE_PREC)
  })
})

// ── Phase 12d — Cross-layer: Fibonacci anchors come from labeled swings ───────
//
// computeFibonacci receives ms.swings and selects the most recent HH + HL as
// anchors. The result's swingHigh.price / swingLow.price must equal the prices
// of those specific labeled swings — not a price recomputed from candles.

describe('Phase 12d — cross-layer: Fibonacci anchors come from labeled swing prices', () => {
  const ms  = computeMarketStructure(makeCandles(), CFG)
  const fib = computeFibonacci(ms.swings, ms.trend, EMPTY_SR, null)

  it('Fibonacci is available (bullish impulse confirmed)', () => {
    expect(fib.available).toBe(true)
  })

  it('swingHigh.price equals the price of the most recent HH swing', () => {
    const lastHH = ms.swings.filter(s => s.label === 'HH').at(-1)!
    expect(fib.swingHigh.price).toBeCloseTo(lastHH.price, CLOSE_PREC)
  })

  it('swingHigh.timestamp equals the timestamp of the most recent HH swing', () => {
    const lastHH = ms.swings.filter(s => s.label === 'HH').at(-1)!
    expect(fib.swingHigh.timestamp).toBe(lastHH.timestamp)
  })

  it('swingLow.price equals the price of the preceding HL swing', () => {
    // The anchor HL is the most recent HL whose index < the anchor HH's index.
    const anchorHH = ms.swings.filter(s => s.label === 'HH').at(-1)!
    const anchorHL = ms.swings
      .filter(s => s.label === 'HL' && s.index < anchorHH.index)
      .at(-1)!
    expect(fib.swingLow.price).toBeCloseTo(anchorHL.price, CLOSE_PREC)
  })

  it('swingLow.timestamp equals the timestamp of the preceding HL swing', () => {
    const anchorHH = ms.swings.filter(s => s.label === 'HH').at(-1)!
    const anchorHL = ms.swings
      .filter(s => s.label === 'HL' && s.index < anchorHH.index)
      .at(-1)!
    expect(fib.swingLow.timestamp).toBe(anchorHL.timestamp)
  })

  it('swingHigh.price is exactly 113.5 (frozen value)', () => {
    expect(fib.swingHigh.price).toBeCloseTo(113.5, CLOSE_PREC)
  })

  it('swingLow.price is exactly 106.5 (frozen value)', () => {
    expect(fib.swingLow.price).toBeCloseTo(106.5, CLOSE_PREC)
  })

  it('direction is bullish (low came before high)', () => {
    expect(fib.direction).toBe('bullish')
  })
})

// ── Phase 12e — Frozen-truth: Fibonacci level prices ─────────────────────────
//
// Given swingHigh=113.5, swingLow=106.5, range=7.0:
//   bullish level price = 113.5 − ratio × 7.0
//
// Every ratio is tested against its hand-computed value.

describe('Phase 12e — frozen-truth Fibonacci level prices', () => {
  const ms  = computeMarketStructure(makeCandles(), CFG)
  const fib = computeFibonacci(ms.swings, ms.trend, EMPTY_SR, null)

  const H = 113.5
  const R = 7.0   // range = H − L = 113.5 − 106.5

  const EXPECTED: Array<[number, number]> = [
    [0.000,  H - 0.000 * R],   // 113.500
    [0.236,  H - 0.236 * R],   // 111.848
    [0.382,  H - 0.382 * R],   // 110.826
    [0.500,  H - 0.500 * R],   // 110.000
    [0.618,  H - 0.618 * R],   // 109.174
    [0.650,  H - 0.650 * R],   // 108.950
    [0.786,  H - 0.786 * R],   // 107.998
    [1.000,  H - 1.000 * R],   // 106.500
    [1.272,  H - 1.272 * R],   // 104.596
    [1.618,  H - 1.618 * R],   // 102.174
    [2.000,  H - 2.000 * R],   //  99.500
  ]

  it('produces exactly 11 levels', () => {
    expect(fib.available).toBe(true)
    expect(fib.levels).toHaveLength(11)
  })

  for (const [ratio, expected] of EXPECTED) {
    it(`ratio ${ratio.toFixed(3)} → price ${expected.toFixed(3)}`, () => {
      const level = fib.levels.find(l => l.ratio === ratio)
      expect(level, `no level with ratio ${ratio}`).toBeDefined()
      expect(level!.price).toBeCloseTo(expected, CLOSE_PREC)
    })
  }

  it('1.000 level is exactly swingLow.price (anchor round-trips)', () => {
    // ratio 1.000: H − 1.0 × (H − L) = L — Fibonacci maps back to the swing low.
    const level100 = fib.levels.find(l => l.ratio === 1.000)!
    expect(level100.price).toBeCloseTo(fib.swingLow.price, CLOSE_PREC)
  })

  it('0.000 level is exactly swingHigh.price (anchor round-trips)', () => {
    const level000 = fib.levels.find(l => l.ratio === 0.000)!
    expect(level000.price).toBeCloseTo(fib.swingHigh.price, CLOSE_PREC)
  })
})

// ── Phase 12f — Cross-layer invariant: general regime sweep ──────────────────
//
// For any candle sequence that produces a non-ranging trend and available
// Fibonacci, the Fibonacci anchor prices must be exact prices from the
// labeled swings that computeMarketStructure detected. No layer may
// independently recompute a price from candle data.

function makeLcgRng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000 }
}

function syntheticCandles(drift: number, vol: number, n: number, seed: number): Candle[] {
  const rng = makeLcgRng(seed)
  let p = 100
  return Array.from({ length: n }, (_, i): Candle => {
    p = Math.max(1, p * (1 + drift + (rng() - 0.5) * vol))
    const spread = p * vol * 0.5
    const h = p + spread * rng()
    const l = p - spread * rng()
    return {
      openTime:       i * HOUR,
      closeTime:      i * HOUR + HOUR - 1,
      open:           p,
      high:           Math.max(h, p),
      low:            Math.min(l, p),
      close:          p,
      volume:         1_000 * (0.5 + rng()),
      quoteVolume:    p * 1_000,
      trades:         10,
      takerBuyVolume: 500,
      takerSellVolume: 500,
    }
  })
}

const SWEEP: Array<[number, number, number, number]> = []
for (const drift of [-0.002, 0, 0.002]) {
  for (const vol of [0.005, 0.015]) {
    for (const n of [80, 200]) {
      SWEEP.push([drift, vol, n, drift * 1e6 + vol * 1e4 + n])
    }
  }
}

describe('Phase 12f — cross-layer invariant: Fibonacci anchors in swing price set (regime sweep)', () => {
  it.each(SWEEP)(
    'drift=%s vol=%s n=%s — fib anchors match labeled swing prices',
    (drift, vol, n, seed) => {
      const candles = syntheticCandles(drift, vol, n, Math.round(seed))
      const ms  = computeMarketStructure(candles)
      const fib = computeFibonacci(ms.swings, ms.trend, EMPTY_SR, null)

      if (!fib.available) return   // no impulse detected — nothing to assert

      const labeledHighPrices = new Set(
        ms.swings.filter(s => s.type === 'high' && s.label !== null).map(s => s.price),
      )
      const labeledLowPrices = new Set(
        ms.swings.filter(s => s.type === 'low' && s.label !== null).map(s => s.price),
      )

      // swingHigh.price must be from a labeled high swing
      expect(labeledHighPrices.has(fib.swingHigh.price),
        `fib.swingHigh.price ${fib.swingHigh.price} not found in labeled HIGH swing prices`
      ).toBe(true)

      // swingLow.price must be from a labeled low swing
      expect(labeledLowPrices.has(fib.swingLow.price),
        `fib.swingLow.price ${fib.swingLow.price} not found in labeled LOW swing prices`
      ).toBe(true)

      // Anchor timestamps must match exactly
      const matchHigh = ms.swings.find(s => s.price === fib.swingHigh.price && s.type === 'high')!
      const matchLow  = ms.swings.find(s => s.price === fib.swingLow.price  && s.type === 'low')!
      expect(fib.swingHigh.timestamp).toBe(matchHigh.timestamp)
      expect(fib.swingLow.timestamp).toBe(matchLow.timestamp)
    },
  )
})

describe('Phase 12f — cross-layer invariant: BOS/CHoCH levels in swing price set (regime sweep)', () => {
  it.each(SWEEP)(
    'drift=%s vol=%s n=%s — every structure event level is an exact swing price',
    (drift, vol, n, seed) => {
      const candles = syntheticCandles(drift, vol, n, Math.round(seed))
      const ms = computeMarketStructure(candles)
      const swingPrices = new Set(ms.swings.map(s => s.price))

      for (const e of ms.events) {
        expect(swingPrices.has(e.level),
          `${e.type} level ${e.level} at bar ${e.index} is not in detected swing prices`
        ).toBe(true)
      }
    },
  )
})
