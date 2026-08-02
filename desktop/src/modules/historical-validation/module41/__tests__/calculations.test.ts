/**
 * Deterministic unit tests for the pure-math helper functions in module41/run.ts.
 *
 * Every expected value is derived by hand-arithmetic. No test asserts
 * "whatever the code returns" — that would validate nothing.
 *
 * Sign convention throughout: losses carry R = −1.0 exactly (consistent with
 * simulateOutcome) so grossLoss = losses × 1 and the formula
 *   profitFactor = (wins × avgWinRR) / losses
 * is identical to the general grossProfit / grossLoss.
 */
import { describe, it, expect } from 'vitest'
import { expectancy, profitFactor } from '../run'

const CLOSE = 12

// ── expectancy ────────────────────────────────────────────────────────────────

describe('expectancy — hand-computed values', () => {
  it('50% win rate, avgRR 2.0 → E = 0.5×2.0 − 0.5×1.0 = 0.5', () => {
    // wr = 1/2, lossRate = 1/2
    // E = 0.5 × 2.0 − 0.5 × 1.0 = 1.0 − 0.5 = 0.5
    expect(expectancy(1, 1, 2.0)).toBeCloseTo(0.5, CLOSE)
  })

  it('3 wins, 1 loss, avgRR 3.0 → E = 0.75×3.0 − 0.25×1.0 = 2.0', () => {
    // wr = 3/4 = 0.75, lossRate = 0.25
    // E = 0.75 × 3.0 − 0.25 × 1.0 = 2.25 − 0.25 = 2.0
    expect(expectancy(3, 1, 3.0)).toBeCloseTo(2.0, CLOSE)
  })

  it('1 win, 3 losses, avgRR 2.5 → E = 0.25×2.5 − 0.75×1.0 = −0.125', () => {
    // wr = 0.25, lossRate = 0.75
    // E = 0.25 × 2.5 − 0.75 = 0.625 − 0.75 = −0.125
    expect(expectancy(1, 3, 2.5)).toBeCloseTo(-0.125, CLOSE)
  })

  it('break-even: wr = 1/3, avgRR 2.0 → E = (1/3)×2 − (2/3) = 0', () => {
    // E = 2/3 − 2/3 = 0
    expect(expectancy(1, 2, 2.0)).toBeCloseTo(0, CLOSE)
  })

  it('all wins (losses = 0), avgRR 2.0 → E = 2.0', () => {
    // wr = 1, lossRate = 0 → E = 1 × 2.0 − 0 × 1.0 = 2.0
    expect(expectancy(5, 0, 2.0)).toBeCloseTo(2.0, CLOSE)
  })

  it('all losses (wins = 0), avgRR = null → null (no R:R data)', () => {
    expect(expectancy(0, 5, null)).toBeNull()
  })

  it('no trades at all (wins = 0, losses = 0) → null', () => {
    expect(expectancy(0, 0, 2.0)).toBeNull()
    expect(expectancy(0, 0, null)).toBeNull()
  })

  it('avgRR = null → null even when there are wins and losses', () => {
    expect(expectancy(3, 2, null)).toBeNull()
  })
})

// ── profitFactor ──────────────────────────────────────────────────────────────

describe('profitFactor — hand-computed values', () => {
  it('2 wins at RR 2.0, 1 loss → (2×2.0)/1 = 4.0', () => {
    // grossProfit = 2 × 2.0 = 4.0 ; grossLoss = 1 × 1.0 = 1.0
    expect(profitFactor(2, 1, 2.0)).toBeCloseTo(4.0, CLOSE)
  })

  it('1 win at RR 1.5, 2 losses → (1×1.5)/2 = 0.75', () => {
    // grossProfit = 1.5 ; grossLoss = 2.0
    expect(profitFactor(1, 2, 1.5)).toBeCloseTo(0.75, CLOSE)
  })

  it('4 wins at RR 2.5, 4 losses → (4×2.5)/4 = 2.5', () => {
    expect(profitFactor(4, 4, 2.5)).toBeCloseTo(2.5, CLOSE)
  })

  // ── Edge cases — no Infinity, no NaN ─────────────────────────────────────

  it('no losses → null, NOT Infinity', () => {
    // Infinity is not a valid metric: it breaks JSON.stringify and is
    // misread as "perfect" rather than "insufficient data".
    expect(profitFactor(5, 0, 2.0)).toBeNull()
    expect(profitFactor(1, 0, 3.5)).toBeNull()
  })

  it('no losses and no wins → null', () => {
    expect(profitFactor(0, 0, 2.0)).toBeNull()
  })

  it('avgRR = null → null regardless of win/loss counts', () => {
    expect(profitFactor(3, 2, null)).toBeNull()
    expect(profitFactor(0, 5, null)).toBeNull()
    expect(profitFactor(5, 0, null)).toBeNull()
  })

  it('return value is always finite or null — never Infinity or NaN', () => {
    const cases: [number, number, number | null][] = [
      [0, 0, 2.0], [5, 0, 2.0], [0, 5, 2.0], [1, 1, 2.0], [3, 2, null],
    ]
    for (const [w, l, r] of cases) {
      const v = profitFactor(w, l, r)
      if (v !== null) {
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })
})

// ── Internal consistency ──────────────────────────────────────────────────────

describe('profitFactor > 1 iff expectancy > 0 (for avgRR > 1)', () => {
  // With avgRR > 1: PF > 1 ↔ wins×avgRR > losses ↔ wr×avgRR > (1−wr)
  // ↔ E = wr×avgRR − (1−wr) > 0. The two statistics must agree on sign.
  //
  // Only strictly profitable and strictly losing cases are tested. The exact
  // break-even (PF = 1.000…) sits on a floating-point boundary where
  // sign(E) is implementation-defined; testing it would pin a rounding quirk.
  const cases: [number, number, number][] = [
    [2, 1, 2.0],  // PF = 4 > 1, E = (2/3)×2 − (1/3) = 1.0 > 0 ✓
    [1, 2, 1.5],  // PF = 0.75 < 1, E = (1/3)×1.5 − (2/3) = −0.167 < 0 ✓
    [3, 1, 3.0],  // PF = 9 > 1, E = 0.75×3 − 0.25 = 2.0 > 0 ✓
    [1, 4, 1.2],  // PF = 0.3 < 1, E = 0.2×1.2 − 0.8 = −0.56 < 0 ✓
  ]
  for (const [w, l, rr] of cases) {
    it(`wins=${w} losses=${l} rr=${rr}`, () => {
      const pf = profitFactor(w, l, rr)
      const ex = expectancy(w, l, rr)
      if (pf === null || ex === null) return
      // PF strictly > 1 ↔ E strictly > 0
      expect(Math.sign(pf - 1)).toBe(Math.sign(ex))
    })
  }
})
