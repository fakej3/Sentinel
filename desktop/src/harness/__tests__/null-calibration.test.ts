/**
 * Null calibration: does the harness report "no signal" when there is none?
 *
 * A backtest that finds edge everywhere is worthless, and the only way to
 * distinguish "Sentinel has edge" from "the measurement manufactures edge" is
 * to run the measurement on data whose true answer is known. Geometric
 * Brownian motion with zero drift is that data:
 *
 *     log(P_{t+h} / P_t) = Σ_{k=1..h} σ·z_k,   z_k ~ iid N(0,1)
 *
 * The sum is a zero-mean symmetric continuous random variable, so
 * P(forwardReturn > 0) = 1/2 EXACTLY — not approximately, and not only in the
 * limit. Conditioning on any function of bars up to t leaves it at 1/2, by
 * independence of the z_k. Therefore:
 *
 *     for every engine output g and every horizon h,
 *     P(up_h = 1 | g(past) = v) = 1/2.
 *
 * Any measured departure beyond sampling error is a defect in the harness.
 *
 * INDEPENDENCE. The test uses stride = 48 = max(horizons), so consecutive
 * observations within a series have disjoint forward windows, and it draws
 * from 60 independently seeded series. Under the null the labels are therefore
 * genuinely i.i.d. Bernoulli(1/2), and a plain binomial standard error is
 * valid. Overlapping windows would inflate the effective sample size and turn
 * this test into the same false-precision trap that produced a spurious z = 8.9
 * in an earlier coverage experiment.
 *
 * THRESHOLD. |z| <= 4. PROVENANCE: two-sided p ≈ 6.3e-5 per test. The seeds are
 * fixed, so this is a deterministic assertion, not a flaky one; 4σ is chosen so
 * that the test fails on a defect rather than on the tail of a fair coin.
 * Measured at authoring time: max |z| over all reported cells = 1.22.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { runSource } from '../engine'
import { syntheticSource } from '../sources'
import { baseRates } from '../outcomes'
import type { Observation } from '../types'

const HORIZONS = [4, 12, 24, 48]
const STRIDE = 48                 // = max(HORIZONS): disjoint forward windows
const SERIES = 60
const BARS = 900
const MIN_CELL = 100              // below this, a 4σ bound is too wide to mean anything
const Z_MAX = 4

/** Standardised deviation of an observed proportion from 1/2 under n fair coins. */
function zFromHalf(successes: number, n: number): number {
  return (successes / n - 0.5) / Math.sqrt(0.25 / n)
}

let corpus: Observation[] = []

describe('null calibration — a driftless random walk must show no signal', () => {
  // beforeAll, not a first `it`: no assertion below may depend on another
  // test having run.
  beforeAll(async () => {
    const runs = await runSource(
      syntheticSource(Array.from({ length: SERIES }, (_, i) => ({
        symbol: `NULL${i}`, timeframe: '1h' as const, bars: BARS, seed: 1000 + i, drift: 0, sigma: 0.01,
      }))),
      { stride: STRIDE, horizons: HORIZONS },
    )
    corpus = runs.flatMap(r => [...r.observations])
  })

  it('produces a corpus large enough for the bounds below to bite', () => {
    expect(corpus.length).toBeGreaterThan(500)
  })

  it('the unconditional base rate is 1/2 at every horizon', () => {
    const rates = baseRates(corpus, HORIZONS)
    for (const h of HORIZONS) {
      const { rate, n } = rates[h]
      expect(n).toBeGreaterThan(MIN_CELL)
      const z = zFromHalf(rate * n, n)
      expect(Math.abs(z), `h=${h} n=${n} p=${rate.toFixed(4)} z=${z.toFixed(2)}`).toBeLessThan(Z_MAX)
    }
  })

  it.each(['direction', 'trend', 'grade', 'setup_quality'])(
    'conditioning on %s does not move the up-rate away from 1/2', (field) => {
      const values = [...new Set(corpus.map(o => o.categorical[field]))]
      let cellsTested = 0
      for (const v of values) {
        for (const h of HORIZONS) {
          const cell = corpus.filter(o => o.categorical[field] === v && o.outcomes[h] !== null)
          if (cell.length < MIN_CELL) continue
          cellsTested++
          const ups = cell.filter(o => o.outcomes[h]!.up).length
          const z = zFromHalf(ups, cell.length)
          expect(
            Math.abs(z),
            `${field}=${v} h=${h} n=${cell.length} p=${(ups / cell.length).toFixed(4)} z=${z.toFixed(2)}`,
          ).toBeLessThan(Z_MAX)
        }
      }
      expect(cellsTested, `no cell of ${field} reached n >= ${MIN_CELL}`).toBeGreaterThan(0)
    })

  it('splitting on high vs low confidence does not separate outcomes', () => {
    // The engine's headline number. If confidence carried information on a
    // martingale, it would be manufacturing it.
    const scored = corpus.filter(o => Number.isFinite(o.features.confidence_score))
    const sorted = [...scored].sort((a, b) => a.features.confidence_score - b.features.confidence_score)
    const half = Math.floor(sorted.length / 2)
    for (const [name, group] of [['low', sorted.slice(0, half)], ['high', sorted.slice(half)]] as const) {
      for (const h of HORIZONS) {
        const cell = group.filter(o => o.outcomes[h] !== null)
        if (cell.length < MIN_CELL) continue
        const ups = cell.filter(o => o.outcomes[h]!.up).length
        const z = zFromHalf(ups, cell.length)
        expect(Math.abs(z), `${name}-confidence h=${h} n=${cell.length} z=${z.toFixed(2)}`).toBeLessThan(Z_MAX)
      }
    }
  })

  it('the engine does still express opinions — the null result is not vacuous', () => {
    // A harness that recorded nothing would pass every test above. It must be
    // shown that the engine produced a range of directional calls and grades.
    const dirs = new Set(corpus.map(o => o.categorical.direction))
    expect(dirs.has('long')).toBe(true)
    expect(dirs.has('short')).toBe(true)
    expect(new Set(corpus.map(o => o.categorical.grade)).size).toBeGreaterThan(2)
  })
})

describe('null calibration — the test can detect signal when it exists', () => {
  /**
   * The counter-experiment. Without it, every assertion above is consistent
   * with a harness that always reports 1/2 regardless of the data.
   *
   * A strong positive drift makes P(up) > 1/2 by construction, so the SAME
   * statistic on the SAME code path must now exceed the 4σ bound. If it does
   * not, the null result above is evidence of nothing.
   */
  it('a drifting series breaches the same bound the martingale respects', async () => {
    const runs = await runSource(
      syntheticSource(Array.from({ length: SERIES }, (_, i) => ({
        symbol: `DRIFT${i}`, timeframe: '1h' as const, bars: BARS, seed: 2000 + i, drift: 0.002, sigma: 0.01,
      }))),
      { stride: STRIDE, horizons: HORIZONS },
    )
    const obs = runs.flatMap(r => [...r.observations])
    const cell = obs.filter(o => o.outcomes[48] !== null)
    const ups = cell.filter(o => o.outcomes[48]!.up).length
    expect(Math.abs(zFromHalf(ups, cell.length))).toBeGreaterThan(Z_MAX)
  })
})
