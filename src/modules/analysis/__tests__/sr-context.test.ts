import { describe, it, expect } from 'vitest'
import { deriveSRContext } from '../compute/sr-context'
import { DEFAULT_ANALYSIS_CONFIG } from '../config'
import { emptySupportResistance, priceZone } from './helpers'

const cfg = DEFAULT_ANALYSIS_CONFIG

describe('deriveSRContext', () => {
  it('returns null distances when no S/R zones exist', () => {
    const result = deriveSRContext(100, emptySupportResistance(), cfg)
    expect(result.nearestSupportDistance).toBeNull()
    expect(result.nearestResistanceDistance).toBeNull()
  })

  it('computes nearestSupportDistance as percentage below price', () => {
    const support = priceZone('support', 95)
    const sr = {
      ...emptySupportResistance(),
      nearestSupport: support,
      activeSupport: [support],
    }
    const result = deriveSRContext(100, sr, cfg)
    // (100 - 95) / 100 * 100 = 5%
    expect(result.nearestSupportDistance).toBeCloseTo(5, 5)
  })

  it('computes nearestResistanceDistance as percentage above price', () => {
    const resistance = priceZone('resistance', 105)
    const sr = {
      ...emptySupportResistance(),
      nearestResistance: resistance,
      activeResistance: [resistance],
    }
    const result = deriveSRContext(100, sr, cfg)
    // (105 - 100) / 100 * 100 = 5%
    expect(result.nearestResistanceDistance).toBeCloseTo(5, 5)
  })

  it('sets insideSupport when currentZone is a support zone', () => {
    const zone = priceZone('support', 100)
    const sr = { ...emptySupportResistance(), currentZone: zone }
    const result = deriveSRContext(100, sr, cfg)
    expect(result.insideSupport).toBe(true)
    expect(result.insideResistance).toBe(false)
  })

  it('sets insideResistance when currentZone is a resistance zone', () => {
    const zone = priceZone('resistance', 100)
    const sr = { ...emptySupportResistance(), currentZone: zone }
    const result = deriveSRContext(100, sr, cfg)
    expect(result.insideResistance).toBe(true)
    expect(result.insideSupport).toBe(false)
  })

  it('sets approachingSupport when support is within supportProximityPercent', () => {
    const support = priceZone('support', 99)  // 1% below price=100
    const sr = {
      ...emptySupportResistance(),
      nearestSupport: support,
      activeSupport: [support],
    }
    const result = deriveSRContext(100, sr, cfg)
    expect(result.approachingSupport).toBe(true)
  })

  it('does not set approachingSupport when support is beyond supportProximityPercent', () => {
    const support = priceZone('support', 90)  // 10% below price=100
    const sr = {
      ...emptySupportResistance(),
      nearestSupport: support,
      activeSupport: [support],
    }
    const result = deriveSRContext(100, sr, cfg)
    expect(result.approachingSupport).toBe(false)
  })

  it('returns strongest active support by strength score', () => {
    const weak = priceZone('support', 95, 3)
    const strong = priceZone('support', 93, 8)
    const sr = {
      ...emptySupportResistance(),
      activeSupport: [weak, strong],
      nearestSupport: weak,
    }
    const result = deriveSRContext(100, sr, cfg)
    expect(result.strongestActiveSupport?.strength).toBe(8)
  })

  it('returns strongest active resistance by strength score', () => {
    const weak = priceZone('resistance', 103, 2)
    const strong = priceZone('resistance', 107, 9)
    const sr = {
      ...emptySupportResistance(),
      activeResistance: [weak, strong],
      nearestResistance: weak,
    }
    const result = deriveSRContext(100, sr, cfg)
    expect(result.strongestActiveResistance?.strength).toBe(9)
  })

  it('returns null for strongestActiveSupport when no active support', () => {
    const result = deriveSRContext(100, emptySupportResistance(), cfg)
    expect(result.strongestActiveSupport).toBeNull()
    expect(result.strongestActiveResistance).toBeNull()
  })

  it('produces deterministic output for same inputs', () => {
    const support = priceZone('support', 98)
    const sr = { ...emptySupportResistance(), nearestSupport: support, activeSupport: [support] }
    const r1 = deriveSRContext(100, sr, cfg)
    const r2 = deriveSRContext(100, sr, cfg)
    expect(r1).toEqual(r2)
  })
})
