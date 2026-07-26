import { describe, it, expect } from 'vitest'
import { computeVolumeAnalysis } from '../index'
import { flatCandles, emptyIndicators, emptyStructure, emptySupportResistance } from './helpers'

const BASE_CANDLES = flatCandles(25, 100, 1000)
const BASE_INDICATORS = emptyIndicators()
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
      computeVolumeAnalysis(single, emptyIndicators(), BASE_STRUCTURE, BASE_SR),
    ).not.toThrow()
  })

  it('handles exactly 2 candles', () => {
    const two = flatCandles(2, 100)
    const result = computeVolumeAnalysis(two, emptyIndicators(), BASE_STRUCTURE, BASE_SR)
    expect(result.overallStrength).toBeGreaterThanOrEqual(0)
  })

  it('vwapAnalysis reports the side of the session VWAP', () => {
    // flatCandles are all priced identically, so the session VWAP equals the
    // close and the side is the genuine third state rather than above/below.
    const result = computeVolumeAnalysis(BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR)
    expect(result.vwapAnalysis.available).toBe(true)
    expect(result.vwapAnalysis.side).toBe('at')
  })

  it('vwapAnalysis is derived from the candles, not from the indicator snapshot', () => {
    // The indicator argument no longer carries VWAP into this module; passing a
    // fixture that claims a different value must not change the result.
    const withVwap = computeVolumeAnalysis(BASE_CANDLES, emptyIndicators({
      vwap: { available: true, value: 9999, unavailable: null, anchorTime: 0 },
    }), BASE_STRUCTURE, BASE_SR)
    const withoutVwap = computeVolumeAnalysis(BASE_CANDLES, BASE_INDICATORS, BASE_STRUCTURE, BASE_SR)
    expect(withVwap.vwapAnalysis).toEqual(withoutVwap.vwapAnalysis)
  })
})
