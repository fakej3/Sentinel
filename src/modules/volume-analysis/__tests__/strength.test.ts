import { describe, it, expect } from 'vitest'
import { computeOverallStrength } from '../compute/strength'
import type {
  RelativeVolumeResult,
  VolumeTrendResult,
  BuySellPressureResult,
  OBVAnalysisResult,
  AccumulationDistributionResult,
} from '../types'

function relVol(classification: RelativeVolumeResult['classification']): RelativeVolumeResult {
  return { current: 1000, average: 1000, ratio: 1, classification }
}

function trend(confidence: number): VolumeTrendResult {
  return { direction: 'flat', confidence, evidence: [] }
}

function pressure(deltaPercent: number): BuySellPressureResult {
  const side = Math.abs(deltaPercent) < 10 ? 'balanced'
    : deltaPercent > 0 ? 'buyers' : 'sellers'
  return { buyVolume: 1000, sellVolume: 1000, delta: 0, deltaPercent, dominantSide: side }
}

function obv(confirming: boolean): OBVAnalysisResult {
  return { direction: 'neutral', confirmingPrice: confirming, diverging: false }
}

function accDist(score: number): AccumulationDistributionResult {
  const state = score > 3 ? 'accumulation' : score < -3 ? 'distribution' : 'neutral'
  return { state, score }
}

describe('computeOverallStrength', () => {
  it('returns a value in range [0, 10]', () => {
    const s = computeOverallStrength(relVol('normal'), trend(5), pressure(0), obv(false), accDist(0))
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(10)
  })

  it('very_high volume contributes more than very_low', () => {
    const high = computeOverallStrength(relVol('very_high'), trend(0), pressure(0), obv(false), accDist(0))
    const low  = computeOverallStrength(relVol('very_low'),  trend(0), pressure(0), obv(false), accDist(0))
    expect(high).toBeGreaterThan(low)
  })

  it('OBV confirming price adds to score', () => {
    const with_   = computeOverallStrength(relVol('normal'), trend(5), pressure(0), obv(true),  accDist(0))
    const without = computeOverallStrength(relVol('normal'), trend(5), pressure(0), obv(false), accDist(0))
    expect(with_).toBeGreaterThan(without)
  })

  it('accumulation score pushes strength higher than distribution', () => {
    const acc  = computeOverallStrength(relVol('normal'), trend(5), pressure(0), obv(false), accDist(8))
    const dist = computeOverallStrength(relVol('normal'), trend(5), pressure(0), obv(false), accDist(-8))
    expect(acc).toBeGreaterThan(dist)
  })

  it('high trend confidence adds to score', () => {
    const highConf = computeOverallStrength(relVol('normal'), trend(10), pressure(0), obv(false), accDist(0))
    const lowConf  = computeOverallStrength(relVol('normal'), trend(0),  pressure(0), obv(false), accDist(0))
    expect(highConf).toBeGreaterThan(lowConf)
  })
})
