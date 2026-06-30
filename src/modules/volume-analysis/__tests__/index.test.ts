import { describe, it, expect } from 'vitest'
import { computeVolumeAnalysis } from '../index'
import { flatCandles, emptyIndicators, emptyStructure, emptySupportResistance } from './helpers'

const BASE_CANDLES = flatCandles(25, 100, 1000)
const BASE_INDICATORS = emptyIndicators({ vwap: 100 })
const BASE_STRUCTURE = emptyStructure()
const BASE_SR = emptySupportResistance()

describe('computeVolumeAnalysis', () => {
  it('returns all required result fields', () => {
    const result = computeVolumeAnalysis(BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR)
    expect(result).toHaveProperty('volumeTrend')
    expect(result).toHaveProperty('relativeVolume')
    expect(result).toHaveProperty('buySellPressure')
    expect(result).toHaveProperty('volumeConfirmation')
    expect(result).toHaveProperty('climax')
    expect(result).toHaveProperty('accumulationDistribution')
    expect(result).toHaveProperty('obvAnalysis')
    expect(result).toHaveProperty('vwapAnalysis')
    expect(result).toHaveProperty('overallStrength')
    expect(result).toHaveProperty('evidence')
  })

  it('overallStrength is in range [0, 10]', () => {
    const result = computeVolumeAnalysis(BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR)
    expect(result.overallStrength).toBeGreaterThanOrEqual(0)
    expect(result.overallStrength).toBeLessThanOrEqual(10)
  })

  it('evidence is a non-empty string array', () => {
    const result = computeVolumeAnalysis(BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR)
    expect(Array.isArray(result.evidence)).toBe(true)
    expect(result.evidence.length).toBeGreaterThan(0)
    expect(result.evidence.every((e) => typeof e === 'string')).toBe(true)
  })

  it('is deterministic: two identical calls return identical results', () => {
    const r1 = computeVolumeAnalysis(BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR)
    const r2 = computeVolumeAnalysis(BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR)
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
  })

  it('merges partial config with defaults', () => {
    const result = computeVolumeAnalysis(
      BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR,
      { confirmationThreshold: 1.0 },
    )
    expect(result.volumeConfirmation.confirmed).toBe(true)
  })

  it('handles minimal input (single candle) without throwing', () => {
    const single = flatCandles(1, 100)
    expect(() =>
      computeVolumeAnalysis(single, emptyIndicators({ vwap: 100 }), BASE_STRUCTURE, BASE_SR),
    ).not.toThrow()
  })

  it('handles exactly 2 candles', () => {
    const two = flatCandles(2, 100)
    const result = computeVolumeAnalysis(two, emptyIndicators({ vwap: 100 }), BASE_STRUCTURE, BASE_SR)
    expect(result.overallStrength).toBeGreaterThanOrEqual(0)
  })

  it('vwapAnalysis.above is true when price > vwap', () => {
    const indicators = emptyIndicators({ vwap: 90 })
    const result = computeVolumeAnalysis(BASE_CANDLES, indicators, BASE_STRUCTURE, BASE_SR)
    expect(result.vwapAnalysis.above).toBe(true)
  })
})
