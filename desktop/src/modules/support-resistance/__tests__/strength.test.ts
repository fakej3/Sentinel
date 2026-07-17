import { describe, it, expect } from 'vitest'
import { computeStrength, computeZoneConfidence, deriveState } from '../strength'
import type { PriceZone } from '../types'

function baseZone(overrides: Partial<PriceZone> = {}): PriceZone {
  return {
    id: 'sr-001',
    type: 'resistance',
    origin: 'swing-high',
    state: 'active',
    center: 100,
    upper: 102,
    lower: 98,
    width: 4,
    touchCount: 1,
    successfulReactions: 0,
    failedReactions: 0,
    broken: false,
    retested: false,
    firstDetectedIndex: 0,
    lastInteractionIndex: 0,
    age: 0,
    strength: 0,
    confidence: 0,
    evidence: [],
    ...overrides,
  }
}

describe('computeStrength', () => {
  it('returns 2 for a fresh untested zone (base = 20, /10 = 2)', () => {
    expect(computeStrength(baseZone({ touchCount: 1, age: 0 }), 50)).toBeCloseTo(2, 5)
  })

  it('increases with more touches', () => {
    const low = computeStrength(baseZone({ touchCount: 2 }), 50)
    const high = computeStrength(baseZone({ touchCount: 5 }), 50)
    expect(high).toBeGreaterThan(low)
  })

  it('caps touch bonus at 5 extra touches (+50 pts)', () => {
    const sixTouches = computeStrength(baseZone({ touchCount: 7 }), 50)
    const tenTouches = computeStrength(baseZone({ touchCount: 11 }), 50)
    expect(sixTouches).toBe(tenTouches)
  })

  it('increases with successful reactions', () => {
    const base = computeStrength(baseZone(), 50)
    const bouncy = computeStrength(baseZone({ successfulReactions: 3 }), 50)
    expect(bouncy).toBeGreaterThan(base)
  })

  it('caps successfulReactions bonus at 4', () => {
    const four = computeStrength(baseZone({ successfulReactions: 4 }), 50)
    const eight = computeStrength(baseZone({ successfulReactions: 8 }), 50)
    expect(four).toBe(eight)
  })

  it('decreases with failed reactions', () => {
    const clean = computeStrength(baseZone(), 50)
    const failed = computeStrength(baseZone({ failedReactions: 2 }), 50)
    expect(failed).toBeLessThan(clean)
  })

  it('adds +0.5 bonus for retested zone', () => {
    const notRetested = computeStrength(baseZone({ retested: false }), 50)
    const retested = computeStrength(baseZone({ retested: true }), 50)
    expect(retested).toBeGreaterThan(notRetested)
  })

  it('decays after strengthDecayAge', () => {
    const fresh = computeStrength(baseZone({ age: 0 }), 50)
    const old = computeStrength(baseZone({ age: 150 }), 50)
    expect(old).toBeLessThan(fresh)
  })

  it('clamps to 0 minimum', () => {
    const result = computeStrength(baseZone({ age: 10000, failedReactions: 10 }), 50)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('clamps to 10 maximum', () => {
    const result = computeStrength(baseZone({
      touchCount: 100, successfulReactions: 100, retested: true, age: 0,
    }), 50)
    expect(result).toBeLessThanOrEqual(10)
  })

  it('a highly tested zone with 5+ touches and 4 bounces achieves strong score', () => {
    const result = computeStrength(baseZone({
      touchCount: 6, successfulReactions: 4, failedReactions: 0, age: 10, retested: false,
    }), 50)
    // 20 + 5*10 + 4*5 = 90 → 9.0
    expect(result).toBeCloseTo(9.0, 1)
  })
})

describe('computeZoneConfidence', () => {
  it('returns 0 for a zone with only 1 touch and no reactions', () => {
    expect(computeZoneConfidence(baseZone({ touchCount: 1 }))).toBe(0)
  })

  it('returns > 0 when touchCount >= 2 and no reactions', () => {
    expect(computeZoneConfidence(baseZone({ touchCount: 2 }))).toBeGreaterThan(0)
  })

  it('returns higher confidence for pure bounces than mixed history', () => {
    const pure = computeZoneConfidence(baseZone({ successfulReactions: 3, failedReactions: 0 }))
    const mixed = computeZoneConfidence(baseZone({ successfulReactions: 2, failedReactions: 1 }))
    expect(pure).toBeGreaterThan(mixed)
  })

  it('stays in range 0–10', () => {
    const result = computeZoneConfidence(baseZone({ successfulReactions: 10, failedReactions: 0 }))
    expect(result).toBeLessThanOrEqual(10)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

describe('deriveState', () => {
  it('returns archived when age > maxZoneAge', () => {
    expect(deriveState(baseZone({ age: 201 }), 200)).toBe('archived')
  })

  it('archived overrides broken', () => {
    expect(deriveState(baseZone({ age: 201, broken: true }), 200)).toBe('archived')
  })

  it('returns flipped when broken and retested', () => {
    expect(deriveState(baseZone({ broken: true, retested: true }), 200)).toBe('flipped')
  })

  it('returns broken when broken and not retested', () => {
    expect(deriveState(baseZone({ broken: true, retested: false }), 200)).toBe('broken')
  })

  it('returns weakening when failedReactions >= 1 and not broken', () => {
    expect(deriveState(baseZone({ failedReactions: 1, broken: false }), 200)).toBe('weakening')
  })

  it('returns strengthened when successfulReactions >= 2', () => {
    expect(deriveState(baseZone({ successfulReactions: 2 }), 200)).toBe('strengthened')
  })

  it('returns tested when successfulReactions === 1', () => {
    expect(deriveState(baseZone({ successfulReactions: 1 }), 200)).toBe('tested')
  })

  it('returns active for a fresh zone', () => {
    expect(deriveState(baseZone(), 200)).toBe('active')
  })
})
