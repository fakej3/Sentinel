import { describe, it, expect } from 'vitest'
import { computeVolumeMa } from '../compute/volume-ma'

describe('computeVolumeMa', () => {
  it('returns null when volumes.length < period', () => {
    expect(computeVolumeMa(Array(19).fill(100), 20)).toBeNull()
    expect(computeVolumeMa([], 20)).toBeNull()
  })

  it('computes the SMA of the last period volumes', () => {
    // volumes = [1000, 1000, 1000, 300, 400, 500], period = 3
    // last 3: [300, 400, 500], SMA = 400
    const result = computeVolumeMa([1000, 1000, 1000, 300, 400, 500], 3)!
    expect(result.ma).toBeCloseTo(400)
  })

  it('computes relative volume as current / MA', () => {
    // volumes = [100, 100, 100, 100, 200], period = 3
    // last 3: [100, 100, 200], MA = 133.33
    // current = 200, relVol = 200 / 133.33 ≈ 1.5
    const result = computeVolumeMa([100, 100, 100, 100, 200], 3)!
    expect(result.ma).toBeCloseTo(133.33, 1)
    expect(result.relativeVolume).toBeCloseTo(1.5, 1)
  })

  it('returns relative volume = 1 when current volume equals the MA', () => {
    const volumes = Array(5).fill(200)
    const result = computeVolumeMa(volumes, 3)!
    expect(result.relativeVolume).toBeCloseTo(1)
  })

  it('returns relative volume = 0 when MA is 0', () => {
    const result = computeVolumeMa([0, 0, 0], 3)!
    expect(result.relativeVolume).toBe(0)
  })

  it('returns relative volume > 1 when current volume exceeds MA', () => {
    const result = computeVolumeMa([100, 100, 100, 500], 3)!
    expect(result.relativeVolume).toBeGreaterThan(1)
  })
})
