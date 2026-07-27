import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { syntheticSeries, parseSeriesFile, jsonFileSource, inMemorySource, rng } from '../sources'
import { writeRun } from '../export'
import { runSeries } from '../engine'
import { bar, HOUR } from './fixtures'

describe('rng', () => {
  it('is a pure function of the seed', () => {
    const a = Array.from({ length: 20 }, rng(9))
    const r = rng(9)
    expect(Array.from({ length: 20 }, r)).toEqual(a)
  })
  it('stays in [0, 1)', () => {
    const r = rng(4)
    for (let i = 0; i < 10_000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('syntheticSeries', () => {
  const s = syntheticSeries({ symbol: 'S', timeframe: '1h', bars: 500, seed: 3 })

  it('produces well-formed candles', () => {
    for (const c of s.candles) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close))
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close))
      expect(c.low).toBeGreaterThan(0)
      expect(c.closeTime).toBeGreaterThan(c.openTime)
      expect(c.takerBuyVolume + c.takerSellVolume).toBeCloseTo(c.volume, 9)
    }
  })

  it('spaces bars by the timeframe, with no gaps', () => {
    for (let i = 1; i < s.candles.length; i++) {
      expect(s.candles[i].openTime - s.candles[i - 1].openTime).toBe(HOUR)
    }
  })

  it('is continuous: each open equals the previous close', () => {
    for (let i = 1; i < s.candles.length; i++) {
      expect(s.candles[i].open).toBe(s.candles[i - 1].close)
    }
  })

  it('has zero mean log return at drift = 0', () => {
    const rs: number[] = []
    for (let i = 1; i < s.candles.length; i++) rs.push(Math.log(s.candles[i].close / s.candles[i - 1].close))
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length
    const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / rs.length)
    // |mean| within 4 standard errors of zero.
    expect(Math.abs(mean)).toBeLessThan(4 * sd / Math.sqrt(rs.length))
  })

  it('applies drift when asked', () => {
    const d = syntheticSeries({ symbol: 'D', timeframe: '1h', bars: 500, seed: 3, drift: 0.001 })
    const logRet = (x: typeof d) => Math.log(x.candles[x.candles.length - 1].close / x.candles[0].open)
    expect(logRet(d)).toBeGreaterThan(logRet(s))
  })
})

describe('parseSeriesFile — rejects rather than repairs', () => {
  const good = JSON.stringify({
    symbol: 'AAA', timeframe: '1h',
    candles: [bar(0, 1, 2, 0.5, 1.5), bar(HOUR, 1.5, 2, 1, 1.8)],
  })

  it('accepts a well-formed file', () => {
    const s = parseSeriesFile('f.json', good)
    expect(s.symbol).toBe('AAA')
    expect(s.candles.length).toBe(2)
  })

  it.each([
    ['not valid JSON', '{'],
    ['expected an object', '[]'],
    ['missing "symbol"', JSON.stringify({ timeframe: '1h', candles: [] })],
    ['"timeframe" must be one of', JSON.stringify({ symbol: 'A', timeframe: '7h', candles: [] })],
    ['missing "candles" array', JSON.stringify({ symbol: 'A', timeframe: '1h' })],
    ['candle 0 is malformed', JSON.stringify({ symbol: 'A', timeframe: '1h', candles: [{ open: 1 }] })],
    ['candle 0 is malformed', JSON.stringify({ symbol: 'A', timeframe: '1h', candles: [{ ...bar(0, 1, 2, 0.5, 1.5), close: 'x' }] })],
  ])('rejects with "%s"', (message, text) => {
    expect(() => parseSeriesFile('f.json', text)).toThrow(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })

  it('rejects out-of-order candles — a silently reordered series would corrupt every window', () => {
    const text = JSON.stringify({
      symbol: 'A', timeframe: '1h', candles: [bar(HOUR, 1, 2, 0.5, 1.5), bar(0, 1, 2, 0.5, 1.5)],
    })
    expect(() => parseSeriesFile('f.json', text)).toThrow(/strictly increasing in openTime at index 1/)
  })

  it('rejects a duplicated timestamp', () => {
    const text = JSON.stringify({
      symbol: 'A', timeframe: '1h', candles: [bar(0, 1, 2, 0.5, 1.5), bar(0, 1, 2, 0.5, 1.5)],
    })
    expect(() => parseSeriesFile('f.json', text)).toThrow(/strictly increasing/)
  })

  it('names the file in every message, so a bad corpus is diagnosable', () => {
    expect(() => parseSeriesFile('/data/btc-1h.json', '{')).toThrow(/\/data\/btc-1h\.json/)
  })
})

describe('jsonFileSource + writeRun', () => {
  it('round-trips a run through disk in filename order', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'sentinel-harness-'))
    try {
      const a = syntheticSeries({ symbol: 'AAA', timeframe: '1h', bars: 220, seed: 1 })
      const b = syntheticSeries({ symbol: 'BBB', timeframe: '1h', bars: 220, seed: 2 })
      // Written in reverse; the source must still list them sorted.
      await writeFile(path.join(dir, 'z-bbb.json'), JSON.stringify(b))
      await writeFile(path.join(dir, 'a-aaa.json'), JSON.stringify(a))
      await writeFile(path.join(dir, 'ignored.txt'), 'not json')

      const listed = await jsonFileSource(dir).list()
      expect(listed.map(s => s.symbol)).toEqual(['AAA', 'BBB'])
      expect(listed[0].candles).toEqual(a.candles)

      const out = path.join(dir, 'out')
      const runs = listed.map(s => runSeries(s, { lookbackBars: 60, horizons: [4, 12] }))
      await writeRun(out, 'test', runs, '2026-01-01T00:00:00.000Z')

      const { readFile, readdir } = await import('node:fs/promises')
      expect((await readdir(out)).sort()).toEqual(['manifest.json', 'observations.csv', 'observations.jsonl'])
      const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'))
      expect(manifest.totalObservations).toBe(runs[0].observations.length + runs[1].observations.length)
      expect(manifest.generatedAt).toBe('2026-01-01T00:00:00.000Z')

      const jsonl = (await readFile(path.join(out, 'observations.jsonl'), 'utf8')).trimEnd().split('\n')
      expect(jsonl.length).toBe(manifest.totalObservations)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('inMemorySource', () => {
  it('returns exactly what it was given', async () => {
    const s = syntheticSeries({ symbol: 'M', timeframe: '1h', bars: 10, seed: 1 })
    expect(await inMemorySource([s]).list()).toEqual([s])
  })
})
