import { describe, it, expect } from 'vitest'
import { encodeTrajectory, tail } from '../trajectory/encoder'
import { DEFAULT_TRAJECTORY_CONFIG } from '../trajectory/types'
import { fromPath, bar, scalePrices, randomWalk, rng, HOUR, DAY } from './fixtures'
import type { TrajectoryPoint } from '../trajectory/types'

/**
 * Scale invariance holds in R but not in binary64: (k*a - k*b)/(k*c) is not
 * bitwise equal to (a - b)/c. Measured worst deviation across scale factors
 * 1e-6..1e6 is 3.6e-14 absolute, so equality is asserted to that tolerance.
 * An earlier version of this file asserted exact equality and was wrong.
 */
const FLOAT_TOLERANCE = 1e-12

function expectPointsEquivalent(a: readonly TrajectoryPoint[], b: readonly TrajectoryPoint[]): void {
  expect(b).toHaveLength(a.length)
  for (let i = 0; i < a.length; i++) {
    expect(b[i].index).toBe(a[i].index)
    expect(b[i].openTime).toBe(a[i].openTime)
    for (const f of ['displacement', 'range', 'bodyShare', 'closePosition', 'gap'] as const) {
      expect(Math.abs(b[i][f] - a[i][f]), `${f} at bar ${a[i].index}`).toBeLessThan(FLOAT_TOLERANCE)
    }
    for (const f of ['volumeZ', 'aggressorShare'] as const) {
      if (a[i][f] === null || b[i][f] === null) expect(b[i][f]).toBe(a[i][f])
      else expect(Math.abs((b[i][f] as number) - (a[i][f] as number))).toBeLessThan(FLOAT_TOLERANCE)
    }
  }
}

/**
 * These are the invariants the whole V6 architecture rests on. If any one of
 * them fails, historical analogy is invalid: scale-dependence makes eras
 * incomparable, look-ahead makes every backtest a lie, and prefix instability
 * makes replay meaningless.
 */

describe('TrajectoryEncoder — scale invariance', () => {
  it('is unchanged when every price is multiplied by a constant', () => {
    // The property that makes BTC at $9k and $90k comparable. Without it,
    // analog retrieval across eras is impossible in principle.
    const base = fromPath(randomWalk(1, 120))
    const a = encodeTrajectory(base)
    expect(a.ok).toBe(true)
    for (const k of [1e-6, 0.5, 3, 1000, 1e6]) {
      const b = encodeTrajectory(scalePrices(base, k))
      expect(b.ok).toBe(true)
      expectPointsEquivalent(a.trajectory!.points, b.trajectory!.points)
    }
  })

  it('is unchanged when every volume is multiplied by a constant', () => {
    // volumeZ is a z-score and aggressorShare is a ratio, so both are immune
    // to the unit volume is quoted in.
    const path = randomWalk(2, 120)
    const a = encodeTrajectory(fromPath(path, HOUR, i => 1000 + i * 7))
    const b = encodeTrajectory(fromPath(path, HOUR, i => (1000 + i * 7) * 1e6))
    expect(a.ok && b.ok).toBe(true)
    expectPointsEquivalent(a.trajectory!.points, b.trajectory!.points)
  })
})

describe('TrajectoryEncoder — causality and prefix stability', () => {
  it('encodes bars 0..m identically whether or not later bars exist', () => {
    // No look-ahead: a value at bar i must be a function of candles[0..i] only.
    const full = fromPath(randomWalk(3, 200))
    const whole = encodeTrajectory(full)
    expect(whole.ok).toBe(true)

    for (const m of [40, 80, 150, 200]) {
      const prefix = encodeTrajectory(full.slice(0, m))
      expect(prefix.ok).toBe(true)
      const expected = whole.trajectory!.points.filter(p => p.index < m)
      expect(prefix.trajectory!.points).toEqual(expected)
    }
  })

  it('appending a candle never alters any earlier point', () => {
    // One fixed path, revealed one bar at a time. An earlier version generated
    // fresh random tails per iteration, so it compared runs whose appended bars
    // genuinely differed — a bug in the test, not in the encoder.
    const full = fromPath(randomWalk(4, 120))
    let previous = encodeTrajectory(full.slice(0, 100)).trajectory!.points
    for (let n = 101; n <= full.length; n++) {
      const grown = encodeTrajectory(full.slice(0, n)).trajectory!
      expect(grown.points.slice(0, previous.length)).toEqual(previous)
      expect(grown.points.length).toBeGreaterThanOrEqual(previous.length)
      previous = grown.points
    }
  })
})

describe('TrajectoryEncoder — determinism and finiteness', () => {
  it('is deterministic across repeated calls with fresh object identities', () => {
    const c = fromPath(randomWalk(6, 150))
    const a = encodeTrajectory(c)
    const b = encodeTrajectory(c.map(x => ({ ...x })))
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a))
  })

  it('emits no NaN or Infinity across adversarial inputs', () => {
    const r = rng(99)
    const cases: Array<[string, ReturnType<typeof fromPath>]> = [
      ['flat', fromPath(Array(80).fill(100))],
      ['zero-volume', fromPath(randomWalk(7, 80), HOUR, () => 0)],
      ['identical-hl', Array.from({ length: 80 }, (_, i) => bar(DAY * 100 + i * HOUR, HOUR, 100, 100, 100, 100, 1000))],
      ['flash-crash', fromPath(Array.from({ length: 80 }, (_, i) => i === 40 ? 1 : 100))],
      ['parabolic', fromPath(Array.from({ length: 80 }, (_, i) => 100 * Math.pow(1.08, i)))],
      ['tiny-prices', fromPath(randomWalk(8, 80, 1e-8))],
      ['huge-prices', fromPath(randomWalk(9, 80, 1e9))],
      ['alternating-spikes', fromPath(Array.from({ length: 80 }, (_, i) => i % 2 ? 100 : 160))],
      ['random-vol', fromPath(randomWalk(10, 80), HOUR, () => r() * 1e6)],
    ]
    for (const [label, candles] of cases) {
      const res = encodeTrajectory(candles)
      if (!res.ok) continue // an honest refusal is an acceptable outcome
      for (const p of res.trajectory!.points) {
        for (const [k, v] of Object.entries(p)) {
          if (typeof v === 'number') {
            expect(Number.isFinite(v), `${label}: ${k} = ${v}`).toBe(true)
          }
        }
      }
    }
  })
})

describe('TrajectoryEncoder — field semantics', () => {
  it('bounds bodyShare and closePosition to [0, 1]', () => {
    const res = encodeTrajectory(fromPath(randomWalk(11, 200)))
    for (const p of res.trajectory!.points) {
      expect(p.bodyShare).toBeGreaterThanOrEqual(0)
      expect(p.bodyShare).toBeLessThanOrEqual(1)
      expect(p.closePosition).toBeGreaterThanOrEqual(0)
      expect(p.closePosition).toBeLessThanOrEqual(1)
    }
  })

  it('reports closePosition ≈ 1 for a bar closing on its high, ≈ 0 on its low', () => {
    const base = Array.from({ length: 40 }, (_, i) => bar(DAY * 100 + i * HOUR, HOUR, 100, 101, 99, 100, 1000))
    const onHigh = [...base, bar(DAY * 100 + 40 * HOUR, HOUR, 100, 104, 100, 104, 1000)]
    const onLow = [...base, bar(DAY * 100 + 40 * HOUR, HOUR, 100, 100, 96, 96, 1000)]
    const hi = encodeTrajectory(onHigh).trajectory!.points.at(-1)!
    const lo = encodeTrajectory(onLow).trajectory!.points.at(-1)!
    expect(hi.closePosition).toBeCloseTo(1, 6)
    expect(lo.closePosition).toBeCloseTo(0, 6)
  })

  it('reports aggressorShare as the taker-buy fraction, and null when nothing traded', () => {
    const base = Array.from({ length: 40 }, (_, i) => bar(DAY * 100 + i * HOUR, HOUR, 100, 101, 99, 100, 1000, 0.75))
    const traded = encodeTrajectory(base).trajectory!.points.at(-1)!
    expect(traded.aggressorShare).toBeCloseTo(0.75, 9)

    const silent = [...base, bar(DAY * 100 + 40 * HOUR, HOUR, 100, 101, 99, 100, 0)]
    expect(encodeTrajectory(silent).trajectory!.points.at(-1)!.aggressorShare).toBeNull()
  })

  it('does not report a gap across missing candles — a data hole is not a market event', () => {
    const contiguous = fromPath(randomWalk(12, 60))
    const holed = [...contiguous.slice(0, 50), ...contiguous.slice(55)]
    const res = encodeTrajectory(holed)
    const atHole = res.trajectory!.points.find(p => p.index === 50)
    expect(atHole?.gap).toBe(0)
  })
})

describe('TrajectoryEncoder — honest refusal', () => {
  it('refuses rather than degrading when there is not enough history', () => {
    const res = encodeTrajectory(fromPath(randomWalk(13, DEFAULT_TRAJECTORY_CONFIG.atrPeriod)))
    expect(res.ok).toBe(false)
    expect(res.trajectory).toBeNull()
    expect(res.unavailable!.code).toBe('insufficient-history')
  })

  it('refuses on malformed timestamps', () => {
    const c = fromPath(randomWalk(14, 60)).map(x => ({ ...x, openTime: NaN, closeTime: NaN }))
    const res = encodeTrajectory(c)
    expect(res.ok).toBe(false)
    expect(res.unavailable!.code).toBe('malformed-input')
  })

  it('never returns a trajectory alongside a reason', () => {
    for (const n of [0, 5, 15, 16, 60]) {
      const res = encodeTrajectory(fromPath(randomWalk(15, n)))
      expect(res.ok).toBe(res.trajectory !== null)
      expect(res.ok).toBe(res.unavailable === null)
    }
  })
})

describe('tail', () => {
  it('returns the most recent points, oldest first', () => {
    const t = encodeTrajectory(fromPath(randomWalk(16, 120))).trajectory!
    const last5 = tail(t, 5)
    expect(last5).toHaveLength(5)
    expect(last5.at(-1)).toEqual(t.points.at(-1))
    for (let i = 1; i < last5.length; i++) {
      expect(last5[i].index).toBeGreaterThan(last5[i - 1].index)
    }
  })

  it('clamps rather than throwing when asked for more than exists', () => {
    const t = encodeTrajectory(fromPath(randomWalk(17, 60))).trajectory!
    expect(tail(t, 10_000)).toHaveLength(t.points.length)
    expect(tail(t, 0)).toHaveLength(0)
  })
})
