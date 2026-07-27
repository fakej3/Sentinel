/**
 * Self-review findings, as tests.
 *
 * A misordered series was silently accepted and produced 237 plausible-looking
 * observations. Nothing downstream could have detected it: every window would
 * have been built from candles in the wrong order, `inferBarMs` would have
 * measured the wrong spacing, and VWAP session anchoring would have keyed off
 * the wrong bars — all while the numbers looked entirely ordinary.
 *
 * `jsonFileSource` already rejected this; `runSeries` did not, so any series
 * reaching it by another route bypassed the check. The rule now has one home.
 */
import { describe, it, expect } from 'vitest'
import { assertWellFormedSeries } from '../validate'
import { runSeries } from '../engine'
import { analyseWindow } from '../snapshot'
import { syntheticSeries } from '../sources'
import { bar, HOUR } from './fixtures'

const CFG = { lookbackBars: 60, horizons: [4] }

function swap<T>(xs: readonly T[], a: number, b: number): T[] {
  const out = [...xs]
  const t = out[a]; out[a] = out[b]; out[b] = t
  return out
}

describe('assertWellFormedSeries', () => {
  const ok = syntheticSeries({ symbol: 'X', timeframe: '1h', bars: 50, seed: 1 })

  it('accepts a well-formed series', () => {
    expect(() => assertWellFormedSeries(ok)).not.toThrow()
  })

  it('accepts an empty series — nothing to measure is not malformed', () => {
    expect(() => assertWellFormedSeries({ symbol: 'X', timeframe: '1h', candles: [] })).not.toThrow()
  })

  it('rejects out-of-order candles, naming the index', () => {
    expect(() => assertWellFormedSeries({ ...ok, candles: swap(ok.candles, 10, 20) }))
      .toThrow(/X\/1h: candles are not strictly increasing in openTime at index 11/)
  })

  it('rejects a duplicated timestamp', () => {
    const dup = [...ok.candles]
    dup[5] = { ...dup[5], openTime: dup[4].openTime }
    expect(() => assertWellFormedSeries({ ...ok, candles: dup })).toThrow(/strictly increasing/)
  })

  it('rejects a non-finite price, naming the field', () => {
    const bad = [...ok.candles]
    bad[7] = { ...bad[7], high: NaN }
    expect(() => assertWellFormedSeries({ ...ok, candles: bad })).toThrow(/candle 7: high is not a finite number/)
  })

  it('rejects a non-positive price', () => {
    const bad = [...ok.candles]
    bad[7] = { ...bad[7], low: 0 }
    expect(() => assertWellFormedSeries({ ...ok, candles: bad })).toThrow(/candle 7: low must be > 0/)
  })

  it('rejects a bar whose high is below its low', () => {
    expect(() => assertWellFormedSeries({ ...ok, candles: [bar(0, 10, 5, 9, 10)] }))
      .toThrow(/candle 0: high 5 < low 9/)
  })

  it('rejects negative volume', () => {
    expect(() => assertWellFormedSeries({ ...ok, candles: [{ ...bar(0, 10, 11, 9, 10), volume: -1 }] }))
      .toThrow(/candle 0: volume must be >= 0/)
  })
})

describe('runSeries validates its input', () => {
  const ok = syntheticSeries({ symbol: 'X', timeframe: '1h', bars: 300, seed: 1 })

  it('refuses a misordered series instead of producing plausible nonsense', () => {
    expect(() => runSeries({ ...ok, candles: swap(ok.candles, 100, 200) }, CFG))
      .toThrow(/strictly increasing/)
  })

  it('still accepts the well-formed case', () => {
    expect(runSeries(ok, CFG).observations.length).toBeGreaterThan(200)
  })
})

describe('analyseWindow states its precondition', () => {
  it('rejects an empty window with a contract error, not a TypeError from three modules down', () => {
    expect(() => analyseWindow('X', '1h', [])).toThrow(/analyseWindow: window must not be empty/)
  })

  it('accepts a single-bar window', () => {
    expect(() => analyseWindow('X', '1h', [bar(0, 10, 11, 9, 10)])).not.toThrow()
  })

  it('does not require the window to be a multiple of anything', () => {
    const c = Array.from({ length: 7 }, (_, i) => bar(i * HOUR, 10, 11, 9, 10))
    expect(() => analyseWindow('X', '1h', c)).not.toThrow()
  })
})
