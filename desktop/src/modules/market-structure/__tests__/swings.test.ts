import { describe, it, expect } from 'vitest'
import { detectSwings } from '../swings'
import { DEFAULT_CONFIG } from '../config'
import { atrSeries } from '../../indicators/utils'
import type { Candle } from '../../binance'
import type { MarketStructureConfig } from '../types'

// A short ATR window keeps fixtures compact; the algorithm is period-agnostic.
const cfg: MarketStructureConfig = { ...DEFAULT_CONFIG, swingAtrPeriod: 3, swingReversalAtr: 2.0 }

function bar(index: number, high: number, low: number, close?: number): Candle {
  const c = close ?? (high + low) / 2
  return {
    openTime: index * 3_600_000,
    closeTime: index * 3_600_000 + 3_599_999,
    open: c, high, low, close: c,
    volume: 1000, quoteVolume: c * 1000, trades: 10,
    takerBuyVolume: 500, takerSellVolume: 500,
  }
}

/**
 * Builds a candle series from centre prices with a fixed per-bar range.
 * A constant range makes ATR predictable, so thresholds in these tests are
 * exactly computable rather than guessed.
 */
function series(centres: number[], range = 1): Candle[] {
  return centres.map((p, i) => bar(i, p + range / 2, p - range / 2, p))
}

describe('detectSwings — preconditions', () => {
  it('returns empty when there are too few candles to seed ATR', () => {
    expect(detectSwings([], cfg)).toHaveLength(0)
    expect(detectSwings(series([100, 101, 102]), cfg)).toHaveLength(0)
  })

  it('returns empty for a perfectly flat market (zero ATR → no tradeable volatility)', () => {
    // A zero threshold would otherwise confirm a swing on any movement at all.
    const flat = Array.from({ length: 40 }, (_, i) => bar(i, 100, 100, 100))
    expect(detectSwings(flat, cfg)).toHaveLength(0)
  })

  it('returns empty for a monotonic ramp — no reversal ever occurs', () => {
    const up = series(Array.from({ length: 40 }, (_, i) => 100 + i))
    expect(detectSwings(up, cfg)).toHaveLength(0)
  })
})

describe('detectSwings — amplitude threshold (the core property)', () => {
  // Flat base establishes ATR ≈ range = 1, so the threshold is ≈ 2.0.
  const base = Array.from({ length: 20 }, () => 100)

  it('ignores a reversal smaller than swingReversalAtr × ATR', () => {
    // Rise to 105, then retrace only 1.0 (< 2.0 threshold) → no confirmation.
    const centres = [...base, 101, 102, 103, 104, 105, 104.2, 104.2, 104.2]
    const swings = detectSwings(series(centres), cfg)
    expect(swings).toHaveLength(0)
  })

  it('confirms a swing high once the retracement reaches the threshold', () => {
    // Same rise, but retrace 4.0 — comfortably beyond 2.0.
    const centres = [...base, 101, 102, 103, 104, 105, 101, 101, 101]
    const swings = detectSwings(series(centres), cfg)
    expect(swings.length).toBeGreaterThanOrEqual(1)
    const high = swings.find(s => s.type === 'high')
    expect(high).toBeDefined()
    expect(high!.price).toBeCloseTo(105.5, 5)   // high of the peak bar
    expect(high!.index).toBe(24)                 // the peak bar itself
  })

  it('every confirmed leg spans at least swingReversalAtr × ATR (structural guarantee)', () => {
    // A noisy oscillating series: whatever survives must satisfy the bound.
    const centres = [...base]
    for (let i = 0; i < 60; i++) centres.push(100 + 8 * Math.sin(i / 2) + (i % 3))
    const candles = series(centres)
    const swings = detectSwings(candles, cfg)
    expect(swings.length).toBeGreaterThan(1)

    const atrs = atrSeries(
      candles.map(c => c.high), candles.map(c => c.low), candles.map(c => c.close),
      cfg.swingAtrPeriod,
    )
    const atrAt = (i: number) => atrs[i - cfg.swingAtrPeriod]

    for (let i = 1; i < swings.length; i++) {
      const legSize = Math.abs(swings[i].price - swings[i - 1].price)
      // Threshold is evaluated at the later swing's confirmation bar.
      const threshold = cfg.swingReversalAtr * atrAt(swings[i].confirmedIndex)
      expect(legSize).toBeGreaterThanOrEqual(threshold - 1e-9)
    }
  })
})

describe('detectSwings — structural invariants', () => {
  const centres = [
    ...Array.from({ length: 20 }, () => 100),
    105, 110, 106, 101, 98, 104, 112, 108, 100, 95, 99, 107, 115, 110, 104,
  ]
  const candles = series(centres)
  const swings = detectSwings(candles, cfg)

  it('produces a strictly alternating high/low sequence', () => {
    expect(swings.length).toBeGreaterThan(2)
    for (let i = 1; i < swings.length; i++) {
      expect(swings[i].type).not.toBe(swings[i - 1].type)
    }
  })

  it('swings are ordered by index and never repeat a bar', () => {
    for (let i = 1; i < swings.length; i++) {
      expect(swings[i].index).toBeGreaterThan(swings[i - 1].index)
    }
  })

  it('confirmedIndex is always at or after the extreme it confirms', () => {
    for (const s of swings) {
      expect(s.confirmedIndex).toBeGreaterThanOrEqual(s.index)
    }
  })

  it('price is the extreme of its own bar (high for highs, low for lows)', () => {
    for (const s of swings) {
      const c = candles[s.index]
      expect(s.price).toBe(s.type === 'high' ? c.high : c.low)
    }
  })

  it('timestamp comes from the extreme bar, not the confirmation bar', () => {
    for (const s of swings) {
      expect(s.timestamp).toBe(candles[s.index].openTime)
    }
  })

  it('is deterministic — identical input yields identical output', () => {
    expect(detectSwings(candles, cfg)).toEqual(detectSwings(candles, cfg))
  })
})

describe('detectSwings — look-ahead safety and replay stability', () => {
  const centres = [
    ...Array.from({ length: 20 }, () => 100),
    104, 109, 112, 107, 102, 98, 103, 110, 116, 111, 105, 99, 96, 102, 108, 114,
  ]
  const candles = series(centres)

  it('a prefix run reproduces exactly the swings confirmed within that prefix', () => {
    // This is the formal replay-safety property: stepping candle-by-candle
    // must agree bar-for-bar with a full reload of the same history.
    const full = detectSwings(candles, cfg)
    expect(full.length).toBeGreaterThan(1)

    for (let m = cfg.swingAtrPeriod; m < candles.length; m++) {
      const prefix = detectSwings(candles.slice(0, m + 1), cfg)
      const expected = full.filter(s => s.confirmedIndex <= m)
      expect(prefix).toEqual(expected)
    }
  })

  it('never emits the still-forming extreme (no repainting)', () => {
    // The final leg is provisional by design: its extreme can still move, so
    // emitting it would repaint. Nothing may be confirmed on the last bar
    // unless that bar is itself the confirmation of an EARLIER extreme.
    const swings = detectSwings(candles, cfg)
    for (const s of swings) {
      expect(s.index).toBeLessThan(candles.length - 1)
    }
  })

  it('appending future candles never alters already-confirmed swings', () => {
    const early = detectSwings(candles.slice(0, 30), cfg)
    const later = detectSwings(candles, cfg)
    const stillValid = later.filter(s => s.confirmedIndex <= 29)
    expect(stillValid).toEqual(early)
  })

  it('prepending older history does not invent or relocate swings (backfill stability)', () => {
    // The window-start extreme is deliberately never emitted, so loading more
    // history cannot change the structure already derived from the newer bars.
    // Without that rule the first swing is a boundary artifact that moves
    // whenever the store backfills — the same market yielding a different
    // answer after a scroll.
    const older = series(Array.from({ length: 25 }, (_, i) => 100 + (i % 5)))
    const combined = [...older, ...centres.map((p, i) => bar(older.length + i, p + 0.5, p - 0.5, p))]

    const shortRun = detectSwings(candles, cfg)
    const longRun  = detectSwings(combined, cfg)

    // Re-express the long run in the short run's coordinate frame and compare
    // only the region both runs actually cover.
    const offset = older.length
    const overlap = longRun
      .filter(s => s.index >= offset)
      .map(s => ({ ...s, index: s.index - offset, confirmedIndex: s.confirmedIndex - offset }))

    // Every swing the short run found in the shared region is found identically
    // by the long run — no invented boundary swing, no relocation.
    for (const s of shortRun) {
      const match = overlap.find(o => o.index === s.index)
      expect(match).toBeDefined()
      expect(match!.type).toBe(s.type)
      expect(match!.price).toBeCloseTo(s.price, 9)
    }
  })
})

describe('detectSwings — volatility adaptation', () => {
  it('the same shape yields fewer swings when the threshold multiple is raised', () => {
    const centres = [
      ...Array.from({ length: 20 }, () => 100),
      103, 106, 103, 100, 97, 100, 103, 106, 103, 100, 97, 100, 103,
    ]
    const candles = series(centres)
    const loose = detectSwings(candles, { ...cfg, swingReversalAtr: 1.0 })
    const strict = detectSwings(candles, { ...cfg, swingReversalAtr: 4.0 })
    expect(strict.length).toBeLessThanOrEqual(loose.length)
  })

  it('scales with volatility: an identically-shaped but wider market yields the same structure', () => {
    // Scale-invariance — the same normalized shape produces the same swing
    // count regardless of absolute price scale, because ATR scales with it.
    const shape = [
      ...Array.from({ length: 20 }, () => 0),
      5, 10, 6, 1, -2, 4, 12, 8, 0, -5, -1, 7, 15, 10, 4,
    ]
    const small = series(shape.map(v => 100 + v), 1)
    const large = series(shape.map(v => 1000 + v * 10), 10)
    expect(detectSwings(large, cfg).length).toBe(detectSwings(small, cfg).length)
  })
})
