import { describe, it, expect } from 'vitest'
import { checkConsistency } from '../validate/consistency'
import { DEFAULT_VALIDATION_CONFIG } from '../config'
import {
  makeValidResult, makeIndicators, makeStructure, makeVolumeAnalysis,
  makeTrendConditions, makeFullTrend, makeSupportResistance, makePriceZone,
} from './helpers'

describe('checkConsistency', () => {
  it('returns no issues when all conditions match raw data', () => {
    const result = makeValidResult()
    expect(checkConsistency(result, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  it('flags priceAboveEMA20 true when price is below EMA20', () => {
    // price=100, ema20=110 → priceAboveEMA20 should be false
    const result = makeValidResult({
      indicators: makeIndicators({ ema20: 110 }),
      fullTrend: makeFullTrend({
        // priceAboveEMA20 wrongly left as true
        conditions: makeTrendConditions({ priceAboveEMA20: true }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.priceAboveEMA20')).toBe(true)
  })

  it('flags priceAboveEMA20 true when EMA20 is null', () => {
    const result = makeValidResult({
      indicators: makeIndicators({ ema20: null }),
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({ priceAboveEMA20: true, priceAboveAllEMAs: false }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.priceAboveEMA20')).toBe(true)
  })

  it('flags priceBelowEMA50 true when price is above EMA50', () => {
    // price=100 > ema50=90 → priceBelowEMA50 should be false
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({ priceBelowEMA50: true }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.priceBelowEMA50')).toBe(true)
  })

  it('flags emaInBullishOrder true when EMA order is reversed', () => {
    // ema20=80, ema50=90, ema100=95, ema200=100 → bearish order, not bullish
    const result = makeValidResult({
      indicators: makeIndicators({ ema20: 80, ema50: 90, ema100: 95, ema200: 100 }),
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          priceAboveEMA20: true,
          priceAboveEMA50: true,
          priceAboveEMA100: true,
          priceAboveEMA200: true,
          priceAboveAllEMAs: true,
          emaInBullishOrder: true, // wrong
        }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.emaInBullishOrder')).toBe(true)
  })

  it('flags emaInBullishOrder true when any EMA is null', () => {
    const result = makeValidResult({
      indicators: makeIndicators({ ema200: null }),
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          emaInBullishOrder: true, // wrong: not all EMAs available
          priceAboveAllEMAs: false,
        }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.emaInBullishOrder')).toBe(true)
  })

  it('flags hasConsistentHHHL true when higherHighs is below minimum', () => {
    // HH=1 < min=2 → hasConsistentHHHL should be false
    const result = makeValidResult({
      marketStructure: makeStructure({
        structure: { higherHighs: 1, higherLows: 2, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 },
        recentStructure: { higherHighs: 1, higherLows: 2, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 },
      }),
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({ hasConsistentHHHL: true }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.hasConsistentHHHL')).toBe(true)
  })

  it('flags hasConsistentLHLL false when lowerHighs and lowerLows both meet minimum', () => {
    const result = makeValidResult({
      marketStructure: makeStructure({
        structure: { higherHighs: 0, higherLows: 0, lowerHighs: 2, lowerLows: 2, equalHighs: 0, equalLows: 0 },
        recentStructure: { higherHighs: 0, higherLows: 0, lowerHighs: 2, lowerLows: 2, equalHighs: 0, equalLows: 0 },
      }),
      fullTrend: makeFullTrend({
        bearishConditionsMet: 2,
        bullishConditionsMet: 2,
        trend: 'ranging',
        conditions: makeTrendConditions({
          priceAboveAllEMAs: false,
          emaInBullishOrder: false,
          hasConsistentHHHL: false,
          noConsistentStructure: false,
          hasConsistentLHLL: false, // wrong: should be true
        }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.hasConsistentLHLL')).toBe(true)
  })

  it('flags rsiSupportsBullish true when RSI is below rsiBullishMin', () => {
    // rsi=40 < rsiBullishMin=45 → rsiSupportsBullish should be false
    const result = makeValidResult({
      indicators: makeIndicators({ rsi: 40 }),
      indicatorSummary: {
        rsi: { value: 40, classification: 'weak_bearish' },
        macd: { histogram: 2, bias: 'bullish' },
        adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 65, d: 60, zone: 'neutral' },
      },
      fullTrend: makeFullTrend({
        bullishConditionsMet: 4,
        trend: 'moderate bullish',
        conditions: makeTrendConditions({ rsiSupportsBullish: true }), // wrong
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.rsiSupportsBullish')).toBe(true)
  })

  it('flags rsiSupportsBullish true when RSI is null', () => {
    const result = makeValidResult({
      indicators: makeIndicators({ rsi: null }),
      indicatorSummary: {
        rsi: { value: null, classification: 'unavailable' },
        macd: { histogram: 2, bias: 'bullish' },
        adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 65, d: 60, zone: 'neutral' },
      },
      fullTrend: makeFullTrend({
        bullishConditionsMet: 4,
        trend: 'moderate bullish',
        conditions: makeTrendConditions({ rsiSupportsBullish: true }), // wrong
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.rsiSupportsBullish')).toBe(true)
  })

  it('flags macdBullish true when MACD line is below signal line', () => {
    // macdLine=3, signalLine=5 → macdBullish should be false
    const result = makeValidResult({
      indicators: makeIndicators({ macd: { macdLine: 3, signalLine: 5, histogram: -2, previousHistogram: null, bias: 'bearish' } }),
      indicatorSummary: {
        rsi: { value: 65, classification: 'healthy_bullish' },
        macd: { histogram: -2, bias: 'bearish' },
        adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 65, d: 60, zone: 'neutral' },
      },
      fullTrend: makeFullTrend({
        bullishConditionsMet: 4,
        trend: 'moderate bullish',
        conditions: makeTrendConditions({ macdBullish: true }), // wrong
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.macdBullish')).toBe(true)
  })

  it('flags macdBearish true when MACD is null', () => {
    const result = makeValidResult({
      indicators: makeIndicators({ macd: null }),
      indicatorSummary: {
        rsi: { value: 65, classification: 'healthy_bullish' },
        macd: { histogram: null, bias: 'unavailable' },
        adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 65, d: 60, zone: 'neutral' },
      },
      fullTrend: makeFullTrend({
        bullishConditionsMet: 4,
        trend: 'moderate bullish',
        conditions: makeTrendConditions({ macdBullish: false, macdBearish: true }), // wrong
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.macdBearish')).toBe(true)
  })

  it('flags adxBelowWeakThreshold true when ADX is above threshold', () => {
    // adx=30 >= 20 (adxWeakThreshold) → adxBelowWeakThreshold should be false
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({ adxBelowWeakThreshold: true }),
        neutralConditionsMet: 1,
        trend: 'weak bullish',
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.adxBelowWeakThreshold')).toBe(true)
  })

  it('flags rsiInNeutralRange false when RSI is in neutral range', () => {
    // rsi=50, neutralLow=40, neutralHigh=60 → rsiInNeutralRange should be true
    const result = makeValidResult({
      indicators: makeIndicators({ rsi: 50 }),
      indicatorSummary: {
        rsi: { value: 50, classification: 'neutral' },
        macd: { histogram: 2, bias: 'bullish' },
        adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 65, d: 60, zone: 'neutral' },
      },
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          rsiSupportsBullish: true, // 50 >= 45 → true
          rsiSupportsBearish: true, // 50 <= 55 → true
          rsiInNeutralRange: false, // wrong: 50 is in [40,60]
        }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.rsiInNeutralRange')).toBe(true)
  })

  it('flags RSI classification mismatch when label disagrees with raw value', () => {
    // rsi=80 → 'overbought', but classification says 'neutral'
    const result = makeValidResult({
      indicators: makeIndicators({ rsi: 80 }),
      indicatorSummary: {
        rsi: { value: 80, classification: 'neutral' }, // wrong
        macd: { histogram: 2, bias: 'bullish' },
        adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 65, d: 60, zone: 'neutral' },
      },
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({ rsiSupportsBullish: true }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'indicatorSummary.rsi.classification')).toBe(true)
  })

  it('flags MACD bias mismatch when label disagrees with raw value', () => {
    // macdLine=5 > signalLine=3 → bias should be 'bullish', but says 'bearish'
    const result = makeValidResult({
      indicatorSummary: {
        rsi: { value: 65, classification: 'healthy_bullish' },
        macd: { histogram: 2, bias: 'bearish' }, // wrong
        adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 65, d: 60, zone: 'neutral' },
      },
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'indicatorSummary.macd.bias')).toBe(true)
  })

  it('flags insideSupport true when currentZone is null', () => {
    const result = makeValidResult({
      srContext: {
        nearestSupportDistance: null,
        nearestResistanceDistance: null,
        insideSupport: true, // wrong: no currentZone
        insideResistance: false,
        approachingSupport: false,
        approachingResistance: false,
        strongestActiveSupport: null,
        strongestActiveResistance: null,
      },
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'srContext.insideSupport')).toBe(true)
  })

  it('flags insideSupport false when currentZone is a support type', () => {
    const zone = makePriceZone('support', 95)
    const result = makeValidResult({
      supportResistance: makeSupportResistance({ currentZone: zone }),
      srContext: {
        nearestSupportDistance: null,
        nearestResistanceDistance: null,
        insideSupport: false, // wrong: currentZone is support
        insideResistance: false,
        approachingSupport: false,
        approachingResistance: false,
        strongestActiveSupport: null,
        strongestActiveResistance: null,
      },
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'srContext.insideSupport')).toBe(true)
  })

  it('flags volumeContext.relativeVolume when it differs from volumeAnalysis', () => {
    const result = makeValidResult({
      volumeContext: {
        relativeVolume: 0.5, // wrong: volumeAnalysis.ratio = 1.2
        volumeClassification: 'normal',
        confirmsCurrentMove: true,
        climaxSignal: 'none',
        accDistState: 'neutral',
        priceAboveVWAP: true,
        vwapDistancePercent: 8.7,
        respectingVWAP: false,
        obvDirection: 'bullish',
        obvConfirmingPrice: true,
        overallStrength: 5,
      },
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'volumeContext.relativeVolume')).toBe(true)
  })

  it('flags volumeContext.confirmsCurrentMove when it differs from volumeConfirmation.confirmed', () => {
    const result = makeValidResult({
      volumeContext: {
        relativeVolume: 1.2,
        volumeClassification: 'normal',
        confirmsCurrentMove: false, // wrong: volumeConfirmation.confirmed = true
        climaxSignal: 'none',
        accDistState: 'neutral',
        priceAboveVWAP: true,
        vwapDistancePercent: 8.7,
        respectingVWAP: false,
        obvDirection: 'bullish',
        obvConfirmingPrice: true,
        overallStrength: 5,
      },
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'volumeContext.confirmsCurrentMove')).toBe(true)
  })

  it('flags volumeContext.obvDirection when it differs from obvAnalysis.direction', () => {
    const result = makeValidResult({
      volumeContext: {
        relativeVolume: 1.2,
        volumeClassification: 'normal',
        confirmsCurrentMove: true,
        climaxSignal: 'none',
        accDistState: 'neutral',
        priceAboveVWAP: true,
        vwapDistancePercent: 8.7,
        respectingVWAP: false,
        obvDirection: 'bearish', // wrong: obvAnalysis.direction = 'bullish'
        obvConfirmingPrice: true,
        overallStrength: 5,
      },
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'volumeContext.obvDirection')).toBe(true)
  })

  it('flags noConsistentStructure when it disagrees with hasConsistentHHHL and hasConsistentLHLL', () => {
    // hasConsistentHHHL=true, hasConsistentLHLL=false → noConsistentStructure should be false
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          noConsistentStructure: true, // wrong: hasConsistentHHHL is true
        }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.noConsistentStructure')).toBe(true)
  })

  it('flags priceBetweenEMAsWithoutClearOrder when it disagrees with other EMA conditions', () => {
    // priceAboveAllEMAs=true → priceBetweenEMAsWithoutClearOrder should be false
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          priceBetweenEMAsWithoutClearOrder: true, // wrong: priceAboveAllEMAs is true
        }),
      }),
    })
    const issues = checkConsistency(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.conditions.priceBetweenEMAsWithoutClearOrder')).toBe(true)
  })
})
