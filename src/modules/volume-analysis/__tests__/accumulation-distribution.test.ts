import { describe, it, expect } from 'vitest'
import { computeAccumulationDistribution } from '../compute/accumulation-distribution'
import { emptyStructure, emptySupportResistance } from './helpers'
import type { BuySellPressureResult, OBVAnalysisResult, VWAPAnalysisResult } from '../types'

function pressure(side: 'buyers' | 'sellers' | 'balanced'): BuySellPressureResult {
  return { buyVolume: 1000, sellVolume: 1000, delta: 0, deltaPercent: 0, dominantSide: side }
}

function obv(dir: 'bullish' | 'bearish' | 'neutral', confirming = false, diverging = false): OBVAnalysisResult {
  return { direction: dir, confirmingPrice: confirming, diverging }
}

function vwap(above: boolean): VWAPAnalysisResult {
  return { above, below: !above, distancePercent: 1, respectingVWAP: false }
}

describe('computeAccumulationDistribution', () => {
  it('returns neutral when all signals are absent', () => {
    const result = computeAccumulationDistribution(
      emptyStructure(), emptySupportResistance(),
      pressure('balanced'), obv('neutral'), vwap(true),
    )
    expect(result.state).toBe('neutral')
  })

  it('accumulation when multiple bullish signals align', () => {
    const structure = {
      ...emptyStructure(),
      trend: 'bullish' as const,
      bos: {
        detected: true,
        events: [{ type: 'BOS' as const, index: 0, timestamp: 0, level: 100, direction: 'bullish' as const }],
        last: { type: 'BOS' as const, index: 0, timestamp: 0, level: 100, direction: 'bullish' as const },
      },
      choch: {
        detected: true,
        events: [{ type: 'CHOCH' as const, index: 0, timestamp: 0, level: 100, direction: 'bullish' as const }],
        last: { type: 'CHOCH' as const, index: 0, timestamp: 0, level: 100, direction: 'bullish' as const },
      },
    }
    const result = computeAccumulationDistribution(
      structure, emptySupportResistance(),
      pressure('buyers'), obv('bullish', true), vwap(true),
    )
    expect(result.state).toBe('accumulation')
    expect(result.score).toBeGreaterThan(3)
  })

  it('distribution when multiple bearish signals align', () => {
    const structure = {
      ...emptyStructure(),
      trend: 'bearish' as const,
      bos: {
        detected: true,
        events: [{ type: 'BOS' as const, index: 0, timestamp: 0, level: 100, direction: 'bearish' as const }],
        last: { type: 'BOS' as const, index: 0, timestamp: 0, level: 100, direction: 'bearish' as const },
      },
      choch: {
        detected: true,
        events: [{ type: 'CHOCH' as const, index: 0, timestamp: 0, level: 100, direction: 'bearish' as const }],
        last: { type: 'CHOCH' as const, index: 0, timestamp: 0, level: 100, direction: 'bearish' as const },
      },
    }
    const result = computeAccumulationDistribution(
      structure, emptySupportResistance(),
      pressure('sellers'), obv('bearish', true), vwap(false),
    )
    expect(result.state).toBe('distribution')
    expect(result.score).toBeLessThan(-3)
  })

  it('score is clamped to [-10, 10]', () => {
    const result = computeAccumulationDistribution(
      emptyStructure(), emptySupportResistance(),
      pressure('balanced'), obv('neutral'), vwap(true),
    )
    expect(result.score).toBeGreaterThanOrEqual(-10)
    expect(result.score).toBeLessThanOrEqual(10)
  })
})
