/**
 * Technical Indicator Engine — computes all indicators from raw OHLCV candles.
 * Pure mathematical calculations; no interpretation, no decisions.
 * Individual indicators return null when insufficient data is available.
 *
 * Inputs:  Candle[] (200+ recommended for EMA200 accuracy)
 * Outputs: IndicatorResult (RSI, MACD, EMA, ATR, ADX, VWAP, Bollinger, StochRSI,
 *          OBV, MFI, CCI, VolumeMA, etc.)
 * Deps:    binance (Candle type only)
 */
import type { Candle } from '../binance'
import type { IndicatorResult } from './types'
import { computeEma } from './compute/ema'
import { computeSma } from './compute/sma'
import { computeRsi } from './compute/rsi'
import { computeMacd } from './compute/macd'
import { computeAtr } from './compute/atr'
import { computeAdx } from './compute/adx'
import { computeVwap } from './compute/vwap'
import { computeBollinger } from './compute/bollinger'
import { computeStochRsi } from './compute/stoch-rsi'
import { computeObv } from './compute/obv'
import { computeMfi } from './compute/mfi'
import { computeCci } from './compute/cci'
import { computeVolumeMa } from './compute/volume-ma'

export type {
  IndicatorResult,
  MACDResult,
  ADXResult,
  BollingerResult,
  StochRSIResult,
  VolumeMaResult,
} from './types'

// Exported for downstream modules that need ATR without running the full indicator suite.
// Module 4 (Support & Resistance) uses this to compute zone widths per ENGINE_RULES.md §12.2.
export { computeAtr } from './compute/atr'

const NULL_RESULT: IndicatorResult = {
  ema20: null, ema50: null, ema100: null, ema200: null,
  sma20: null, sma50: null, sma200: null,
  rsi: null, macd: null, atr: null, atrPercent: null, adx: null,
  vwap: 0, bollingerBands: null, stochRsi: null, obv: 0,
  mfi: null, cci: null, volumeMA: null,
}

/**
 * Computes all technical indicators from a Candle array.
 * Individual indicators return null when insufficient candle data is available.
 * For full accuracy on all indicators (including EMA200), provide 200+ candles.
 */
export function computeIndicators(candles: Candle[]): IndicatorResult {
  if (candles.length === 0) return { ...NULL_RESULT }

  const closes = candles.map(c => c.close)
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  const volumes = candles.map(c => c.volume)
  const lastClose = closes[closes.length - 1]

  const atr = computeAtr(highs, lows, closes)

  return {
    ema20: computeEma(closes, 20),
    ema50: computeEma(closes, 50),
    ema100: computeEma(closes, 100),
    ema200: computeEma(closes, 200),
    sma20: computeSma(closes, 20),
    sma50: computeSma(closes, 50),
    sma200: computeSma(closes, 200),
    rsi: computeRsi(closes),
    macd: computeMacd(closes),
    atr,
    atrPercent: atr !== null && lastClose > 0 ? (atr / lastClose) * 100 : null,
    adx: computeAdx(highs, lows, closes),
    vwap: computeVwap(highs, lows, closes, volumes),
    bollingerBands: computeBollinger(closes),
    stochRsi: computeStochRsi(closes),
    obv: computeObv(closes, volumes),
    mfi: computeMfi(highs, lows, closes, volumes),
    cci: computeCci(highs, lows, closes),
    volumeMA: computeVolumeMa(volumes),
  }
}
