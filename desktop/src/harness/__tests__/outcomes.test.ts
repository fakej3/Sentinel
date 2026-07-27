import { describe, it, expect } from 'vitest'
import { computeOutcome, computeOutcomes, baseRates } from '../outcomes'
import { bar, fromCloses, HOUR } from './fixtures'

describe('computeOutcome — the causality contract', () => {
  it('reads the exit close from exactly i + h', () => {
    const c = fromCloses([100, 101, 102, 103, 104, 105])
    const r = computeOutcome(c, 1, 3, 1)!
    // entry = close[1] = 101, exit = close[4] = 104
    expect(r.forwardReturn).toBeCloseTo((104 - 101) / 101, 12)
    expect(r.forwardReturnAtr).toBeCloseTo(3, 12)
  })

  it('excludes the decision bar\'s own high and low from MFE/MAE', () => {
    // Bar 1 has an enormous wick. It closed before the decision, so no trade
    // opened at bar 1 could have captured it.
    const c = [
      bar(0 * HOUR, 100, 100, 100, 100),
      bar(1 * HOUR, 100, 900, 1, 100),
      bar(2 * HOUR, 100, 110, 95, 105),
      bar(3 * HOUR, 105, 112, 90, 108),
    ]
    const r = computeOutcome(c, 1, 2, 1)!
    expect(r.mfeAtr).toBe(112 - 100)  // max high over bars 2..3
    expect(r.maeAtr).toBe(90 - 100)   // min low  over bars 2..3
  })

  it('ignores everything before the decision bar except its close', () => {
    const a = fromCloses([100, 200, 300, 50, 51, 52, 53])
    const b = a.map((c, i) => (i < 3 ? { ...c, high: c.high * 7, low: c.low / 7, volume: 1 } : c))
    expect(computeOutcome(b, 3, 3, 1)).toEqual(computeOutcome(a, 3, 3, 1))
  })

  it('returns null rather than a shortened horizon at the end of the data', () => {
    const c = fromCloses([100, 101, 102, 103, 104])   // indices 0..4
    expect(computeOutcome(c, 2, 2, 1)).not.toBeNull() // needs index 4 — available
    expect(computeOutcome(c, 2, 3, 1)).toBeNull()     // needs index 5 — absent
    expect(computeOutcome(c, 4, 1, 1)).toBeNull()
  })

  it('rejects an unusable ATR instead of emitting Infinity', () => {
    const c = fromCloses([100, 101, 102, 103])
    expect(computeOutcome(c, 0, 2, 0)).toBeNull()
    expect(computeOutcome(c, 0, 2, -1)).toBeNull()
    expect(computeOutcome(c, 0, 2, NaN)).toBeNull()
  })

  it('rejects out-of-range and non-positive horizons', () => {
    const c = fromCloses([100, 101, 102, 103])
    expect(computeOutcome(c, -1, 1, 1)).toBeNull()
    expect(computeOutcome(c, 99, 1, 1)).toBeNull()
    expect(computeOutcome(c, 0, 0, 1)).toBeNull()
    expect(computeOutcome(c, 0, -3, 1)).toBeNull()
  })

  it('scales returns by ATR without changing sign or the up label', () => {
    const c = fromCloses([100, 99, 98, 97])
    const a = computeOutcome(c, 0, 3, 1)!
    const b = computeOutcome(c, 0, 3, 5)!
    expect(a.up).toBe(false)
    expect(b.up).toBe(false)
    expect(a.forwardReturn).toBe(b.forwardReturn)
    expect(b.forwardReturnAtr).toBeCloseTo(a.forwardReturnAtr / 5, 12)
  })

  it('MFE >= 0 >= MAE is not assumed — a gapped bar can strand price on one side', () => {
    // Every future bar trades above entry: MAE is positive, and pretending
    // otherwise would fabricate a drawdown that never happened.
    const c = [
      bar(0, 100, 101, 99, 100),
      bar(HOUR, 120, 125, 118, 122),
      bar(2 * HOUR, 122, 130, 121, 129),
    ]
    const r = computeOutcome(c, 0, 2, 1)!
    expect(r.maeAtr).toBe(18)
    expect(r.mfeAtr).toBe(30)
  })
})

describe('computeOutcomes', () => {
  it('returns one entry per requested horizon, null where unavailable', () => {
    const c = fromCloses([100, 101, 102, 103, 104])
    const r = computeOutcomes(c, 1, [1, 3, 10], 1)
    expect(Object.keys(r).map(Number).sort((a, b) => a - b)).toEqual([1, 3, 10])
    expect(r[1]).not.toBeNull()
    expect(r[3]).not.toBeNull()
    expect(r[10]).toBeNull()
  })
})

describe('baseRates', () => {
  it('counts only observations that actually have the horizon', () => {
    const obs = [
      { outcomes: { 4: { horizonBars: 4, forwardReturn: 0.1, forwardReturnAtr: 1, mfeAtr: 1, maeAtr: 0, up: true }, 12: null } },
      { outcomes: { 4: { horizonBars: 4, forwardReturn: -0.1, forwardReturnAtr: -1, mfeAtr: 0, maeAtr: -1, up: false }, 12: null } },
      { outcomes: { 4: null, 12: null } },
    ]
    const r = baseRates(obs, [4, 12])
    expect(r[4]).toEqual({ rate: 0.5, n: 2 })
    expect(r[12].n).toBe(0)
    expect(Number.isNaN(r[12].rate)).toBe(true)
  })
})
