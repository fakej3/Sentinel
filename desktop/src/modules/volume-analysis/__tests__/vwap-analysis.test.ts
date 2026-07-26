import { describe, it, expect } from 'vitest'
import { computeVWAPAnalysis } from '../compute/vwap-analysis'
import { computeVwapSeries } from '../../indicators/compute/vwap'
import { DEFAULT_CONFIG } from '../config'
import type { Candle } from '../../market/types'

const HOUR = 3_600_000
const DAY = 86_400_000

/**
 * One hourly bar. `price` sets O/H/L/C so the typical price equals the close —
 * that keeps every expectation below arithmetic rather than incidental.
 */
function bar(i: number, price: number, volume = 100, dayOffset = 0): Candle {
  const openTime = DAY * (10 + dayOffset) + i * HOUR
  return {
    openTime,
    closeTime: openTime + HOUR - 1,
    open: price, high: price, low: price, close: price,
    volume,
    quoteVolume: price * volume,
    trades: 1,
    takerBuyVolume: volume / 2,
    takerSellVolume: volume / 2,
  }
}

/** Bars 0..n−1 of the same UTC day, priced by `priceAt`. */
function session(prices: number[], volume = 100): Candle[] {
  return prices.map((p, i) => bar(i, p, volume))
}

describe('computeVWAPAnalysis — side and distance', () => {
  it('reports "above" when the close exceeds the session VWAP', () => {
    // Session VWAP over [100, 100, 130] is 110; the last close is 130.
    const r = computeVWAPAnalysis(session([100, 100, 130]), DEFAULT_CONFIG)
    expect(r.available).toBe(true)
    expect(r.side).toBe('above')
    expect(r.value).toBeCloseTo(110, 6)
    expect(r.distancePercent).toBeCloseTo(((130 - 110) / 110) * 100, 6)
  })

  it('reports "below" with a negative distance when the close is under VWAP', () => {
    const r = computeVWAPAnalysis(session([130, 130, 100]), DEFAULT_CONFIG)
    expect(r.side).toBe('below')
    expect(r.distancePercent as number).toBeLessThan(0)
  })

  it('reports "at" — a distinct third state — when the close sits exactly on VWAP', () => {
    // The old boolean pair had no way to express this and rendered it as
    // "below", i.e. as bearish evidence.
    const r = computeVWAPAnalysis(session([100, 100, 100]), DEFAULT_CONFIG)
    expect(r.side).toBe('at')
    expect(r.distancePercent).toBeCloseTo(0, 9)
  })
})

describe('computeVWAPAnalysis — respectingVWAP', () => {
  it('is true within vwapProximityPercent of VWAP', () => {
    // VWAP 100, close 100.2 → 0.2% ≤ the 0.5% default band.
    const r = computeVWAPAnalysis(session([100, 100, 100, 100.2]), DEFAULT_CONFIG)
    expect(r.distancePercent as number).toBeLessThan(DEFAULT_CONFIG.vwapProximityPercent)
    expect(r.respectingVWAP).toBe(true)
  })

  it('is false when price is far from VWAP with no recent cross', () => {
    // Price runs away above VWAP and never comes back through it.
    const r = computeVWAPAnalysis(session([100, 120, 140, 160, 180, 200]), DEFAULT_CONFIG)
    expect(r.side).toBe('above')
    expect(r.respectingVWAP).toBe(false)
  })

  it('is true when price crossed VWAP within the lookback', () => {
    // Rises above the session VWAP, then closes below it — a genuine sign
    // change of (close − VWAP), and far enough away that proximity is not what
    // is being asserted.
    const r = computeVWAPAnalysis(session([100, 120, 130, 140, 90]), DEFAULT_CONFIG)
    expect(r.side).toBe('below')
    expect(Math.abs(r.distancePercent as number)).toBeGreaterThan(DEFAULT_CONFIG.vwapProximityPercent)
    expect(r.respectingVWAP).toBe(true)
  })

  it('does not count touching VWAP and leaving as a cross', () => {
    // Bar 0 of any session sits exactly on VWAP when its close equals its
    // typical price. Price then leaves and never returns: it was on the level,
    // not through it.
    const r = computeVWAPAnalysis(session([100, 140, 180, 220, 260]), DEFAULT_CONFIG)
    expect(r.respectingVWAP).toBe(false)
  })

  it('counts a cross that passes exactly through VWAP on an intermediate bar', () => {
    // (−, 0, +) is a traversal even though no adjacent pair is strictly
    // opposite, so a strict pairwise test would miss it.
    //
    // Prices are solved so bar 2 lands exactly on its own VWAP: with equal
    // volumes and close === typical price, VWAP_2 = mean(100, 80, 90) = 90 = p_2.
    const candles = session([100, 80, 90, 130])
    const vwaps = computeVwapSeries(candles).values

    // Pin the premise: without an exact zero this test proves nothing.
    expect(candles[1].close - (vwaps[1] as number)).toBeLessThan(0)
    expect(candles[2].close - (vwaps[2] as number)).toBe(0)
    expect(candles[3].close - (vwaps[3] as number)).toBeGreaterThan(0)

    const r = computeVWAPAnalysis(candles, DEFAULT_CONFIG)
    // 30% from VWAP, so proximity cannot be what makes this true.
    expect(Math.abs(r.distancePercent as number)).toBeGreaterThan(DEFAULT_CONFIG.vwapProximityPercent)
    expect(r.respectingVWAP).toBe(true)
  })

  it('compares each close against the VWAP of ITS OWN bar, not the latest VWAP', () => {
    // A monotone rise: the close is above the running session VWAP at every
    // bar after the first, so (close − VWAP) never changes sign and there is no
    // cross. The old implementation compared these closes against the FINAL
    // VWAP (~124), found bars 100 and 110 below it and bars 140/160 above it,
    // and reported a cross that never happened.
    const candles = session([100, 110, 120, 140, 160])
    const r = computeVWAPAnalysis(candles, DEFAULT_CONFIG)
    expect(r.side).toBe('above')
    expect(r.respectingVWAP).toBe(false)
  })

  it('does not infer a cross across a session boundary it cannot see', () => {
    // Bars from a partial previous session carry a null VWAP and are skipped
    // rather than compared against a value that was never determined.
    const prev = [110, 110].map((p, i) => bar(20 + i, p, 100, -1))
    const today = session([100, 100])
    const r = computeVWAPAnalysis([...prev, ...today], DEFAULT_CONFIG)
    expect(r.available).toBe(true)
    expect(r.respectingVWAP).toBe(true) // by proximity (price === VWAP), not by a phantom cross
  })
})

describe('computeVWAPAnalysis — unavailability', () => {
  const dailyBars: Candle[] = Array.from({ length: 30 }, (_, i) => ({
    openTime: i * DAY,
    closeTime: i * DAY + DAY - 1,
    open: 100, high: 105, low: 95, close: 100,
    volume: 100, quoteVolume: 10_000, trades: 1,
    takerBuyVolume: 50, takerSellVolume: 50,
  }))

  it('withholds everything at a daily bar duration', () => {
    const r = computeVWAPAnalysis(dailyBars, DEFAULT_CONFIG)
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('undefined-at-timeframe')
    expect(r.side).toBeNull()
    expect(r.value).toBeNull()
    expect(r.distancePercent).toBeNull()
    expect(r.respectingVWAP).toBeNull()
  })

  it('withholds rather than reporting "below" — the failure the redesign targets', () => {
    // Under the old shape this input produced `above: false`, which every
    // downstream if/else read as "price is below VWAP" and scored as bearish.
    const r = computeVWAPAnalysis(dailyBars, DEFAULT_CONFIG)
    expect(r.side).not.toBe('below')
  })

  it('withholds when the window begins mid-session', () => {
    const midSession = [6, 7, 8].map(i => bar(i, 100))
    const r = computeVWAPAnalysis(midSession, DEFAULT_CONFIG)
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('insufficient-history')
  })

  it('withholds when the session traded zero volume', () => {
    const r = computeVWAPAnalysis(session([100, 100, 100], 0), DEFAULT_CONFIG)
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('no-volume')
  })
})
