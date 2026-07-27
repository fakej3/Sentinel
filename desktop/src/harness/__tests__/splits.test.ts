import { describe, it, expect } from 'vitest'
import { walkForwardSplits, defaultEmbargo, validateSplit, trainSet, testSet } from '../splits'
import type { Observation, Split } from '../types'

const HORIZONS = [4, 12, 24, 48]
const CFG = { trainBars: 500, testBars: 100, embargoBars: 48, mode: 'rolling' as const }

function obsAt(barIndex: number): Observation {
  return {
    symbol: 'X', timeframe: '1h', barIndex, asOf: barIndex,
    features: {}, categorical: {}, outcomes: {},
  }
}

describe('defaultEmbargo', () => {
  it('is the longest horizon — the smallest gap a label cannot cross', () => {
    expect(defaultEmbargo(HORIZONS)).toBe(48)
    expect(defaultEmbargo([7])).toBe(7)
  })
  it('refuses to invent a value for an empty horizon set', () => {
    expect(() => defaultEmbargo([])).toThrow(/horizons/)
  })
})

describe('walkForwardSplits — geometry', () => {
  const splits = walkForwardSplits(199, 3000, CFG)

  it('produces at least one split and indexes them from zero', () => {
    expect(splits.length).toBeGreaterThan(0)
    expect(splits.map(s => s.index)).toEqual(splits.map((_, i) => i))
  })

  it('train always precedes test, with exactly the embargo between', () => {
    for (const s of splits) {
      expect(s.trainEnd).toBeGreaterThan(s.trainStart)
      expect(s.testStart).toBe(s.trainEnd + s.embargoBars)
      expect(s.testEnd).toBeGreaterThan(s.testStart)
    }
  })

  it('test blocks tile forward without overlap', () => {
    for (let i = 1; i < splits.length; i++) {
      expect(splits[i].testStart).toBe(splits[i - 1].testEnd)
    }
  })

  it('never runs past the last bar', () => {
    for (const s of splits) expect(s.testEnd).toBeLessThanOrEqual(3001)
  })

  it('rolling keeps the train block a fixed width', () => {
    for (const s of splits) expect(s.trainEnd - s.trainStart).toBe(CFG.trainBars)
  })

  it('anchored pins the start and grows the block', () => {
    const a = walkForwardSplits(199, 3000, { ...CFG, mode: 'anchored' })
    expect(a.map(s => s.trainStart)).toEqual(a.map(() => 199))
    for (let i = 1; i < a.length; i++) {
      expect(a[i].trainEnd - a[i].trainStart).toBeGreaterThan(a[i - 1].trainEnd - a[i - 1].trainStart)
    }
    // Only the train block differs; the test schedule is identical.
    expect(a.map(s => [s.testStart, s.testEnd])).toEqual(splits.map(s => [s.testStart, s.testEnd]))
  })

  it('drops a trailing block shorter than testBars rather than evaluating it', () => {
    const s = walkForwardSplits(0, 700, CFG)
    for (const x of s) expect(x.testEnd - x.testStart).toBe(CFG.testBars)
  })

  it('returns nothing when the range cannot hold one full split', () => {
    expect(walkForwardSplits(0, 100, CFG)).toEqual([])
  })

  it.each([
    ['trainBars', { trainBars: 0 }],
    ['testBars', { testBars: -1 }],
    ['embargoBars', { embargoBars: -1 }],
    ['trainBars', { trainBars: 1.5 }],
  ])('rejects a bad %s', (field, patch) => {
    expect(() => walkForwardSplits(0, 3000, { ...CFG, ...patch })).toThrow(new RegExp(field))
  })
})

describe('validateSplit — the embargo is not negotiable', () => {
  it('accepts a split whose gap covers the longest horizon', () => {
    for (const s of walkForwardSplits(199, 3000, CFG)) {
      expect(() => validateSplit(s, HORIZONS)).not.toThrow()
    }
  })

  it('rejects a gap shorter than the longest horizon', () => {
    const [s] = walkForwardSplits(199, 3000, { ...CFG, embargoBars: 47 })
    expect(() => validateSplit(s, HORIZONS)).toThrow(/embargo 47 < max horizon 48/)
  })

  it('rejects a hand-built split whose declared embargo does not match its gap', () => {
    const bad: Split = { index: 0, trainStart: 0, trainEnd: 100, embargoBars: 48, testStart: 120, testEnd: 200 }
    expect(() => validateSplit(bad, HORIZONS)).toThrow(/gap 20 != embargo 48/)
  })

  it('rejects empty blocks', () => {
    expect(() => validateSplit(
      { index: 0, trainStart: 0, trainEnd: 0, embargoBars: 48, testStart: 48, testEnd: 100 }, HORIZONS,
    )).toThrow(/empty train/)
    expect(() => validateSplit(
      { index: 0, trainStart: 0, trainEnd: 100, embargoBars: 48, testStart: 148, testEnd: 148 }, HORIZONS,
    )).toThrow(/empty test/)
  })
})

describe('trainSet / testSet', () => {
  const split: Split = { index: 0, trainStart: 10, trainEnd: 20, embargoBars: 5, testStart: 25, testEnd: 30 }
  const obs = Array.from({ length: 40 }, (_, i) => obsAt(i))

  it('partitions on half-open bar ranges', () => {
    expect(trainSet(obs, split).map(o => o.barIndex)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    expect(testSet(obs, split).map(o => o.barIndex)).toEqual([25, 26, 27, 28, 29])
  })

  it('assigns no observation to both sides, and none from the embargo to either', () => {
    const tr = new Set(trainSet(obs, split).map(o => o.barIndex))
    const te = new Set(testSet(obs, split).map(o => o.barIndex))
    for (const b of tr) expect(te.has(b)).toBe(false)
    for (const b of [20, 21, 22, 23, 24]) {
      expect(tr.has(b)).toBe(false)
      expect(te.has(b)).toBe(false)
    }
  })

  it('no training label can reach a test bar', () => {
    // The property the embargo exists for, checked directly.
    const maxH = Math.max(...HORIZONS)
    for (const s of walkForwardSplits(199, 3000, { ...CFG, embargoBars: defaultEmbargo(HORIZONS) })) {
      const lastTrainBar = s.trainEnd - 1
      expect(lastTrainBar + maxH).toBeLessThan(s.testStart)
    }
  })
})
