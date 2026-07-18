import { describe, it, expect } from 'vitest'
import { computeAnalysis } from '../index'
import {
  marketData,
  indicators,
  bullishIndicators,
  bearishIndicators,
  bullishStructure,
  bearishStructure,
  emptyStructure,
  emptySupportResistance,
  emptyVolumeAnalysis,
  priceZone,
  macd,
  adx,
} from './helpers'
import type { VolumeAnalysisResult } from '../../volume-analysis/types'

const md = marketData(100)
const emptyInd = indicators()
const emptyStr = emptyStructure()
const emptySR = emptySupportResistance()
const emptyVol = emptyVolumeAnalysis()

describe('computeAnalysis', () => {
  describe('output shape', () => {
    it('returns all required top-level fields', () => {
      const result = computeAnalysis(md, emptyInd, emptyStr, emptySR, emptyVol)
      expect(result.symbol).toBe('BTCUSDT')
      expect(result.timeframe).toBe('1h')
      expect(typeof result.analysedAt).toBe('number')
      expect(result.price).toBeDefined()
      expect(result.fullTrend).toBeDefined()
      expect(result.emaContext).toBeDefined()
      expect(result.indicatorSummary).toBeDefined()
      expect(result.srContext).toBeDefined()
      expect(result.volumeContext).toBeDefined()
      expect(Array.isArray(result.evidence)).toBe(true)
    })

    it('includes pass-through raw results for Module 7', () => {
      const ind = bullishIndicators()
      const result = computeAnalysis(md, ind, emptyStr, emptySR, emptyVol)
      expect(result.indicators).toBe(ind)
      expect(result.marketStructure).toBe(emptyStr)
      expect(result.supportResistance).toBe(emptySR)
      expect(result.volumeAnalysis).toBe(emptyVol)
    })

    it('sets symbol and timeframe from marketData', () => {
      const data = marketData(100, { symbol: 'ETHUSDT', timeframe: '4h' })
      const result = computeAnalysis(data, emptyInd, emptyStr, emptySR, emptyVol)
      expect(result.symbol).toBe('ETHUSDT')
      expect(result.timeframe).toBe('4h')
    })
  })

  describe('staircase uptrend scenario', () => {
    it('identifies bullish trend when all 5 conditions are met', () => {
      const result = computeAnalysis(
        marketData(100),
        bullishIndicators(),
        bullishStructure(),
        emptySupportResistance(),
        emptyVolumeAnalysis(),
      )
      expect(result.fullTrend.trend).toBe('strong bullish')
    })

    it('emits bullish structure evidence', () => {
      const result = computeAnalysis(
        marketData(100),
        bullishIndicators(),
        bullishStructure(),
        emptySupportResistance(),
        emptyVolumeAnalysis(),
      )
      const factors = result.evidence.map((e) => e.factor)
      expect(factors).toContain('Higher High confirmed')
      expect(factors).toContain('Higher Low confirmed')
      expect(factors).toContain('EMA bullish alignment')
    })
  })

  describe('staircase downtrend scenario', () => {
    it('identifies bearish trend when all 5 conditions are met', () => {
      const result = computeAnalysis(
        marketData(100),
        bearishIndicators(),
        bearishStructure(),
        emptySupportResistance(),
        emptyVolumeAnalysis(),
      )
      expect(result.fullTrend.trend).toBe('strong bearish')
    })

    it('emits bearish structure evidence', () => {
      const result = computeAnalysis(
        marketData(100),
        bearishIndicators(),
        bearishStructure(),
        emptySupportResistance(),
        emptyVolumeAnalysis(),
      )
      const factors = result.evidence.map((e) => e.factor)
      expect(factors).toContain('Lower High confirmed')
      expect(factors).toContain('Lower Low confirmed')
      expect(factors).toContain('EMA bearish alignment')
    })
  })

  describe('ranging scenario', () => {
    it('identifies ranging when ADX is weak and RSI is neutral with no structure', () => {
      const ind = indicators({
        rsi: 50,
        adx: adx(15),
      })
      const result = computeAnalysis(marketData(100), ind, emptyStr, emptySR, emptyVol)
      expect(result.fullTrend.trend).toBe('ranging')
    })
  })

  describe('S/R integration', () => {
    it('includes approaching support evidence when support is within proximity', () => {
      const support = priceZone('support', 99)  // 1% below price 100
      const sr = { ...emptySupportResistance(), nearestSupport: support, activeSupport: [support] }
      const result = computeAnalysis(marketData(100), emptyInd, emptyStr, sr, emptyVol)
      const factors = result.evidence.map((e) => e.factor)
      expect(factors).toContain('Strong support below')
    })
  })

  describe('volume integration', () => {
    it('includes accumulation evidence when accDist state is accumulation', () => {
      const vol: VolumeAnalysisResult = {
        ...emptyVolumeAnalysis(),
        accumulationDistribution: { state: 'accumulation', score: 6 },
      }
      const result = computeAnalysis(marketData(100), emptyInd, emptyStr, emptySR, vol)
      expect(result.evidence.find((e) => e.factor === 'Accumulation detected')).toBeDefined()
    })
  })

  describe('config override', () => {
    it('respects custom rsiBullishMin threshold', () => {
      // With default rsiBullishMin=55, RSI=43 should NOT satisfy rsiSupportsBullish
      // With custom rsiBullishMin=40, RSI=43 should satisfy it
      const ind = indicators({
        ema20: 95, ema50: 90, ema100: 85, ema200: 80,
        rsi: 43,
        macd: macd(10, 5),
      })
      const defaultResult = computeAnalysis(marketData(100), ind, bullishStructure(), emptySR, emptyVol)
      const customResult = computeAnalysis(
        marketData(100), ind, bullishStructure(), emptySR, emptyVol,
        { rsiBullishMin: 40 },
      )
      expect(defaultResult.fullTrend.conditions.rsiSupportsBullish).toBe(false)
      expect(customResult.fullTrend.conditions.rsiSupportsBullish).toBe(true)
    })
  })

  describe('determinism', () => {
    it('produces identical output for identical inputs called twice', () => {
      const ind = bullishIndicators()
      const str = bullishStructure()
      const result1 = computeAnalysis(md, ind, str, emptySR, emptyVol)
      const result2 = computeAnalysis(md, ind, str, emptySR, emptyVol)
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2))
    })
  })

  describe('invalid/empty input handling', () => {
    it('does not throw when all inputs are empty', () => {
      expect(() => computeAnalysis(md, emptyInd, emptyStr, emptySR, emptyVol)).not.toThrow()
    })

    it('returns ranging when no indicator data is available', () => {
      const result = computeAnalysis(md, emptyInd, emptyStr, emptySR, emptyVol)
      expect(result.fullTrend.trend).toBe('ranging')
    })

    it('fullTrend.bullishConditionsMet is 0 when all indicators are null', () => {
      const result = computeAnalysis(md, emptyInd, emptyStr, emptySR, emptyVol)
      expect(result.fullTrend.bullishConditionsMet).toBe(0)
    })
  })

  describe('cross-field consistency', () => {
    it('strong bullish trend has bullishConditionsMet = 5', () => {
      const result = computeAnalysis(
        marketData(100), bullishIndicators(), bullishStructure(), emptySR, emptyVol,
      )
      expect(result.fullTrend.trend).toBe('strong bullish')
      expect(result.fullTrend.bullishConditionsMet).toBe(5)
    })

    it('strong bearish trend has bearishConditionsMet = 5', () => {
      const result = computeAnalysis(
        marketData(100), bearishIndicators(), bearishStructure(), emptySR, emptyVol,
      )
      expect(result.fullTrend.trend).toBe('strong bearish')
      expect(result.fullTrend.bearishConditionsMet).toBe(5)
    })

    it('all evidence items have non-empty factor strings', () => {
      const result = computeAnalysis(
        marketData(100), bullishIndicators(), bullishStructure(), emptySR, emptyVol,
      )
      for (const e of result.evidence) {
        expect(e.factor.length).toBeGreaterThan(0)
      }
    })
  })
})
