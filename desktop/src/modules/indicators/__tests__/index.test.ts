import { describe, it, expect } from 'vitest'
import { computeIndicators } from '../index'
import type { Candle } from '../../binance'

function makeCandle(close: number, i: number): Candle {
  return {
    openTime: i * 3600000,
    closeTime: i * 3600000 + 3599999,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100 + i * 10,
    quoteVolume: (close + 1) * (100 + i * 10),
    trades: 50,
    takerBuyVolume: (100 + i * 10) * 0.55,
    takerSellVolume: (100 + i * 10) * 0.45,
  }
}

function makeCandles(n: number, startPrice = 100, step = 1): Candle[] {
  return Array.from({ length: n }, (_, i) => makeCandle(startPrice + i * step, i))
}

describe('computeIndicators', () => {
  it('returns all-null indicators for an empty candle array', () => {
    const result = computeIndicators([])
    expect(result.ema20).toBeNull()
    expect(result.rsi).toBeNull()
    expect(result.macd).toBeNull()
    expect(result.obv).toBe(0)
    expect(result.vwap).toBe(0)
  })

  it('returns null for EMA200 when fewer than 200 candles are provided', () => {
    const result = computeIndicators(makeCandles(100))
    expect(result.ema200).toBeNull()
    expect(result.sma200).toBeNull()
  })

  it('returns non-null EMA20 with 20+ candles', () => {
    const result = computeIndicators(makeCandles(25))
    expect(result.ema20).not.toBeNull()
    expect(typeof result.ema20).toBe('number')
  })

  it('returns all indicators for 200 candles', () => {
    const result = computeIndicators(makeCandles(200))
    expect(result.ema20).not.toBeNull()
    expect(result.ema50).not.toBeNull()
    expect(result.ema100).not.toBeNull()
    expect(result.ema200).not.toBeNull()
    expect(result.sma20).not.toBeNull()
    expect(result.sma50).not.toBeNull()
    expect(result.sma200).not.toBeNull()
    expect(result.rsi).not.toBeNull()
    expect(result.macd).not.toBeNull()
    expect(result.atr).not.toBeNull()
    expect(result.atrPercent).not.toBeNull()
    expect(result.adx).not.toBeNull()
    expect(result.bollingerBands).not.toBeNull()
    expect(result.stochRsi).not.toBeNull()
    expect(result.mfi).not.toBeNull()
    expect(result.cci).not.toBeNull()
    expect(result.volumeMA).not.toBeNull()
  })

  it('OBV and VWAP are always numbers', () => {
    const result = computeIndicators(makeCandles(5))
    expect(typeof result.obv).toBe('number')
    expect(typeof result.vwap).toBe('number')
  })

  it('atrPercent equals (atr / lastClose) * 100', () => {
    const candles = makeCandles(30)
    const result = computeIndicators(candles)
    const lastClose = candles[candles.length - 1].close
    expect(result.atrPercent).toBeCloseTo((result.atr! / lastClose) * 100, 6)
  })

  it('MACD histogram equals macdLine minus signalLine', () => {
    const result = computeIndicators(makeCandles(60))
    const macd = result.macd!
    expect(macd.histogram).toBeCloseTo(macd.macdLine - macd.signalLine, 8)
  })

  it('RSI is between 0 and 100', () => {
    const result = computeIndicators(makeCandles(50))
    expect(result.rsi!).toBeGreaterThanOrEqual(0)
    expect(result.rsi!).toBeLessThanOrEqual(100)
  })

  it('Bollinger upper > middle > lower for non-constant prices', () => {
    const result = computeIndicators(makeCandles(30))
    const bb = result.bollingerBands!
    expect(bb.upper).toBeGreaterThan(bb.middle)
    expect(bb.middle).toBeGreaterThan(bb.lower)
  })

  it('returns MACD bias as bullish shortly after a sharp price jump', () => {
    // 26 flat bars warm up EMAs; 10 bars at higher price keeps MACD histogram positive
    const candles = [
      ...Array.from({ length: 26 }, (_, i) => makeCandle(100, i)),
      ...Array.from({ length: 10 }, (_, i) => makeCandle(200, 26 + i)),
    ]
    const result = computeIndicators(candles)
    expect(result.macd!.bias).toBe('bullish')
  })

  it('all numeric results are finite numbers (no NaN or Infinity)', () => {
    const result = computeIndicators(makeCandles(200))
    const numericFields = [
      result.ema20, result.ema50, result.ema100, result.ema200,
      result.sma20, result.sma50, result.sma200, result.rsi,
      result.atr, result.atrPercent, result.vwap, result.obv,
      result.mfi, result.cci,
    ]
    for (const v of numericFields) {
      if (v !== null) {
        expect(Number.isFinite(v)).toBe(true)
      }
    }
    if (result.macd) {
      expect(Number.isFinite(result.macd.macdLine)).toBe(true)
      expect(Number.isFinite(result.macd.signalLine)).toBe(true)
      expect(Number.isFinite(result.macd.histogram)).toBe(true)
    }
    if (result.adx) {
      expect(Number.isFinite(result.adx.adx)).toBe(true)
      expect(Number.isFinite(result.adx.diPlus)).toBe(true)
      expect(Number.isFinite(result.adx.diMinus)).toBe(true)
    }
  })
})
