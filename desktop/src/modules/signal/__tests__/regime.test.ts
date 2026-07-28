import { describe, it, expect } from 'vitest'
import {
  varianceRatio, returnAutocorrelation, volatilityRatio, estimateRegime,
  varianceRatioStdError, MIN_REGIME_BARS, VR_LAG,
} from '../regime'
import type { Candle } from '../../market/types'

const HOUR = 3_600_000

/** Deterministic LCG + Box–Muller, so every generated process is reproducible. */
function gauss(seed: number): () => number {
  let s = seed >>> 0
  const u = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  let spare: number | null = null
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v }
    let a = 0, b = 0, q = 0
    do { a = u() * 2 - 1; b = u() * 2 - 1; q = a * a + b * b } while (q === 0 || q >= 1)
    const f = Math.sqrt(-2 * Math.log(q) / q)
    spare = b * f
    return a * f
  }
}

/** Builds candles from a log-return path. Only closes matter to these statistics. */
function fromReturns(rs: readonly number[], start = 100): Candle[] {
  let p = start
  const out: Candle[] = []
  for (let i = 0; i < rs.length; i++) {
    const open = p
    p = p * Math.exp(rs[i])
    out.push({
      openTime: i * HOUR, closeTime: i * HOUR + HOUR - 1,
      open, high: Math.max(open, p) * 1.001, low: Math.min(open, p) * 0.999, close: p,
      volume: 1000, quoteVolume: p * 1000, trades: 10, takerBuyVolume: 500, takerSellVolume: 500,
    })
  }
  return out
}

function walk(n: number, seed: number, sigma = 0.01): Candle[] {
  const z = gauss(seed)
  return fromReturns(Array.from({ length: n }, () => sigma * z()))
}

/** AR(1) log returns with stationary sd fixed at sigma regardless of phi. */
function ar1(n: number, phi: number, seed: number, sigma = 0.01): Candle[] {
  const z = gauss(seed)
  const rs: number[] = []
  let prev = 0
  for (let i = 0; i < n; i++) {
    prev = phi * prev + sigma * Math.sqrt(1 - phi * phi) * z()
    rs.push(prev)
  }
  return fromReturns(rs)
}

describe('varianceRatio', () => {
  it('is ~1 for a random walk', () => {
    // Averaged over seeds: a single VR estimate is noisy by construction, and
    // asserting a tight bound on one path would be asserting a lucky seed.
    const vrs = [1, 2, 3, 4, 5, 6, 7, 8].map(s => varianceRatio(walk(2000, s))!)
    const mean = vrs.reduce((a, b) => a + b, 0) / vrs.length
    expect(mean).toBeGreaterThan(0.9)
    expect(mean).toBeLessThan(1.1)
  })

  it('is > 1 when returns persist, and rises with phi', () => {
    const at = (phi: number): number => {
      const vs = [11, 12, 13, 14, 15, 16].map(s => varianceRatio(ar1(2000, phi, s))!)
      return vs.reduce((a, b) => a + b, 0) / vs.length
    }
    const v0 = at(0), v3 = at(0.3), v6 = at(0.6)
    expect(v3).toBeGreaterThan(v0)
    expect(v6).toBeGreaterThan(v3)
    expect(v6).toBeGreaterThan(1.5)
  })

  it('is < 1 when returns revert', () => {
    const vs = [21, 22, 23, 24, 25, 26].map(s => varianceRatio(ar1(2000, -0.4, s))!)
    expect(vs.reduce((a, b) => a + b, 0) / vs.length).toBeLessThan(0.8)
  })

  it('abstains below the derived minimum sample', () => {
    expect(varianceRatio(walk(MIN_REGIME_BARS - 2, 1))).toBeNull()
    expect(varianceRatio(walk(MIN_REGIME_BARS + 10, 1))).not.toBeNull()
  })

  it('is invariant to a price rescaling — it is a return statistic', () => {
    const a = walk(600, 31)
    const b = a.map(c => ({ ...c, open: c.open * 1000, high: c.high * 1000, low: c.low * 1000, close: c.close * 1000 }))
    expect(varianceRatio(b)!).toBeCloseTo(varianceRatio(a)!, 9)
  })

  it('rejects a nonsensical lag rather than computing on it', () => {
    expect(() => varianceRatio(walk(600, 1), 1)).toThrow(/q must be an integer >= 2/)
    expect(() => varianceRatio(walk(600, 1), 2.5)).toThrow(/integer/)
  })

  it('is null when price is degenerate', () => {
    const flat = fromReturns(Array.from({ length: 600 }, () => 0))
    expect(varianceRatio(flat)).toBeNull()
  })
})

describe('returnAutocorrelation', () => {
  it('recovers phi on an AR(1) process', () => {
    for (const phi of [-0.4, -0.2, 0, 0.2, 0.4, 0.6]) {
      const acs = [41, 42, 43, 44, 45, 46].map(s => returnAutocorrelation(ar1(4000, phi, s))!)
      const mean = acs.reduce((a, b) => a + b, 0) / acs.length
      // 2 standard errors at n = 4000 is 0.032; allow 0.05 for the mean of six.
      expect(Math.abs(mean - phi)).toBeLessThan(0.05)
    }
  })

  it('is ~0 for a random walk', () => {
    const acs = [51, 52, 53, 54, 55, 56].map(s => returnAutocorrelation(walk(4000, s))!)
    expect(Math.abs(acs.reduce((a, b) => a + b, 0) / acs.length)).toBeLessThan(0.03)
  })

  it('abstains below the minimum sample', () => {
    expect(returnAutocorrelation(walk(MIN_REGIME_BARS - 2, 1))).toBeNull()
  })

  it('rejects a bad lag', () => {
    expect(() => returnAutocorrelation(walk(600, 1), 0)).toThrow(/lag must be >= 1/)
  })
})

describe('volatilityRatio', () => {
  it('is ~1 for a homoscedastic walk', () => {
    const vs = [61, 62, 63, 64, 65, 66].map(s => volatilityRatio(walk(1000, s))!)
    const m = vs.reduce((a, b) => a + b, 0) / vs.length
    expect(m).toBeGreaterThan(0.8)
    expect(m).toBeLessThan(1.2)
  })

  // The expected ratio is DERIVED from the construction, not guessed. With
  // VOL_SHORT = 20 and VOL_LONG = 100, the long window spans 80 calm bars and
  // 20 loud ones, so
  //     E[ratio] = sigma_short / sqrt((80*sigma_calm^2 + 20*sigma_loud^2)/100)
  const expectedRatio = (sigmaShort: number, calm: number, loud: number): number =>
    sigmaShort / Math.sqrt((80 * calm * calm + 20 * loud * loud) / 100)

  it('rises when recent volatility expands, to the derived magnitude', () => {
    const z = gauss(71)
    const calm = Array.from({ length: 200 }, () => 0.005 * z())
    const loud = Array.from({ length: 20 }, () => 0.05 * z())
    const expected = expectedRatio(0.05, 0.005, 0.05)   // = 2.193
    const got = volatilityRatio(fromReturns([...calm, ...loud]))!
    expect(got).toBeGreaterThan(1)
    // 20% tolerance: the realised sd of a 20-sample window has ~16% relative
    // standard error, so a tighter bound would be asserting the seed.
    expect(Math.abs(got - expected) / expected).toBeLessThan(0.2)
  })

  it('falls when recent volatility contracts, to the derived magnitude', () => {
    const z = gauss(81)
    const loud = Array.from({ length: 200 }, () => 0.05 * z())
    const calm = Array.from({ length: 20 }, () => 0.005 * z())
    const expected = expectedRatio(0.005, 0.05, 0.005)  // = 0.112
    const got = volatilityRatio(fromReturns([...loud, ...calm]))!
    expect(got).toBeLessThan(1)
    expect(Math.abs(got - expected) / expected).toBeLessThan(0.2)
  })

  it('rejects an inverted window pair', () => {
    expect(() => volatilityRatio(walk(600, 1), 100, 20)).toThrow(/short \(100\) must be < long/)
  })

  it('abstains when the long window does not fit', () => {
    expect(volatilityRatio(walk(50, 1))).toBeNull()
  })
})

describe('estimateRegime', () => {
  it('reports every field independently, with its sample size', () => {
    const r = estimateRegime(walk(1000, 91))
    expect(r.varianceRatio).not.toBeNull()
    expect(r.returnAutocorr).not.toBeNull()
    expect(r.volatilityRatio).not.toBeNull()
    expect(r.sampleSize).toBe(999)
  })

  it('degrades field by field on a short window rather than throwing', () => {
    const r = estimateRegime(walk(60, 92))
    expect(r.varianceRatio).toBeNull()
    expect(r.returnAutocorr).toBeNull()
    expect(r.volatilityRatio).toBeNull()
    expect(r.sampleSize).toBe(59)
  })

  it('handles an empty window', () => {
    const r = estimateRegime([])
    expect(r.sampleSize).toBe(0)
    expect(r.varianceRatio).toBeNull()
  })

  it('separates a momentum regime from a walk — the discrimination the engine lacks', () => {
    // Phase 4 measured that the engine cannot distinguish these at any phi.
    // These three statistics do, which is the whole reason the module exists.
    const momVR = [101, 102, 103, 104].map(s => estimateRegime(ar1(2000, 0.4, s)).varianceRatio!)
    const walkVR = [101, 102, 103, 104].map(s => estimateRegime(walk(2000, s)).varianceRatio!)
    const mMom = momVR.reduce((a, b) => a + b, 0) / 4
    const mWalk = walkVR.reduce((a, b) => a + b, 0) / 4
    expect(mMom).toBeGreaterThan(mWalk + 0.5)
  })
})

describe('varianceRatioStdError', () => {
  it('matches the Lo-MacKinlay closed form', () => {
    const n = 1000, q = VR_LAG
    expect(varianceRatioStdError(n, q)!)
      .toBeCloseTo(Math.sqrt((2 * (2 * q - 1) * (q - 1)) / (3 * q * n)), 12)
  })

  it('shrinks as sqrt(n)', () => {
    const a = varianceRatioStdError(1000)!
    const b = varianceRatioStdError(4000)!
    expect(b).toBeCloseTo(a / 2, 6)
  })

  it('is null below the minimum sample', () => {
    expect(varianceRatioStdError(MIN_REGIME_BARS - 1)).toBeNull()
  })

  it('brackets the observed spread of walk VR estimates', () => {
    // The SE is only useful if it is honest. Measured VR on 20 random walks
    // should mostly sit within 2 SE of 1.
    const n = 999
    const se = varianceRatioStdError(n)!
    const vrs = Array.from({ length: 20 }, (_, i) => varianceRatio(walk(1000, 200 + i))!)
    const within = vrs.filter(v => Math.abs(v - 1) < 2 * se).length
    expect(within).toBeGreaterThanOrEqual(15)
  })
})
