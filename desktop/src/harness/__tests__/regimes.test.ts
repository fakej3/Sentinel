/**
 * The regime generator, and the study built on it.
 *
 * A study is only as trustworthy as its data generator. These tests assert
 * that each regime actually has the statistical property it claims — a "range"
 * that does not mean-revert, or a "trend" whose drift is swamped by noise,
 * would make every conclusion drawn from it meaningless.
 */
import { describe, it, expect } from 'vitest'
import { syntheticRegimeSeries } from '../sources'
import { assertWellFormedSeries } from '../validate'
import { runSeries } from '../engine'
import { buildSpecs, regimeOf, REGIMES, TIMEFRAMES, STRIDE, HORIZONS } from '../scripts/synthetic-study'
import { mean, stdev } from '../metrics/stats'

const SIGMA = 0.01

function logReturns(closes: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]))
  return out
}

describe('syntheticRegimeSeries — well-formedness', () => {
  it.each([0.001, 0.01, 0.05, 0.2])('sigma = %s produces a valid series in both segment kinds', (sigma) => {
    const s = syntheticRegimeSeries({
      symbol: 'R', timeframe: '1h', seed: 3,
      segments: [
        { kind: 'drift', bars: 500, drift: 0.001, sigma },
        { kind: 'revert', bars: 500, theta: 0.03, sigma },
      ],
    })
    expect(() => assertWellFormedSeries(s)).not.toThrow()
    expect(s.candles.length).toBe(1000)
  })

  it('is continuous across a segment boundary — no artificial gap to detect', () => {
    const s = syntheticRegimeSeries({
      symbol: 'R', timeframe: '1h', seed: 4,
      segments: [
        { kind: 'drift', bars: 100, drift: 0.002, sigma: SIGMA },
        { kind: 'revert', bars: 100, theta: 0.03, sigma: SIGMA },
      ],
    })
    // Bar 100 is the first of the second segment; its open must be bar 99's close.
    expect(s.candles[100].open).toBe(s.candles[99].close)
    for (let i = 1; i < s.candles.length; i++) expect(s.candles[i].open).toBe(s.candles[i - 1].close)
  })

  it('is reproducible from its seed', () => {
    const spec = {
      symbol: 'R', timeframe: '1h' as const, seed: 9,
      segments: [{ kind: 'drift' as const, bars: 200, drift: 0, sigma: SIGMA }],
    }
    expect(JSON.stringify(syntheticRegimeSeries(spec))).toBe(JSON.stringify(syntheticRegimeSeries(spec)))
  })

  it('rejects a malformed segment rather than generating from it', () => {
    const base = { symbol: 'R', timeframe: '1h' as const, seed: 1 }
    expect(() => syntheticRegimeSeries({ ...base, segments: [{ kind: 'drift', bars: 0, drift: 0, sigma: SIGMA }] }))
      .toThrow(/bars must be a positive integer/)
    expect(() => syntheticRegimeSeries({ ...base, segments: [{ kind: 'revert', bars: 10, theta: 0, sigma: SIGMA }] }))
      .toThrow(/theta must be in \(0, 1\)/)
    expect(() => syntheticRegimeSeries({ ...base, segments: [{ kind: 'revert', bars: 10, theta: 1, sigma: SIGMA }] }))
      .toThrow(/theta must be in \(0, 1\)/)
  })
})

describe('drift segments actually trend', () => {
  it('mean log return matches the specified drift', () => {
    const drift = 0.0015
    const s = syntheticRegimeSeries({
      symbol: 'D', timeframe: '1h', seed: 21,
      segments: [{ kind: 'drift', bars: 6000, drift, sigma: SIGMA }],
    })
    const rs = logReturns(s.candles.map(c => c.close))
    const se = stdev(rs)! / Math.sqrt(rs.length)
    expect(Math.abs(mean(rs)! - drift)).toBeLessThan(4 * se)
  })

  it('a zero-drift segment has mean log return indistinguishable from zero', () => {
    const s = syntheticRegimeSeries({
      symbol: 'W', timeframe: '1h', seed: 22,
      segments: [{ kind: 'drift', bars: 6000, drift: 0, sigma: SIGMA }],
    })
    const rs = logReturns(s.candles.map(c => c.close))
    expect(Math.abs(mean(rs)!)).toBeLessThan(4 * stdev(rs)! / Math.sqrt(rs.length))
  })
})

describe('revert segments actually mean-revert', () => {
  /**
   * The defining property: successive log returns are NEGATIVELY
   * autocorrelated. A random walk has zero autocorrelation; mean reversion
   * produces a negative lag-1 coefficient of approximately −θ/2 for small θ.
   * Without this the "range" regime would just be a random walk under another
   * name, and every conclusion about it would be about the wrong process.
   */
  it('has negative lag-1 autocorrelation of returns, unlike a random walk', () => {
    const theta = 0.03
    const rev = syntheticRegimeSeries({
      symbol: 'V', timeframe: '1h', seed: 31,
      segments: [{ kind: 'revert', bars: 8000, theta, sigma: SIGMA }],
    })
    const walk = syntheticRegimeSeries({
      symbol: 'W', timeframe: '1h', seed: 31,
      segments: [{ kind: 'drift', bars: 8000, drift: 0, sigma: SIGMA }],
    })
    const acf1 = (closes: readonly number[]): number => {
      const rs = logReturns(closes)
      const m = mean(rs)!
      let num = 0, den = 0
      for (let i = 1; i < rs.length; i++) num += (rs[i] - m) * (rs[i - 1] - m)
      for (const r of rs) den += (r - m) ** 2
      return num / den
    }
    const aRev = acf1(rev.candles.map(c => c.close))
    const aWalk = acf1(walk.candles.map(c => c.close))
    // ~2 standard errors for n = 8000 is 0.022.
    expect(aRev).toBeLessThan(-0.005)
    expect(Math.abs(aWalk)).toBeLessThan(0.04)
    expect(aRev).toBeLessThan(aWalk)
  })

  it('stays bounded around its anchor instead of wandering off', () => {
    // A random walk's terminal displacement grows as sqrt(n); an OU process's
    // does not. Over 4000 bars the difference is unmistakable.
    const bars = 4000
    const rev = syntheticRegimeSeries({
      symbol: 'V', timeframe: '1h', seed: 41,
      segments: [{ kind: 'revert', bars, theta: 0.03, sigma: SIGMA }],
    })
    const walk = syntheticRegimeSeries({
      symbol: 'W', timeframe: '1h', seed: 41,
      segments: [{ kind: 'drift', bars, drift: 0, sigma: SIGMA }],
    })
    const spread = (s: typeof rev): number => {
      const logs = s.candles.map(c => Math.log(c.close))
      return Math.max(...logs) - Math.min(...logs)
    }
    // The OU stationary standard deviation is sigma/sqrt(2θ − θ²) ≈ 0.0412,
    // so its whole range should sit inside a few multiples of that.
    expect(spread(rev)).toBeLessThan(0.4)
    expect(spread(rev)).toBeLessThan(spread(walk))
  })
})

describe('the study corpus', () => {
  const specs = buildSpecs()

  it('covers every regime × timeframe cell', () => {
    expect(specs.length).toBe(REGIMES.length * TIMEFRAMES.length * 12)
    for (const r of REGIMES) for (const tf of TIMEFRAMES) {
      expect(specs.filter(s => regimeOf(s.symbol) === r && s.timeframe === tf).length).toBe(12)
    }
  })

  it('uses a distinct seed for every series, so cells are independent', () => {
    expect(new Set(specs.map(s => s.seed)).size).toBe(specs.length)
  })

  it('encodes the regime in the symbol so it survives export', () => {
    for (const s of specs) expect(() => regimeOf(s.symbol)).not.toThrow()
    expect(() => regimeOf('UNKNOWN01')).toThrow(/cannot infer regime/)
  })

  it('strides by the longest horizon, so forward windows do not overlap', () => {
    // The property that makes every standard error in the study honest.
    expect(STRIDE).toBe(Math.max(...HORIZONS))
    const s = syntheticRegimeSeries(specs[0])
    const obs = runSeries(s, { stride: STRIDE, horizons: HORIZONS }).observations
    for (let i = 1; i < obs.length; i++) {
      expect(obs[i].barIndex - obs[i - 1].barIndex).toBeGreaterThanOrEqual(Math.max(...HORIZONS))
    }
  })

  it('every generated series is well-formed and long enough to run', () => {
    for (const spec of specs.slice(0, 15)) {
      const s = syntheticRegimeSeries(spec)
      expect(() => assertWellFormedSeries(s)).not.toThrow()
      expect(runSeries(s, { stride: STRIDE, horizons: HORIZONS }).observations.length).toBeGreaterThan(15)
    }
  })
})
