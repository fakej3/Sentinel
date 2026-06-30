import { describe, it, expect } from 'vitest'
import { computeVolumeMa } from '../compute/volume-ma'

describe('computeVolumeMa', () => {
  it('returns null when volumes.length < period + 1', () => {
    expect(computeVolumeMa(Array(19).fill(100), 20)).toBeNull()
    expect(computeVolumeMa(Array(20).fill(100), 20)).toBeNull() // needs 21 for period=20
    expect(computeVolumeMa([], 20)).toBeNull()
  })

  it('computes the SMA of the prior period volumes (excludes current bar)', () => {
    // volumes = [1000, 1000, 1000, 300, 400, 500], period = 3
    // prior 3 (excludes current 500): [1000, 300, 400], SMA = 566.67
    const result = computeVolumeMa([1000, 1000, 1000, 300, 400, 500], 3)!
    expect(result.ma).toBeCloseTo(566.67, 1)
  })

  it('computes relative volume as current / prior MA', () => {
    // volumes = [100, 100, 100, 100, 200], period = 3
    // prior 3 (excludes current 200): [100, 100, 100], MA = 100
    // current = 200, relVol = 200 / 100 = 2.0
    const result = computeVolumeMa([100, 100, 100, 100, 200], 3)!
    expect(result.ma).toBeCloseTo(100, 1)
    expect(result.relativeVolume).toBeCloseTo(2.0, 1)
  })

  it('returns relative volume = 1 when current volume equals the prior MA', () => {
    const volumes = Array(5).fill(200)
    const result = computeVolumeMa(volumes, 3)!
    expect(result.relativeVolume).toBeCloseTo(1)
  })

  it('returns relative volume = 0 when prior MA is 0', () => {
    const result = computeVolumeMa([0, 0, 0, 0], 3)!
    expect(result.relativeVolume).toBe(0)
  })

  it('returns relative volume > 1 when current volume exceeds prior MA', () => {
    const result = computeVolumeMa([100, 100, 100, 500], 3)!
    expect(result.relativeVolume).toBeGreaterThan(1)
  })
})
