import { BinanceApiError, spotRequest, futuresRequest } from './client'
import {
  normaliseCandles,
  normaliseTicker24h,
  normaliseFuturesTicker24h,
  normaliseFundingRate,
  normaliseOpenInterest,
  type RawCandle,
  type RawTicker24h,
  type RawFuturesTicker24h,
  type RawFundingRate,
  type RawOpenInterest,
} from './normalise'
import type { Candle, Ticker24h, FundingRate, OpenInterest, Timeframe } from './types'
import { DEFAULT_CANDLE_LIMIT, MAX_CANDLE_LIMIT } from './constants'

export type MarketType = 'spot' | 'futures'

export async function fetchCandlesAuto(
  symbol: string,
  interval: Timeframe,
  limit: number = DEFAULT_CANDLE_LIMIT,
): Promise<{ candles: Candle[]; market: MarketType }> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_CANDLE_LIMIT)
  try {
    const raw = await spotRequest<RawCandle[]>('/api/v3/klines', { symbol, interval, limit: safeLimit })
    return { candles: normaliseCandles(raw), market: 'spot' }
  } catch (err) {
    if (err instanceof BinanceApiError && err.statusCode === 400) {
      const raw = await futuresRequest<RawCandle[]>('/fapi/v1/klines', { symbol, interval, limit: safeLimit })
      return { candles: normaliseCandles(raw), market: 'futures' }
    }
    throw err
  }
}

export async function fetchTicker24hAuto(symbol: string): Promise<{ ticker: Ticker24h; market: MarketType }> {
  try {
    const raw = await spotRequest<RawTicker24h>('/api/v3/ticker/24hr', { symbol })
    return { ticker: normaliseTicker24h(raw), market: 'spot' }
  } catch (err) {
    if (err instanceof BinanceApiError && err.statusCode === 400) {
      const raw = await futuresRequest<RawFuturesTicker24h>('/fapi/v1/ticker/24hr', { symbol })
      return { ticker: normaliseFuturesTicker24h(raw), market: 'futures' }
    }
    throw err
  }
}

// Legacy spot-only helpers kept for internal use
export async function fetchCandles(
  symbol: string,
  interval: Timeframe,
  limit: number = DEFAULT_CANDLE_LIMIT,
): Promise<Candle[]> {
  const { candles } = await fetchCandlesAuto(symbol, interval, limit)
  return candles
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const { ticker } = await fetchTicker24hAuto(symbol)
  return ticker
}

export async function fetchFundingRate(symbol: string): Promise<FundingRate> {
  const raw = await futuresRequest<RawFundingRate[]>('/fapi/v1/fundingRate', { symbol, limit: 1 })
  if (raw.length === 0) throw new Error(`No funding rate data for ${symbol}`)
  return normaliseFundingRate(raw[0])
}

export async function fetchOpenInterest(symbol: string): Promise<OpenInterest> {
  const raw = await futuresRequest<RawOpenInterest>('/fapi/v1/openInterest', { symbol })
  return normaliseOpenInterest(raw)
}
