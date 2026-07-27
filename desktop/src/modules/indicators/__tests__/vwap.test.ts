import { describe, it, expect } from 'vitest'
import { computeVwap, computeVwapSeries } from '../compute/vwap'
import type { Candle } from '../../market/types'

const HOUR = 3_600_000
const DAY = 86_400_000

/** Candle with an explicit UTC open and an exact `duration`-long bar. */
function bar(openTime: number, duration: number, price: number, volume = 100): Candle {
  return {
    openTime,
    closeTime: openTime + duration - 1,
    open: price, high: price, low: price, close: price,
    volume,
    quoteVolume: price * volume,
    trades: 1,
    takerBuyVolume: volume / 2,
    takerSellVolume: volume / 2,
  }
}

/** `count` bars of `duration`, starting at `start`, priced by `priceAt`. */
function series(start: number, duration: number, count: number,
  priceAt: (i: number) => number, volumeAt: (i: number) => number = () => 100): Candle[] {
  return Array.from({ length: count }, (_, i) => bar(start + i * duration, duration, priceAt(i), volumeAt(i)))
}

describe('computeVwap — session anchoring', () => {
  it('averages only the bars in the current UTC session', () => {
    // Yesterday at price 100, today at price 200. A whole-window average would
    // land near 150; a session VWAP must report exactly 200.
    const yesterday = series(0, HOUR, 24, () => 100)
    const today = series(DAY, HOUR, 6, () => 200)
    const r = computeVwap([...yesterday, ...today])
    expect(r.available).toBe(true)
    expect(r.value).toBeCloseTo(200, 6)
  })

  it('anchors at 00:00 UTC of the last bar', () => {
    const candles = series(DAY * 5, HOUR, 3, () => 100)
    expect(computeVwap(candles).anchorTime).toBe(DAY * 5)
  })

  it('resets at the session boundary rather than carrying volume across', () => {
    const yesterday = series(0, HOUR, 24, () => 100, () => 1_000_000)
    const today = series(DAY, HOUR, 1, () => 50)
    // Yesterday's volume is four orders of magnitude larger. If it leaked into
    // today's accumulation the result would be ~100, not 50.
    expect(computeVwap([...yesterday, ...today]).value).toBeCloseTo(50, 6)
  })

  it('weights by volume within the session', () => {
    // TP 100 × 10 units, TP 200 × 990 units → 199.0
    const candles = [bar(DAY, HOUR, 100, 10), bar(DAY + HOUR, HOUR, 200, 990)]
    expect(computeVwap(candles).value).toBeCloseTo((100 * 10 + 200 * 990) / 1000, 6)
  })

  it('uses the typical price (H+L+C)/3, not the close', () => {
    const c: Candle = { ...bar(DAY, HOUR, 0), high: 12, low: 10, close: 11 }
    expect(computeVwap([c]).value).toBeCloseTo(11, 6)
  })
})

describe('computeVwap — window independence', () => {
  it('is unchanged by how much history precedes the current session', () => {
    // This is the defect the redesign exists to fix: the old whole-window VWAP
    // returned a different number for every fetch depth.
    const today = series(DAY * 10, HOUR, 5, i => 100 + i)
    const short = computeVwap([...series(DAY * 9 + HOUR * 20, HOUR, 4, () => 500), ...today])
    const long = computeVwap([...series(DAY * 3, HOUR, 24 * 7, () => 500), ...today])
    expect(short.value).toBeCloseTo(long.value as number, 10)
  })

  it('is prefix-stable: values for bars 0..m do not change as later bars arrive', () => {
    const full = series(DAY, HOUR, 12, i => 100 + i * 3)
    const fullSeries = computeVwapSeries(full).values
    for (let m = 1; m <= full.length; m++) {
      const prefix = computeVwapSeries(full.slice(0, m)).values
      expect(prefix).toEqual(fullSeries.slice(0, m))
    }
  })
})

describe('computeVwap — unavailability', () => {
  it('is undefined at a 1D bar duration', () => {
    const r = computeVwap(series(0, DAY, 30, i => 100 + i))
    expect(r.available).toBe(false)
    expect(r.value).toBeNull()
    expect(r.unavailable?.code).toBe('undefined-at-timeframe')
  })

  it('is undefined at bar durations above 1D (3D, 1W)', () => {
    for (const duration of [DAY * 3, DAY * 7]) {
      expect(computeVwap(series(0, duration, 20, () => 100)).unavailable?.code)
        .toBe('undefined-at-timeframe')
    }
  })

  it('remains available at 12h — the largest sub-daily interval', () => {
    const r = computeVwap(series(0, DAY / 2, 10, () => 100))
    expect(r.available).toBe(true)
  })

  it('reports insufficient-history when the window starts mid-session', () => {
    // Window begins at 06:00 UTC, so the 00:00–06:00 volume is missing and the
    // session accumulation cannot be completed honestly.
    const r = computeVwap(series(DAY + 6 * HOUR, HOUR, 4, () => 100))
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('insufficient-history')
  })

  it('reports no-volume when the session traded nothing', () => {
    const r = computeVwap(series(DAY, HOUR, 4, () => 100, () => 0))
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('no-volume')
  })

  it('reports insufficient-history for an empty candle array', () => {
    const r = computeVwap([])
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('insufficient-history')
  })

  it('never returns a value alongside a reason, or a reason alongside a value', () => {
    const cases: Candle[][] = [
      [], series(0, DAY, 5, () => 100), series(DAY, HOUR, 5, () => 100),
      series(DAY + 6 * HOUR, HOUR, 4, () => 100), series(DAY, HOUR, 4, () => 100, () => 0),
    ]
    for (const candles of cases) {
      const r = computeVwap(candles)
      expect(r.available).toBe(r.value !== null)
      expect(r.available).toBe(r.unavailable === null)
      expect(r.available).toBe(r.anchorTime !== null)
    }
  })

  it('never fabricates a bullish reading — the old code returned 0, making every price "above"', () => {
    for (const candles of [[], series(0, DAY, 5, () => 100)]) {
      expect(computeVwap(candles).value).not.toBe(0)
    }
  })
})

describe('computeVwapSeries', () => {
  it('holds the invariant that the last value is non-null iff available', () => {
    const cases: Candle[][] = [
      series(DAY, HOUR, 5, () => 100),
      series(DAY + 6 * HOUR, HOUR, 4, () => 100),
      series(0, DAY, 5, () => 100),
    ]
    for (const candles of cases) {
      const s = computeVwapSeries(candles)
      const last = s.values[s.values.length - 1] ?? null
      expect(last !== null).toBe(s.unavailable === null)
    }
  })

  it('agrees with computeVwap on the last bar', () => {
    const candles = series(DAY, HOUR, 9, i => 100 + i * 2, i => 10 + i)
    const s = computeVwapSeries(candles)
    expect(computeVwap(candles).value).toBe(s.values[s.values.length - 1])
  })

  it('nulls the leading partial session but resolves every later one', () => {
    // Starts at 20:00 UTC: the first four bars belong to a session whose
    // opening bars are outside the window.
    const candles = [
      ...series(DAY - 4 * HOUR, HOUR, 4, () => 100),
      ...series(DAY, HOUR, 3, () => 200),
    ]
    const s = computeVwapSeries(candles)
    expect(s.values.slice(0, 4)).toEqual([null, null, null, null])
    expect(s.values.slice(4).every(v => v !== null)).toBe(true)
    expect(s.values[6]).toBeCloseTo(200, 6)
  })

  it('nulls a session whose opening bar is missing from the data', () => {
    // A gap swallows 00:00; the first bar we hold for the day opens at 02:00,
    // two bar-durations in, so the day's accumulation is incomplete.
    const candles = [
      ...series(0, HOUR, 24, () => 100),
      ...series(DAY + 2 * HOUR, HOUR, 3, () => 200),
    ]
    const s = computeVwapSeries(candles)
    expect(s.values.slice(24)).toEqual([null, null, null])
    expect(s.unavailable?.code).toBe('insufficient-history')
  })

  it('withholds when candles are missing from the MIDDLE of the session', () => {
    // REGRESSION (A4). The session's 00:00 opening bar is present, then ten
    // hours are missing. The previous implementation checked only the opening
    // bar, so it published a "complete" session VWAP built from 2 bars out of
    // 11. A volume-weighted mean is not robust to missing weight: the result
    // was not noisy, it was wrong, and it was marked available.
    const candles = [
      bar(DAY * 20, HOUR, 100),
      bar(DAY * 20 + 10 * HOUR, HOUR, 200),
      bar(DAY * 20 + 11 * HOUR, HOUR, 200),
    ]
    const r = computeVwap(candles)
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('insufficient-history')
    expect(r.unavailable?.detail).toMatch(/missing from the middle/)
  })

  it('distinguishes a mid-session gap from a mid-session window start', () => {
    const windowStart = computeVwap(series(DAY * 20 + 6 * HOUR, HOUR, 4, () => 100))
    expect(windowStart.unavailable?.detail).toMatch(/began before the first available candle/)
  })

  it('does not treat a whole missing SESSION as a gap in the next one', () => {
    // Day 20 present, day 21 entirely absent, day 22 intact from its anchor.
    // Day 22's own accumulation is complete and must be published.
    const candles = [
      ...series(DAY * 20, HOUR, 24, () => 100),
      ...series(DAY * 22, HOUR, 5, () => 200),
    ]
    const r = computeVwap(candles)
    expect(r.available).toBe(true)
    expect(r.anchorTime).toBe(DAY * 22)
    expect(r.value).toBeCloseTo(200, 6)
  })

  it('keeps a session incomplete for the remainder once a gap is seen', () => {
    // The missing volume can never be recovered, so every later bar in that
    // session is understated and must stay null.
    const candles = [
      bar(DAY * 20, HOUR, 100),
      bar(DAY * 20 + 5 * HOUR, HOUR, 200),
      bar(DAY * 20 + 6 * HOUR, HOUR, 200),
      bar(DAY * 20 + 7 * HOUR, HOUR, 200),
    ]
    const s = computeVwapSeries(candles)
    expect(s.values).toEqual([100, null, null, null])
  })

  it('places the gap boundary strictly between 1x and 2x the bar duration', () => {
    // Exactly 1x spacing is normal succession; exactly 2x is one missing bar.
    // Those are the only two values well-formed data can produce, so the
    // classifier must separate them and nothing else.
    const consecutive = [bar(DAY * 20, HOUR, 100), bar(DAY * 20 + HOUR, HOUR, 100)]
    expect(computeVwap(consecutive).available).toBe(true)

    const oneMissing = [bar(DAY * 20, HOUR, 100), bar(DAY * 20 + 2 * HOUR, HOUR, 100)]
    expect(computeVwap(oneMissing).available).toBe(false)
    expect(computeVwap(oneMissing).unavailable?.detail).toMatch(/missing from the middle/)
  })

  it('is deterministic', () => {
    const candles = series(DAY, HOUR, 20, i => 100 + Math.sin(i) * 5, i => 50 + i)
    expect(computeVwapSeries(candles)).toEqual(computeVwapSeries(candles))
  })

  it('bounds every value within the session price range', () => {
    // A volume-weighted mean of typical prices cannot escape [min TP, max TP].
    const candles = series(DAY, HOUR, 12, i => 100 + i * 7, i => 1 + i * 13)
    const tps = candles.map(c => (c.high + c.low + c.close) / 3)
    for (const v of computeVwapSeries(candles).values) {
      expect(v).not.toBeNull()
      expect(v as number).toBeGreaterThanOrEqual(Math.min(...tps) - 1e-9)
      expect(v as number).toBeLessThanOrEqual(Math.max(...tps) + 1e-9)
    }
  })
})

describe('bar-duration inference', () => {
  it('derives the interval from closeTime − openTime + 1 (Binance inclusive close)', () => {
    // A single 1D candle in Binance form must be recognised as daily even
    // though there is no neighbouring bar to difference against.
    const daily = [bar(DAY * 3, DAY, 100)]
    expect(computeVwap(daily).unavailable?.code).toBe('undefined-at-timeframe')
  })

  it('falls back to the spacing between opens when closeTime is unusable', () => {
    const candles = series(0, DAY, 3, () => 100).map(c => ({ ...c, closeTime: 0 }))
    expect(computeVwap(candles).unavailable?.code).toBe('undefined-at-timeframe')
  })

  it('infers duration from the MINIMUM open spacing, so a trailing gap cannot skew it', () => {
    // SELF-REVIEW FIX. The fallback used to measure only the final pair of
    // opens. With an unusable closeTime and a gap immediately before the last
    // bar, that inferred 2x the true duration — and therefore depended on
    // where the window happened to end, breaking prefix stability on the
    // fallback path. The minimum spacing is gap-immune: gaps only ever make a
    // spacing larger.
    const raw = series(DAY * 20, HOUR, 6, () => 100).map(c => ({ ...c, closeTime: 0 }))
    const withTrailingGap = [...raw.slice(0, 5), { ...raw[5], openTime: raw[5].openTime + HOUR }]
    // True duration is 1h. A final-pair estimator would read 2h here.
    const s = computeVwapSeries(withTrailingGap)
    expect(s.unavailable?.code).toBe('insufficient-history')
    expect(s.unavailable?.detail).toMatch(/missing from the middle/)
  })

  it('reports malformed-input when timestamps describe no positive duration', () => {
    const broken = [{ ...bar(0, HOUR, 100), openTime: NaN, closeTime: NaN }]
    const r = computeVwap(broken)
    expect(r.available).toBe(false)
    expect(r.unavailable?.code).toBe('malformed-input')
  })
})
