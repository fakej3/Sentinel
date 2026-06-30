import { describe, it, expect } from 'vitest'
import { interpretIndicators } from '../compute/indicators'
import { DEFAULT_ANALYSIS_CONFIG } from '../config'
import { indicators, macd, adx, bollinger, stochRsi } from './helpers'

const cfg = DEFAULT_ANALYSIS_CONFIG

describe('interpretIndicators', () => {
  describe('RSI classification', () => {
    it('classifies RSI < 30 as oversold', () => {
      const result = interpretIndicators(100, indicators({ rsi: 25 }), cfg)
      expect(result.rsi.classification).toBe('oversold')
    })

    it('classifies RSI 30–45 as weak_bearish', () => {
      const result = interpretIndicators(100, indicators({ rsi: 37 }), cfg)
      expect(result.rsi.classification).toBe('weak_bearish')
    })

    it('classifies RSI 45–55 as neutral', () => {
      const result = interpretIndicators(100, indicators({ rsi: 50 }), cfg)
      expect(result.rsi.classification).toBe('neutral')
    })

    it('classifies RSI 55–70 as healthy_bullish', () => {
      const result = interpretIndicators(100, indicators({ rsi: 62 }), cfg)
      expect(result.rsi.classification).toBe('healthy_bullish')
    })

    it('classifies RSI > 70 as overbought', () => {
      const result = interpretIndicators(100, indicators({ rsi: 75 }), cfg)
      expect(result.rsi.classification).toBe('overbought')
    })

    it('returns unavailable when RSI is null', () => {
      const result = interpretIndicators(100, indicators(), cfg)
      expect(result.rsi.classification).toBe('unavailable')
      expect(result.rsi.value).toBeNull()
    })
  })

  describe('MACD bias', () => {
    it('returns bullish bias when MACD line above signal', () => {
      const result = interpretIndicators(100, indicators({ macd: macd(10, 5) }), cfg)
      expect(result.macd.bias).toBe('bullish')
    })

    it('returns bearish bias when MACD line below signal', () => {
      const result = interpretIndicators(100, indicators({ macd: macd(5, 10) }), cfg)
      expect(result.macd.bias).toBe('bearish')
    })

    it('returns neutral when MACD line equals signal', () => {
      const result = interpretIndicators(100, indicators({ macd: macd(10, 10) }), cfg)
      expect(result.macd.bias).toBe('neutral')
    })

    it('returns unavailable when MACD is null', () => {
      const result = interpretIndicators(100, indicators(), cfg)
      expect(result.macd.bias).toBe('unavailable')
    })
  })

  describe('ADX trend strength', () => {
    it('classifies ADX < 20 as weak', () => {
      const result = interpretIndicators(100, indicators({ adx: adx(15) }), cfg)
      expect(result.adx.trendStrength).toBe('weak')
    })

    it('classifies ADX 20–25 as emerging', () => {
      const result = interpretIndicators(100, indicators({ adx: adx(22) }), cfg)
      expect(result.adx.trendStrength).toBe('emerging')
    })

    it('classifies ADX 25–40 as strong', () => {
      const result = interpretIndicators(100, indicators({ adx: adx(30) }), cfg)
      expect(result.adx.trendStrength).toBe('strong')
    })

    it('classifies ADX 40–60 as very_strong', () => {
      const result = interpretIndicators(100, indicators({ adx: adx(50) }), cfg)
      expect(result.adx.trendStrength).toBe('very_strong')
    })

    it('classifies ADX > 60 as extreme', () => {
      const result = interpretIndicators(100, indicators({ adx: adx(65) }), cfg)
      expect(result.adx.trendStrength).toBe('extreme')
    })

    it('returns bullish direction when diPlus > diMinus', () => {
      const result = interpretIndicators(100, indicators({ adx: adx(30, 25, 15) }), cfg)
      expect(result.adx.dominantDirection).toBe('bullish')
    })

    it('returns bearish direction when diMinus > diPlus', () => {
      const result = interpretIndicators(100, indicators({ adx: adx(30, 10, 20) }), cfg)
      expect(result.adx.dominantDirection).toBe('bearish')
    })

    it('returns unavailable when ADX is null', () => {
      const result = interpretIndicators(100, indicators(), cfg)
      expect(result.adx.trendStrength).toBe('unavailable')
      expect(result.adx.dominantDirection).toBe('unavailable')
    })
  })

  describe('Bollinger Bands interpretation', () => {
    it('detects price above upper band', () => {
      const result = interpretIndicators(105, indicators({ bollingerBands: bollinger(103, 100, 97) }), cfg)
      expect(result.bollinger.priceRelativeToBands).toBe('above_upper')
    })

    it('detects price below lower band', () => {
      const result = interpretIndicators(95, indicators({ bollingerBands: bollinger(103, 100, 97) }), cfg)
      expect(result.bollinger.priceRelativeToBands).toBe('below_lower')
    })

    it('detects price inside bands', () => {
      const result = interpretIndicators(100, indicators({ bollingerBands: bollinger(103, 100, 97) }), cfg)
      expect(result.bollinger.priceRelativeToBands).toBe('inside')
    })

    it('returns unavailable when Bollinger is null', () => {
      const result = interpretIndicators(100, indicators(), cfg)
      expect(result.bollinger.priceRelativeToBands).toBe('unavailable')
      expect(result.bollinger.bandwidthState).toBe('unavailable')
    })
  })

  describe('StochRSI zone', () => {
    it('returns overbought when K >= overbought threshold', () => {
      const result = interpretIndicators(100, indicators({ stochRsi: stochRsi(85, 80) }), cfg)
      expect(result.stochRsi.zone).toBe('overbought')
    })

    it('returns oversold when K <= oversold threshold', () => {
      const result = interpretIndicators(100, indicators({ stochRsi: stochRsi(15, 20) }), cfg)
      expect(result.stochRsi.zone).toBe('oversold')
    })

    it('returns neutral in the middle range', () => {
      const result = interpretIndicators(100, indicators({ stochRsi: stochRsi(50, 45) }), cfg)
      expect(result.stochRsi.zone).toBe('neutral')
    })

    it('returns unavailable when StochRSI is null', () => {
      const result = interpretIndicators(100, indicators(), cfg)
      expect(result.stochRsi.zone).toBe('unavailable')
    })
  })

  it('produces deterministic output for same inputs', () => {
    const ind = indicators({ rsi: 60, macd: macd(10, 5), adx: adx(30) })
    const r1 = interpretIndicators(100, ind, cfg)
    const r2 = interpretIndicators(100, ind, cfg)
    expect(r1).toEqual(r2)
  })
})
