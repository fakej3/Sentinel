import { describe, it, expect } from 'vitest'
import {
  MIN_SCALING_WINDOW, createScalerState, pushValue, zscore, rankScale, applyScaling, RollingScaler,
} from '../scaling'

const CLOSE = 12

function warm(v: number, n = MIN_SCALING_WINDOW): ReturnType<typeof createScalerState> {
  let s = createScalerState(MIN_SCALING_WINDOW)
  for (let i = 0; i < n; i++) s = pushValue(s, v + i)
  return s
}

describe('scaler state', () => {
  it('rejects a window below the derived minimum', () => {
    expect(() => createScalerState(MIN_SCALING_WINDOW - 1)).toThrow(/windowSize must be an integer/)
    expect(() => createScalerState(30.5)).toThrow(/integer/)
  })

  it('drops the oldest value beyond the window', () => {
    let s = createScalerState(30)
    for (let i = 0; i < 100; i++) s = pushValue(s, i)
    expect(s.history.length).toBe(30)
    expect(s.history[0]).toBe(70)
    expect(s.history[29]).toBe(99)
  })

  it('does NOT append null — absence must not consume window budget', () => {
    let s = createScalerState(30)
    for (let i = 0; i < 10; i++) s = pushValue(s, i)
    const before = s.history.length
    s = pushValue(s, null)
    s = pushValue(s, NaN)
    s = pushValue(s, Infinity)
    expect(s.history.length).toBe(before)
  })
})

describe('zscore', () => {
  it('abstains until the window is warm', () => {
    let s = createScalerState(MIN_SCALING_WINDOW)
    for (let i = 0; i < MIN_SCALING_WINDOW - 1; i++) s = pushValue(s, i)
    expect(zscore(s, 5)).toBeNull()
    s = pushValue(s, 999)
    expect(zscore(s, 5)).not.toBeNull()
  })

  it('is the textbook value on a known window', () => {
    // History 0..29: mean 14.5, sample sd = sqrt(sum((i-14.5)^2)/29).
    let s = createScalerState(30)
    for (let i = 0; i < 30; i++) s = pushValue(s, i)
    const mean = 14.5
    let ss = 0
    for (let i = 0; i < 30; i++) ss += (i - mean) ** 2
    const sd = Math.sqrt(ss / 29)
    expect(zscore(s, 20)!).toBeCloseTo((20 - mean) / sd, CLOSE)
    expect(zscore(s, mean)!).toBeCloseTo(0, CLOSE)
  })

  it('scores the value against history EXCLUDING itself', () => {
    // If the current value were folded in first, a large outlier would shrink
    // its own deviation. It must not.
    const s = warm(0)
    const a = zscore(s, 1000)!
    const withSelf = pushValue(s, 1000)
    const b = zscore(withSelf, 1000)!
    expect(a).toBeGreaterThan(b)
  })

  it('is null, not zero, for a constant feature', () => {
    let s = createScalerState(30)
    for (let i = 0; i < 30; i++) s = pushValue(s, 7)
    expect(zscore(s, 7)).toBeNull()
    expect(zscore(s, 9)).toBeNull()
  })

  it('is invariant to an affine rescaling of the whole series', () => {
    let a = createScalerState(30), b = createScalerState(30)
    for (let i = 0; i < 30; i++) { a = pushValue(a, i); b = pushValue(b, 3 * i + 100) }
    expect(zscore(b, 3 * 20 + 100)!).toBeCloseTo(zscore(a, 20)!, CLOSE)
  })
})

describe('rankScale', () => {
  it('is bounded in [-0.5, 0.5]', () => {
    const s = warm(0)
    for (const v of [-1e9, -1, 0, 15, 29, 1e9]) {
      const r = rankScale(s, v)!
      expect(r).toBeGreaterThanOrEqual(-0.5)
      expect(r).toBeLessThanOrEqual(0.5)
    }
  })

  it('gives ties half credit', () => {
    let s = createScalerState(30)
    for (let i = 0; i < 30; i++) s = pushValue(s, 5)
    // All 30 equal: (0 + 0.5*30)/30 − 0.5 = 0
    expect(rankScale(s, 5)!).toBeCloseTo(0, CLOSE)
  })

  it('is monotone in the value', () => {
    const s = warm(0)
    let prev = -Infinity
    for (const v of [-5, 0, 7, 14, 21, 28, 40]) {
      const r = rankScale(s, v)!
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
  })

  it('is invariant to ANY monotone transform — the property z-score lacks', () => {
    let a = createScalerState(30), b = createScalerState(30)
    for (let i = 1; i <= 30; i++) { a = pushValue(a, i); b = pushValue(b, Math.exp(i / 5)) }
    expect(rankScale(b, Math.exp(20 / 5))!).toBeCloseTo(rankScale(a, 20)!, CLOSE)
  })

  it('resists an outlier that would dominate a z-score', () => {
    // The claim is STABILITY under contamination, not magnitude. Build the same
    // window with and without one extreme value and compare how far each
    // scaler moves a mid-distribution point.
    let clean = createScalerState(30)
    for (let i = 0; i < 29; i++) clean = pushValue(clean, i)
    clean = pushValue(clean, 29)
    let dirty = createScalerState(30)
    for (let i = 0; i < 29; i++) dirty = pushValue(dirty, i)
    dirty = pushValue(dirty, 1e6)

    const rankShift = Math.abs(rankScale(dirty, 15)! - rankScale(clean, 15)!)
    const zShift = Math.abs(zscore(dirty, 15)! - zscore(clean, 15)!)

    // The rank shift is EXACTLY zero, and that is a theorem rather than a
    // tolerance: replacing the largest element with a larger one changes
    // neither `below` nor `equal` for any value under it, so the midrank of 15
    // is untouched. Rank scaling is invariant to contamination above the point
    // being scaled.
    expect(rankShift).toBe(0)
    // The z-score moves because both mean and sd are functions of every
    // element. Measured here: 0.239 — more than four times the clean z-score
    // of 15 itself (0.057), i.e. the contamination dominates the signal.
    expect(zShift).toBeGreaterThan(4 * Math.abs(zscore(clean, 15)!))
  })
})

describe('applyScaling', () => {
  it('passes through unchanged for "none"', () => {
    expect(applyScaling('none', createScalerState(30), 0.42)).toBe(0.42)
  })
  it('propagates null for every method', () => {
    const s = warm(0)
    for (const m of ['zscore', 'rank', 'none'] as const) {
      expect(applyScaling(m, s, null)).toBeNull()
      expect(applyScaling(m, s, NaN)).toBeNull()
    }
  })
})

describe('RollingScaler — causality', () => {
  const specs = [
    { name: 'a', scaling: 'zscore' as const },
    { name: 'b', scaling: 'rank' as const },
    { name: 'c', scaling: 'none' as const },
  ]

  it('REFUSES out-of-order observations', () => {
    const s = new RollingScaler(specs, 30)
    s.scaleNext({ a: 1, b: 1, c: 1 }, 1000)
    s.scaleNext({ a: 2, b: 2, c: 2 }, 2000)
    expect(() => s.scaleNext({ a: 3, b: 3, c: 3 }, 1500))
      .toThrow(/must be chronological/)
  })

  it('a future value cannot change a past scaled output', () => {
    // The load-bearing property. Run the same prefix twice, once continuing
    // into wildly different future values; every output up to the split must
    // be identical.
    const build = (tail: number[]): (number | null)[] => {
      const s = new RollingScaler(specs, 30)
      const out: (number | null)[] = []
      for (let i = 0; i < 60; i++) out.push(s.scaleNext({ a: i, b: i, c: i }, i * 1000).a)
      for (let i = 0; i < tail.length; i++) out.push(s.scaleNext({ a: tail[i], b: tail[i], c: tail[i] }, (60 + i) * 1000).a)
      return out
    }
    const quiet = build([60, 61, 62, 63, 64])
    const wild = build([1e7, -1e7, 5e6, -5e6, 0])
    expect(quiet.slice(0, 60)).toEqual(wild.slice(0, 60))
  })

  it('abstains until warm, then emits', () => {
    const s = new RollingScaler(specs, 30)
    for (let i = 0; i < MIN_SCALING_WINDOW; i++) {
      const r = s.scaleNext({ a: i, b: i, c: i }, i * 1000)
      expect(r.a).toBeNull()
      expect(r.b).toBeNull()
      // 'none' scaling never abstains — it has no statistic to estimate.
      expect(r.c).toBe(i)
    }
    expect(s.warm).toBe(true)
    const r = s.scaleNext({ a: 99, b: 99, c: 99 }, 99_000)
    expect(r.a).not.toBeNull()
    expect(r.b).not.toBeNull()
  })

  it('a feature that is always null never warms, and does not block the others', () => {
    const s = new RollingScaler([...specs, { name: 'gone', scaling: 'zscore' as const }], 30)
    for (let i = 0; i < 80; i++) s.scaleNext({ a: i, b: i, c: i, gone: null }, i * 1000)
    expect(s.historySize('gone')).toBe(0)
    expect(s.historySize('a')).toBe(30)
    expect(s.warm).toBe(false)
    expect(s.scaleNext({ a: 1, b: 1, c: 1, gone: null }, 1e9).a).not.toBeNull()
  })

  it('a missing key is treated as null, not as zero', () => {
    const s = new RollingScaler(specs, 30)
    for (let i = 0; i < 40; i++) s.scaleNext({ a: i, b: i, c: i }, i * 1000)
    const before = s.historySize('a')
    const r = s.scaleNext({ b: 1, c: 1 }, 1e9)
    expect(r.a).toBeNull()
    expect(s.historySize('a')).toBe(before)
  })
})
