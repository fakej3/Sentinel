import { describe, it, expect } from 'vitest'
import { computeVolumeTrend } from '../compute/volume-trend'
import { DEFAULT_CONFIG } from '../config'
import { candle } from './helpers'

function makeCandles(volumes: number[]) {
  return volumes.map((v, i) => candle({ openTime: i * 1000, close: 100, volume: v }))
}

describe('computeVolumeTrend', () => {
  it('returns flat with 0 confidence when fewer than 2 candles', () => {
    const result = computeVolumeTrend([candle({ close: 100, volume: 500 })], DEFAULT_CONFIG)
    expect(result.direction).toBe('flat')
    expect(result.confidence).toBe(0)
  })

  it('classifies clearly increasing volume as increasing', () => {
    const volumes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    const result = computeVolumeTrend(makeCandles(volumes), DEFAULT_CONFIG)
    expect(result.direction).toBe('increasing')
    expect(result.confidence).toBeGreaterThan(5)
  })

  it('classifies clearly decreasing volume as decreasing', () => {
    const volumes = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]
    const result = computeVolumeTrend(makeCandles(volumes), DEFAULT_CONFIG)
    expect(result.direction).toBe('decreasing')
    expect(result.confidence).toBeGreaterThan(5)
  })

  it('classifies flat volume as flat', () => {
    const volumes = Array(10).fill(1000)
    const result = computeVolumeTrend(makeCandles(volumes), DEFAULT_CONFIG)
    expect(result.direction).toBe('flat')
    expect(result.confidence).toBe(10)
  })

  it('uses only the last volumeTrendWindow candles', () => {
    // First 10 are decreasing, last 10 are flat
    const first = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]
    const last = Array(10).fill(100)
    const result = computeVolumeTrend(makeCandles([...first, ...last]), DEFAULT_CONFIG)
    expect(result.direction).toBe('flat')
  })

  it('confidence is 0–10', () => {
    const random = [300, 150, 800, 200, 600, 100, 900, 400, 700, 250]
    const result = computeVolumeTrend(makeCandles(random), DEFAULT_CONFIG)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(10)
  })

  it('returns evidence strings', () => {
    const result = computeVolumeTrend(makeCandles(Array(10).fill(500)), DEFAULT_CONFIG)
    expect(result.evidence.length).toBeGreaterThan(0)
    expect(result.evidence.every((e) => typeof e === 'string')).toBe(true)
  })
})
