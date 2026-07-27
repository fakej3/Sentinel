import { describe, it, expect } from 'vitest'
import { runSeries, runSource, totalObservations } from '../engine'
import { syntheticSeries, syntheticSource, inMemorySource } from '../sources'
import { bar, fromCloses, HOUR } from './fixtures'
import type { Series } from '../types'

const CFG = { lookbackBars: 60, horizons: [4, 12] }

function series(seed: number, bars: number): Series {
  return syntheticSeries({ symbol: 'RUNUSDT', timeframe: '1h', bars, seed })
}

describe('runSeries — decision boundaries', () => {
  it('first decision is at lookbackBars - 1, so every window is full', () => {
    const r = runSeries(series(3, 200), CFG)
    expect(r.observations[0].barIndex).toBe(59)
  })

  it('last decision leaves room for the shortest horizon', () => {
    const bars = 200
    const r = runSeries(series(3, bars), CFG)
    const last = r.observations[r.observations.length - 1]
    // computeOutcome needs i + h < n for the shortest horizon h = 4.
    expect(last.barIndex).toBe(bars - 4 - 1)
    expect(last.outcomes[4]).not.toBeNull()
  })

  it('a bar with no outcome at any horizon is never recorded', () => {
    const r = runSeries(series(3, 200), CFG)
    for (const o of r.observations) {
      expect(CFG.horizons.some(h => o.outcomes[h] !== null)).toBe(true)
    }
  })

  it('stride selects every Nth bar starting from the first decision', () => {
    const r = runSeries(series(3, 300), { ...CFG, stride: 7 })
    const idx = r.observations.map(o => o.barIndex)
    expect(idx[0]).toBe(59)
    for (let k = 1; k < idx.length; k++) expect(idx[k] - idx[k - 1]).toBe(7)
  })

  it('produces nothing, without throwing, when the series is shorter than the window', () => {
    const r = runSeries({ symbol: 'X', timeframe: '1h', candles: fromCloses([1, 2, 3, 4, 5]) }, CFG)
    expect(r.observations).toEqual([])
  })

  it('asOf is the decision bar\'s open time', () => {
    const s = series(3, 200)
    const r = runSeries(s, CFG)
    for (const o of r.observations) expect(o.asOf).toBe(s.candles[o.barIndex].openTime)
  })
})

describe('runSeries — determinism', () => {
  it('two runs over the same input are byte-identical', () => {
    const s = series(21, 320)
    expect(JSON.stringify(runSeries(s, CFG))).toBe(JSON.stringify(runSeries(s, CFG)))
  })

  it('a synthetic source is reproducible from its seed alone', () => {
    const spec = { symbol: 'S', timeframe: '1h' as const, bars: 260, seed: 4242 }
    expect(JSON.stringify(syntheticSeries(spec))).toBe(JSON.stringify(syntheticSeries(spec)))
  })

  it('carries no state between series', async () => {
    const a = series(1, 260)
    const b = series(2, 260)
    const together = await runSource(inMemorySource([a, b]), CFG)
    const alone = [runSeries(a, CFG), runSeries(b, CFG)]
    expect(JSON.stringify(together)).toBe(JSON.stringify(alone))
  })
})

describe('runSeries — skip accounting', () => {
  it('records a reason for every bar that produced no observation', () => {
    // A series with no range at all has ATR = 0, so no outcome can be
    // expressed in ATR units. The bars must be counted, not vanish.
    const flat = Array.from({ length: 200 }, (_, i) => bar(i * HOUR, 100, 100, 100, 100))
    const r = runSeries({ symbol: 'FLAT', timeframe: '1h', candles: flat }, CFG)
    expect(r.observations).toEqual([])
    const skipped = Object.values(r.skipped).reduce((a, b) => a + b, 0)
    expect(skipped).toBe(200 - 4 - 1 - 59 + 1)
    expect(r.skipped['no-atr']).toBe(skipped)
  })

  it('observations plus skips account for every evaluated bar', () => {
    const r = runSeries(series(9, 300), { ...CFG, stride: 3 })
    const evaluated = Math.floor((300 - 4 - 1 - 59) / 3) + 1
    const skipped = Object.values(r.skipped).reduce((a, b) => a + b, 0)
    expect(r.observations.length + skipped).toBe(evaluated)
  })
})

describe('runSeries — configuration is validated, not coerced', () => {
  const s = series(3, 200)
  it.each([
    ['lookbackBars', { lookbackBars: 1 }],
    ['lookbackBars', { lookbackBars: 60.5 }],
    ['stride', { stride: 0 }],
    ['stride', { stride: 1.5 }],
    ['horizons', { horizons: [] }],
    ['horizon', { horizons: [4, 0] }],
    ['horizon', { horizons: [4, -1] }],
    ['horizon', { horizons: [4, 2.5] }],
  ])('rejects a bad %s', (field, patch) => {
    expect(() => runSeries(s, { ...CFG, ...patch })).toThrow(new RegExp(field))
  })
})

describe('runSource', () => {
  it('runs every series a source lists, in order', async () => {
    const runs = await runSource(syntheticSource([
      { symbol: 'AAA', timeframe: '1h', bars: 200, seed: 1 },
      { symbol: 'BBB', timeframe: '4h', bars: 200, seed: 2 },
    ]), CFG)
    expect(runs.map(r => `${r.symbol}/${r.timeframe}`)).toEqual(['AAA/1h', 'BBB/4h'])
    expect(totalObservations(runs)).toBe(runs[0].observations.length + runs[1].observations.length)
  })

  it('tags each observation with its own symbol and timeframe', async () => {
    const runs = await runSource(syntheticSource([
      { symbol: 'AAA', timeframe: '1h', bars: 200, seed: 1 },
      { symbol: 'BBB', timeframe: '4h', bars: 200, seed: 2 },
    ]), CFG)
    for (const r of runs) for (const o of r.observations) {
      expect(o.symbol).toBe(r.symbol)
      expect(o.timeframe).toBe(r.timeframe)
    }
  })
})
