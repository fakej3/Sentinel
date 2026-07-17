import { spotRequest, futuresRequest } from './client'
import {
  normaliseCandles,
  normaliseTicker24h,
  normaliseFundingRate,
  normaliseOpenInterest,
  type RawCandle,
  type RawTicker24h,
  type RawFundingRate,
  type RawOpenInterest,
} from './normalise'
import type { Candle, Ticker24h, FundingRate, OpenInterest, Timeframe } from './types'
import { DEFAULT_CANDLE_LIMIT, MAX_CANDLE_LIMIT } from './constants'

export async function fetchCandles(
  symbol: string,
  interval: Timeframe,
  limit: number = DEFAULT_CANDLE_LIMIT,
): Promise<Candle[]> {
  const safeLimit = Math.min(Math.max(1, limit), MAX_CANDLE_LIMIT)
  const raw = await spotRequest<RawCandle[]>('/api/v3/klines', { symbol, interval, limit: safeLimit })
  return normaliseCandles(raw)
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const raw = await spotRequest<RawTicker24h>('/api/v3/ticker/24hr', { symbol })
  return normaliseTicker24h(raw)
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
