/**
 * The load-bearing test.
 *
 * Everything the harness will ever claim rests on the engine not seeing the
 * future. Prefix stability ("the answer at bar i is the same when later bars
 * are absent") is the usual formulation, but it is weaker than what is needed:
 * it would pass even if a shared buffer carried a future value backwards,
 * because the future value would be absent in both runs.
 *
 * The formulation used here is stronger. Take a series, REPLACE every candle
 * after bar `i` with unrelated random data, and re-run. If the recorded
 * features and categorical outputs at bar `i` change by so much as one bit,
 * something read the future. Outcomes are expected to change — they are the
 * future, and are checked separately.
 */
import { describe, it, expect } from 'vitest'
import { runSeries } from '../engine'
import { syntheticSeries } from '../sources'
import { randomiseAfter } from './fixtures'
import type { Observation, Series } from '../types'

const LOOKBACK = 60
const HORIZONS = [4, 12]

function series(seed: number, bars: number): Series {
  return syntheticSeries({ symbol: 'LEAKUSDT', timeframe: '1h', bars, seed, sigma: 0.012 })
}

function at(obs: readonly Observation[], barIndex: number): Observation {
  const o = obs.find(x => x.barIndex === barIndex)
  if (o === undefined) throw new Error(`no observation at bar ${barIndex}`)
  return o
}

function inputsOf(o: Observation): unknown {
  return { symbol: o.symbol, timeframe: o.timeframe, barIndex: o.barIndex, asOf: o.asOf, features: o.features, categorical: o.categorical }
}

describe('no look-ahead — future randomisation', () => {
  const base = series(7, 400)
  const baseline = runSeries(base, { lookbackBars: LOOKBACK, horizons: HORIZONS })

  // Several decision bars, spread across the run, each perturbed with a
  // different seed so a coincidental match cannot carry the test.
  const probes = [80, 150, 240, 330]

  it.each(probes)('features at bar %i are unchanged when every later candle is randomised', (i) => {
    const perturbed = runSeries(
      { ...base, candles: randomiseAfter(base.candles, i, 5000 + i) },
      { lookbackBars: LOOKBACK, horizons: HORIZONS },
    )
    expect(inputsOf(at(perturbed.observations, i))).toEqual(inputsOf(at(baseline.observations, i)))
  })

  it('outcomes DO change when the future is randomised — the test can detect change at all', () => {
    const i = 150
    const perturbed = runSeries(
      { ...base, candles: randomiseAfter(base.candles, i, 99) },
      { lookbackBars: LOOKBACK, horizons: HORIZONS },
    )
    expect(at(perturbed.observations, i).outcomes).not.toEqual(at(baseline.observations, i).outcomes)
  })

  it('every observation is unchanged when the series is truncated just past its horizon', () => {
    // Prefix stability, stated over the whole corpus rather than one bar.
    const cut = 260
    const truncated = runSeries(
      { ...base, candles: base.candles.slice(0, cut) },
      { lookbackBars: LOOKBACK, horizons: HORIZONS },
    )
    for (const o of truncated.observations) {
      expect(inputsOf(o)).toEqual(inputsOf(at(baseline.observations, o.barIndex)))
    }
    expect(truncated.observations.length).toBeGreaterThan(100)
  })

  it('the window handed to the engine is exactly the lookback ending at the decision bar', () => {
    // Bars older than the window must not influence the observation either —
    // otherwise the run is not reproducible from a fetched 200-candle page.
    const i = 300
    const olderMangled = base.candles.map((c, k) =>
      k <= i - LOOKBACK ? { ...c, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3 } : c)
    const run = runSeries({ ...base, candles: olderMangled }, { lookbackBars: LOOKBACK, horizons: HORIZONS })
    expect(inputsOf(at(run.observations, i))).toEqual(inputsOf(at(baseline.observations, i)))
  })
})

describe('no look-ahead — the harness does not mutate its input', () => {
  it('leaves the source candles byte-identical', () => {
    const s = series(11, 320)
    const before = JSON.stringify(s.candles)
    runSeries(s, { lookbackBars: LOOKBACK, horizons: HORIZONS })
    expect(JSON.stringify(s.candles)).toBe(before)
  })
})
