import { describe, it, expect } from 'vitest'
import { softClamp } from '../compute/saturation'
import { DEFAULT_CONFIDENCE_CONFIG as CFG } from '../config'

const KNEE = CFG.gradeThresholds.veryStrong

describe('softClamp — algebraic properties', () => {
  it('is the identity below the knee', () => {
    for (const x of [0, 0.01, 1, 3, 5, 7, 8.49, KNEE]) {
      expect(softClamp(x, KNEE)).toBeCloseTo(x, 12)
    }
  })

  it('is continuous at the knee', () => {
    const left = softClamp(KNEE - 1e-9, KNEE)
    const right = softClamp(KNEE + 1e-9, KNEE)
    expect(Math.abs(right - left)).toBeLessThan(1e-6)
  })

  it('is C¹ at the knee — the slope is 1 on both sides, so there is no kink', () => {
    const h = 1e-6
    const slopeLeft = (softClamp(KNEE, KNEE) - softClamp(KNEE - h, KNEE)) / h
    const slopeRight = (softClamp(KNEE + h, KNEE) - softClamp(KNEE, KNEE)) / h
    expect(slopeLeft).toBeCloseTo(1, 4)
    expect(slopeRight).toBeCloseTo(1, 4)
  })

  // REACHABLE_MAX: the 34 positive factor weights sum to 260, and the divisor
  // is 10, so 26.0 is the largest score the engine can produce. Monotonicity is
  // asserted over this domain rather than an unbounded one — see the float64
  // caveat in saturation.ts.
  const REACHABLE_MAX = 26

  it('is strictly increasing across the reachable domain — what the hard clamp lost', () => {
    // Integer stepping so the loop variable carries no accumulated float error.
    let prev = -Infinity
    for (let i = 0; i <= REACHABLE_MAX * 100; i++) {
      const y = softClamp(i / 100, KNEE)
      expect(y).toBeGreaterThan(prev)
      prev = y
    }
  })

  it('is injective across the reachable domain', () => {
    const seen = new Set<number>()
    let n = 0
    for (let i = 1; i <= REACHABLE_MAX * 100; i++, n++) seen.add(softClamp(i / 100, KNEE))
    expect(seen.size).toBe(n)
  })

  it('stays strictly below 10 for every reachable score', () => {
    for (const x of [10, 15, 20, REACHABLE_MAX]) {
      expect(softClamp(x, KNEE)).toBeLessThan(10)
      expect(softClamp(x, KNEE)).toBeGreaterThan(KNEE)
    }
  })

  it('documents the float64 limit rather than pretending it does not exist', () => {
    // Beyond ~59.5 the exponential term falls under the ulp of 10 and the
    // subtraction rounds to exactly 10. Unreachable for this weight table, but
    // asserted so the boundary is visible if the weights ever grow.
    expect(softClamp(REACHABLE_MAX, KNEE)).toBeLessThan(10)
    expect(softClamp(80, KNEE)).toBe(10)
  })

  it('maps 0 to 0 — absence of evidence must never read as confidence', () => {
    expect(softClamp(0, KNEE)).toBe(0)
    expect(softClamp(-5, KNEE)).toBe(0)
  })

  it('matches the closed form 10 − (10−K)·exp(−(x−K)/(10−K))', () => {
    const headroom = 10 - KNEE
    for (const x of [9, 10, 12, 15, 20]) {
      expect(softClamp(x, KNEE))
        .toBeCloseTo(10 - headroom * Math.exp(-(x - KNEE) / headroom), 12)
    }
  })
})

describe('softClamp — grade preservation', () => {
  // The property that made K = veryStrong the derived choice: the transform
  // must not move any input across any grade boundary.
  const thresholds = Object.values(CFG.gradeThresholds)

  it('leaves every grade threshold on the same side for every input', () => {
    for (let i = 0; i <= 6000; i++) {
      const x = i / 200
      const y = softClamp(x, KNEE)
      for (const t of thresholds) {
        expect(y >= t).toBe(x >= t)
      }
    }
  })

  it('keeps the whole compressed region inside the veryStrong band', () => {
    for (const x of [8.6, 10, 13, 26]) {
      expect(softClamp(x, KNEE)).toBeGreaterThanOrEqual(CFG.gradeThresholds.veryStrong)
    }
  })
})

describe('softClamp — resolution restored where it was lost', () => {
  it('separates the pre-clamp range that used to collapse onto 10.0', () => {
    // Measured p75..max of the pre-clamp distribution.
    const scores = [10.0, 10.75, 12.0, 12.9, 15.05].map(x => softClamp(x, KNEE))
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1])
    }
    // Still distinguishable at the two decimals the UI renders.
    const rounded = scores.map(s => s.toFixed(2))
    expect(new Set(rounded).size).toBe(scores.length)
  })

  it('spreads the saturating mass across a usable band rather than a point', () => {
    expect(softClamp(10, KNEE)).toBeCloseTo(9.448, 3)
    expect(softClamp(15, KNEE)).toBeCloseTo(9.980, 3)
  })
})

describe('softClamp — robustness', () => {
  it('floors non-finite input instead of propagating it into every comparison', () => {
    expect(softClamp(NaN, KNEE)).toBe(0)
    expect(softClamp(-Infinity, KNEE)).toBe(0)
  })

  it('maps +Infinity to the function limit, keeping the map monotone', () => {
    expect(softClamp(Infinity, KNEE)).toBe(10)
  })

  it('falls back to a hard clamp for a degenerate knee rather than inverting', () => {
    for (const badKnee of [0, 10, -1, 11, NaN]) {
      expect(softClamp(12, badKnee)).toBe(10)
      expect(softClamp(4, badKnee)).toBe(4)
    }
  })

  it('is deterministic', () => {
    for (const x of [3, 8.5, 12.34]) {
      expect(softClamp(x, KNEE)).toBe(softClamp(x, KNEE))
    }
  })
})
