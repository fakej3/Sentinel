/**
 * The generator must stay well-formed across the whole parameter range it
 * exposes, not just the range the other tests happen to use.
 *
 * The wick was originally applied linearly (`× (1 ± w)`), which drives `low`
 * to zero or below as soon as `w >= 1`. With `sigma = 0.5` that needs only
 * |z| > 2 — a one-in-forty bar. The generator would have produced impossible
 * candles precisely in the high-volatility regime a stress test reaches for,
 * and `assertWellFormedSeries` would have rejected its own source data.
 */
import { describe, it, expect } from 'vitest'
import { syntheticSeries } from '../sources'
import { assertWellFormedSeries } from '../validate'
import { runSeries } from '../engine'

const SIGMAS = [0.001, 0.01, 0.05, 0.2, 0.5, 1, 2]

describe('syntheticSeries stays well-formed across the sigma range', () => {
  it.each(SIGMAS)('sigma = %s produces a series the validator accepts', (sigma) => {
    const s = syntheticSeries({ symbol: 'V', timeframe: '1h', bars: 2000, seed: 31, sigma })
    expect(() => assertWellFormedSeries(s)).not.toThrow()
  })

  it.each(SIGMAS)('sigma = %s brackets open and close within high and low', (sigma) => {
    const s = syntheticSeries({ symbol: 'V', timeframe: '1h', bars: 2000, seed: 31, sigma })
    for (const c of s.candles) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close))
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close))
    }
  })

  it.each([-0.05, 0, 0.05])('drift = %s produces a runnable series', (drift) => {
    const s = syntheticSeries({ symbol: 'V', timeframe: '1h', bars: 400, seed: 5, drift, sigma: 0.02 })
    expect(runSeries(s, { lookbackBars: 60, horizons: [4] }).observations.length).toBeGreaterThan(300)
  })

  it('wicks are symmetric in log space, matching the multiplicative path', () => {
    // high/max(o,c) and min(o,c)/low are the same factor.
    const s = syntheticSeries({ symbol: 'V', timeframe: '1h', bars: 500, seed: 77, sigma: 0.3 })
    for (const c of s.candles) {
      const up = c.high / Math.max(c.open, c.close)
      const down = Math.min(c.open, c.close) / c.low
      expect(Math.abs(Math.log(up) - Math.log(down))).toBeLessThan(1e-12)
    }
  })

  it('every timeframe spaces bars by its own duration', () => {
    for (const [tf, ms] of [['15m', 900_000], ['4h', 14_400_000], ['1d', 86_400_000]] as const) {
      const s = syntheticSeries({ symbol: 'V', timeframe: tf, bars: 20, seed: 1 })
      for (let i = 1; i < s.candles.length; i++) {
        expect(s.candles[i].openTime - s.candles[i - 1].openTime).toBe(ms)
      }
    }
  })
})
