import { describe, it, expect } from 'vitest'
import { mergeZones } from '../merge'
import type { PriceZone } from '../types'

function makeZone(overrides: Partial<PriceZone> & { center: number; type: 'support' | 'resistance' }): PriceZone {
  const half = 2
  return {
    id: overrides.id ?? 'sr-001',
    type: overrides.type,
    origin: overrides.origin ?? 'swing-high',
    state: 'active',
    center: overrides.center,
    upper: overrides.upper ?? overrides.center + half,
    lower: overrides.lower ?? overrides.center - half,
    width: overrides.width ?? half * 2,
    touchCount: overrides.touchCount ?? 2,
    successfulReactions: overrides.successfulReactions ?? 0,
    failedReactions: overrides.failedReactions ?? 0,
    broken: overrides.broken ?? false,
    retested: overrides.retested ?? false,
    firstDetectedIndex: overrides.firstDetectedIndex ?? 0,
    lastInteractionIndex: overrides.lastInteractionIndex ?? 0,
    age: overrides.age ?? 5,
    strength: overrides.strength ?? 2,
    confidence: overrides.confidence ?? 3,
    evidence: overrides.evidence ?? [],
  }
}

describe('mergeZones', () => {
  it('returns empty array for no zones', () => {
    expect(mergeZones([], 5)).toEqual([])
  })

  it('returns single zone unchanged', () => {
    const z = makeZone({ center: 100, type: 'resistance' })
    expect(mergeZones([z], 5)).toHaveLength(1)
  })

  it('merges two overlapping resistance zones', () => {
    const a = makeZone({ id: 'sr-001', center: 100, type: 'resistance', upper: 102, lower: 98 })
    const b = makeZone({ id: 'sr-002', center: 101, type: 'resistance', upper: 103, lower: 99 })
    const result = mergeZones([a, b], 1)
    expect(result).toHaveLength(1)
    expect(result[0].origin).toBe('merged')
  })

  it('merges two close support zones within mergeThreshold', () => {
    // a: 98–102, b: 104–108; gap = 104 - 102 = 2 < threshold 5
    const a = makeZone({ center: 100, type: 'support', upper: 102, lower: 98 })
    const b = makeZone({ center: 106, type: 'support', upper: 108, lower: 104 })
    const result = mergeZones([a, b], 5)
    expect(result).toHaveLength(1)
  })

  it('does not merge zones beyond mergeThreshold', () => {
    const a = makeZone({ center: 100, type: 'resistance', upper: 102, lower: 98 })
    const b = makeZone({ center: 120, type: 'resistance', upper: 122, lower: 118 })
    const result = mergeZones([a, b], 5)
    expect(result).toHaveLength(2)
  })

  it('does not merge zones of opposite types', () => {
    const support = makeZone({ center: 100, type: 'support', upper: 102, lower: 98 })
    const resistance = makeZone({ center: 101, type: 'resistance', upper: 103, lower: 99 })
    const result = mergeZones([support, resistance], 10)
    expect(result).toHaveLength(2)
  })

  it('merged zone touchCount is sum of both', () => {
    const a = makeZone({ center: 100, type: 'resistance', touchCount: 3 })
    const b = makeZone({ center: 101, type: 'resistance', touchCount: 4, upper: 103, lower: 99 })
    const result = mergeZones([a, b], 5)
    expect(result[0].touchCount).toBe(7)
  })

  it('merged zone center is weighted by touchCount', () => {
    const a = makeZone({ center: 100, type: 'resistance', touchCount: 1 })
    const b = makeZone({ center: 104, type: 'resistance', touchCount: 3, upper: 106, lower: 102 })
    const result = mergeZones([a, b], 5)
    // weighted: (100*1 + 104*3) / 4 = 412/4 = 103
    expect(result[0].center).toBeCloseTo(103, 5)
  })

  it('merged zone upper = max(upper1, upper2)', () => {
    const a = makeZone({ center: 100, type: 'resistance', upper: 102, lower: 98 })
    const b = makeZone({ center: 101, type: 'resistance', upper: 105, lower: 99 })
    const result = mergeZones([a, b], 5)
    expect(result[0].upper).toBe(105)
  })

  it('merged zone lower = min(lower1, lower2)', () => {
    const a = makeZone({ center: 100, type: 'resistance', upper: 102, lower: 96 })
    const b = makeZone({ center: 101, type: 'resistance', upper: 105, lower: 99 })
    const result = mergeZones([a, b], 5)
    expect(result[0].lower).toBe(96)
  })

  it('merged zone is broken if either source is broken', () => {
    const a = makeZone({ center: 100, type: 'support', broken: true })
    const b = makeZone({ center: 101, type: 'support', upper: 103, lower: 99 })
    const result = mergeZones([a, b], 5)
    expect(result[0].broken).toBe(true)
  })

  it('merges successfulReactions from both zones', () => {
    const a = makeZone({ center: 100, type: 'resistance', successfulReactions: 2 })
    const b = makeZone({ center: 101, type: 'resistance', successfulReactions: 3, upper: 103, lower: 99 })
    const result = mergeZones([a, b], 5)
    expect(result[0].successfulReactions).toBe(5)
  })

  it('firstDetectedIndex is min of both', () => {
    const a = makeZone({ center: 100, type: 'resistance', firstDetectedIndex: 5 })
    const b = makeZone({ center: 101, type: 'resistance', firstDetectedIndex: 2, upper: 103, lower: 99 })
    const result = mergeZones([a, b], 5)
    expect(result[0].firstDetectedIndex).toBe(2)
  })
})
