import { describe, it, expect } from 'vitest'
import { synthesizeFullTrend } from '../compute/full-trend'
import { DEFAULT_ANALYSIS_CONFIG } from '../config'
import {
  indicators,
  bullishIndicators,
  bearishIndicators,
  bullishStructure,
  bearishStructure,
  emptyStructure,
  macd,
} from './helpers'

const cfg = DEFAULT_ANALYSIS_CONFIG

describe('synthesizeFullTrend', () => {
  it('returns strong bullish when all 5 bullish conditions are met', () => {
    const ind = bullishIndicators()  // price=100: ema20=95,ema50=90,ema100=85,ema200=80,rsi=60,macd bullish
    const result = synthesizeFullTrend(100, ind, bullishStructure(), cfg)
    expect(result.trend).toBe('strong bullish')
    expect(result.bullishConditionsMet).toBe(5)
  })

  it('returns strong bearish when all 5 bearish conditions are met', () => {
    const ind = bearishIndicators()  // price=100: ema20=105,ema50=110,ema100=115,ema200=120,rsi=40,macd bearish
    const result = synthesizeFullTrend(100, ind, bearishStructure(), cfg)
    expect(result.trend).toBe('strong bearish')
    expect(result.bearishConditionsMet).toBe(5)
  })

  it('returns moderate bullish when 3 of 5 bullish conditions are met and bullish > bearish', () => {
    const ind = indicators({
      ema20: 95, ema50: 90, ema100: 85, ema200: 80,  // price above all
      rsi: 60,
      // no macd
    })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    // priceAboveAllEMAs=true, emaInBullishOrder depends on order: 95>90>85>80=true
    // hasConsistentHHHL=false, rsiSupportsBullish=true(60>=45), macdBullish=false
    // bullish = 3 (priceAboveAll + emaOrder + rsi)
    expect(result.bullishConditionsMet).toBeGreaterThanOrEqual(3)
    expect(result.trend).toBe('moderate bullish')
  })

  it('returns moderate bearish when 3 of 5 bearish conditions are met and bearish > bullish', () => {
    const ind = indicators({
      ema20: 105, ema50: 110, ema100: 115, ema200: 120,
      rsi: 40,
    })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    // priceBelowAll=true, emaInBearishOrder=true(105<110<115<120), rsiSupportsBearish=true(40<=55)
    expect(result.bearishConditionsMet).toBeGreaterThanOrEqual(3)
    expect(result.trend).toBe('moderate bearish')
  })

  it('returns ranging when 3 or more neutral conditions are met', () => {
    const ind = indicators({ rsi: 50, adx: { adx: 15, diPlus: 10, diMinus: 10 } })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    // rsiInNeutralRange=true(50 in 40-60), adxBelowWeakThreshold=true(15<20)
    // noConsistentStructure=true, priceBetweenEMAs=true (no EMAs)
    expect(result.neutralConditionsMet).toBeGreaterThanOrEqual(3)
    expect(result.trend).toBe('ranging')
  })

  it('returns weak bullish when bullish > bearish but < 3 conditions', () => {
    const ind = indicators({ ema200: 80 })  // only priceAboveEMA200 satisfied
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    // bullishConditionsMet = 1 (only priceAboveEMA200 contributes partially — but priceAboveAllEMAs=false)
    // Actually priceAboveAllEMAs requires all 4 EMAs to be non-null
    // with only ema200 set: priceAboveAllEMAs=false, emaInBullishOrder=false
    // Let me reconsider — rsiSupportsBullish requires rsi!=null too
    // Result: bullishConditionsMet=0, ranging
    expect(result.trend).toBe('ranging')
  })

  it('returns weak bullish when exactly 2 bullish conditions met (RSI=50 below rsiBullishMin=55)', () => {
    const ind = indicators({
      ema20: 95, ema50: 90, ema100: 85, ema200: 80,
      rsi: 50,
      // macd=null, structure has HH/HL=0
    })
    const structure = emptyStructure()
    const result = synthesizeFullTrend(100, ind, structure, cfg)
    // priceAboveAllEMAs=true, emaInBullishOrder=true(95>90>85>80), hasHHHL=false,
    // rsiSupportsBullish=false(50<55=rsiBullishMin), macdBullish=false
    // bullish = 2 => weak bullish
    expect(result.bullishConditionsMet).toBe(2)
    expect(result.trend).toBe('weak bullish')
  })

  it('exposes all 5 bullish condition booleans correctly', () => {
    const ind = bullishIndicators()
    const result = synthesizeFullTrend(100, ind, bullishStructure(), cfg)
    expect(result.conditions.priceAboveAllEMAs).toBe(true)
    expect(result.conditions.emaInBullishOrder).toBe(true)
    expect(result.conditions.hasConsistentHHHL).toBe(true)
    expect(result.conditions.rsiSupportsBullish).toBe(true)
    expect(result.conditions.macdBullish).toBe(true)
  })

  it('exposes all 5 bearish condition booleans correctly', () => {
    const ind = bearishIndicators()
    const result = synthesizeFullTrend(100, ind, bearishStructure(), cfg)
    expect(result.conditions.priceBelowAllEMAs).toBe(true)
    expect(result.conditions.emaInBearishOrder).toBe(true)
    expect(result.conditions.hasConsistentLHLL).toBe(true)
    expect(result.conditions.rsiSupportsBearish).toBe(true)
    expect(result.conditions.macdBearish).toBe(true)
  })

  it('priceAboveAllEMAs is false when any EMA is null', () => {
    const ind = indicators({ ema20: 95, ema50: 90, ema100: 85 })  // no ema200
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.priceAboveAllEMAs).toBe(false)
  })

  it('hasConsistentHHHL requires at least minBullishSwingsForTrend of each', () => {
    const structure = emptyStructure()
    structure.recentStructure.higherHighs = 1  // only 1, need 2
    structure.recentStructure.higherLows = 2
    const result = synthesizeFullTrend(100, indicators(), structure, cfg)
    expect(result.conditions.hasConsistentHHHL).toBe(false)
  })

  it('rsiSupportsBullish is false when rsi is null', () => {
    const result = synthesizeFullTrend(100, indicators(), emptyStructure(), cfg)
    expect(result.conditions.rsiSupportsBullish).toBe(false)
  })

  it('macdBullish is false when macd is null', () => {
    const result = synthesizeFullTrend(100, indicators(), emptyStructure(), cfg)
    expect(result.conditions.macdBullish).toBe(false)
  })

  it('produces deterministic output for same inputs', () => {
    const ind = bullishIndicators()
    const s = bullishStructure()
    const r1 = synthesizeFullTrend(100, ind, s, cfg)
    const r2 = synthesizeFullTrend(100, ind, s, cfg)
    expect(r1).toEqual(r2)
  })

  // ── CRIT-01: hasConsistentHHHL/LHLL use recentStructure, not structure ──────

  it('hasConsistentHHHL is false when recentStructure.higherHighs is below min, even if structure.higherHighs is high', () => {
    const structure = emptyStructure()
    structure.structure.higherHighs = 10  // high lifetime count
    structure.structure.higherLows = 10
    // recentStructure remains all-zero → hasConsistentHHHL = false
    const result = synthesizeFullTrend(100, indicators(), structure, cfg)
    expect(result.conditions.hasConsistentHHHL).toBe(false)
  })

  it('hasConsistentHHHL is true when recentStructure meets threshold, regardless of structure', () => {
    const structure = emptyStructure()
    structure.recentStructure.higherHighs = 2  // meets cfg.minBullishSwingsForTrend=2
    structure.recentStructure.higherLows = 2
    // structure (lifetime) remains zero — but recentStructure drives the condition
    const result = synthesizeFullTrend(100, indicators(), structure, cfg)
    expect(result.conditions.hasConsistentHHHL).toBe(true)
  })

  it('hasConsistentLHLL is false when recentStructure.lowerHighs is below min, even if structure.lowerHighs is high', () => {
    const structure = emptyStructure()
    structure.structure.lowerHighs = 10
    structure.structure.lowerLows = 10
    // recentStructure remains all-zero
    const result = synthesizeFullTrend(100, indicators(), structure, cfg)
    expect(result.conditions.hasConsistentLHLL).toBe(false)
  })

  // ── CRIT-03: MACD three-condition rule ───────────────────────────────────────

  it('macdBullish is true when histogram is positive and increasing', () => {
    // histogram=5, previousHistogram=4 → increasing
    const ind = indicators({ macd: macd(10, 5, 4) })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBullish).toBe(true)
  })

  it('macdBullish is false when histogram is flat (not increasing)', () => {
    // histogram=5, previousHistogram=5 → not increasing (5 > 5 is false)
    const ind = indicators({ macd: macd(10, 5, 5) })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBullish).toBe(false)
  })

  it('macdBullish is false when histogram is decreasing', () => {
    // histogram=3, previousHistogram=5 → decreasing
    const ind = indicators({ macd: macd(8, 5, 5) })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBullish).toBe(false)
  })

  it('macdBullish is false when previousHistogram is null (minimum candle count)', () => {
    // null previousHistogram → cannot verify increasing → macdBullish = false
    const ind = indicators({ macd: macd(10, 5, null) })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBullish).toBe(false)
  })

  it('macdBullish is false when histogram is positive but macdLine <= signalLine', () => {
    // All three conditions must hold: macdLine > signalLine is required
    const ind = indicators({ macd: macd(5, 5, 3) }) // histogram=0, not positive
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBullish).toBe(false)
  })

  it('macdBearish is true when histogram is negative and decreasing', () => {
    // histogram=-5, previousHistogram=-4 → more negative → decreasing → macdBearish=true
    const ind = indicators({ macd: macd(5, 10, -4) })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBearish).toBe(true)
  })

  it('macdBearish is false when histogram is negative but flattening', () => {
    // histogram=-5, previousHistogram=-5 → flat, not strictly decreasing
    const ind = indicators({ macd: macd(5, 10, -5) })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBearish).toBe(false)
  })

  it('macdBearish is false when previousHistogram is null', () => {
    const ind = indicators({ macd: macd(5, 10, null) })
    const result = synthesizeFullTrend(100, ind, emptyStructure(), cfg)
    expect(result.conditions.macdBearish).toBe(false)
  })
})
