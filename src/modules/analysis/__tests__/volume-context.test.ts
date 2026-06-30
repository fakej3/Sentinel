import { describe, it, expect } from 'vitest'
import { buildVolumeContext } from '../compute/volume-context'
import { emptyVolumeAnalysis } from './helpers'
import type { VolumeAnalysisResult } from '../../volume-analysis/types'

function vol(overrides: Partial<VolumeAnalysisResult> = {}): VolumeAnalysisResult {
  return { ...emptyVolumeAnalysis(), ...overrides }
}

describe('buildVolumeContext', () => {
  it('projects relativeVolume.ratio', () => {
    const result = buildVolumeContext(vol({
      relativeVolume: { current: 1500, average: 1000, ratio: 1.5, classification: 'high' },
    }))
    expect(result.relativeVolume).toBe(1.5)
  })

  it('projects volumeClassification', () => {
    const result = buildVolumeContext(vol({
      relativeVolume: { current: 1500, average: 1000, ratio: 1.5, classification: 'high' },
    }))
    expect(result.volumeClassification).toBe('high')
  })

  it('projects volumeConfirmation.confirmed as confirmsCurrentMove', () => {
    const result = buildVolumeContext(vol({
      volumeConfirmation: {
        confirmed: true,
        reason: 'High volume',
        supportsTrend: true,
        supportsBreakout: false,
        supportsBOS: false,
        supportsCHOCH: false,
      },
    }))
    expect(result.confirmsCurrentMove).toBe(true)
  })

  it('sets climaxSignal to buying_climax when buyingClimax is true', () => {
    const result = buildVolumeContext(vol({
      climax: { buyingClimax: true, sellingClimax: false, exhaustion: false },
    }))
    expect(result.climaxSignal).toBe('buying_climax')
  })

  it('sets climaxSignal to selling_climax when sellingClimax is true', () => {
    const result = buildVolumeContext(vol({
      climax: { buyingClimax: false, sellingClimax: true, exhaustion: false },
    }))
    expect(result.climaxSignal).toBe('selling_climax')
  })

  it('sets climaxSignal to exhaustion when exhaustion is true', () => {
    const result = buildVolumeContext(vol({
      climax: { buyingClimax: false, sellingClimax: false, exhaustion: true },
    }))
    expect(result.climaxSignal).toBe('exhaustion')
  })

  it('sets climaxSignal to none when no climax detected', () => {
    const result = buildVolumeContext(emptyVolumeAnalysis())
    expect(result.climaxSignal).toBe('none')
  })

  it('buyingClimax takes precedence over exhaustion', () => {
    const result = buildVolumeContext(vol({
      climax: { buyingClimax: true, sellingClimax: false, exhaustion: true },
    }))
    expect(result.climaxSignal).toBe('buying_climax')
  })

  it('projects VWAP analysis fields', () => {
    const result = buildVolumeContext(vol({
      vwapAnalysis: { above: false, below: true, distancePercent: -1.5, respectingVWAP: false },
    }))
    expect(result.priceAboveVWAP).toBe(false)
    expect(result.vwapDistancePercent).toBe(-1.5)
    expect(result.respectingVWAP).toBe(false)
  })

  it('projects OBV analysis fields', () => {
    const result = buildVolumeContext(vol({
      obvAnalysis: { direction: 'bullish', confirmingPrice: true, diverging: false },
    }))
    expect(result.obvDirection).toBe('bullish')
    expect(result.obvConfirmingPrice).toBe(true)
  })

  it('projects accDistState', () => {
    const result = buildVolumeContext(vol({
      accumulationDistribution: { state: 'accumulation', score: 5 },
    }))
    expect(result.accDistState).toBe('accumulation')
  })

  it('projects overallStrength', () => {
    const result = buildVolumeContext(vol({ overallStrength: 7.5 }))
    expect(result.overallStrength).toBe(7.5)
  })

  it('produces deterministic output', () => {
    const v = emptyVolumeAnalysis()
    const r1 = buildVolumeContext(v)
    const r2 = buildVolumeContext(v)
    expect(r1).toEqual(r2)
  })
})
