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
import { symbolRegistry } from './registry'

export type MarketType = 'spot' | 'futures'

/**
 * Fetch candles for a symbol.
 *
 * Pass `market` to bypass the registry lookup when the market has already been
 * determined upstream (e.g. by fetchMarketData). Omit it to let the registry
 * resolve the market automatically.
 *
 * When the registry hasn't loaded yet ('unknown'), falls back to spot first
 * and retries futures only on HTTP 400 (invalid symbol on spot = futures-only pair).
 */
export async function fetchCandlesAuto(
  symbol: string,
  interval: Timeframe,
  limit: number = DEFAULT_CANDLE_LIMIT,
  market?: 'spot' | 'futures',
  endTime?: number,
  startTime?: number,
): Promise<{ candles: Candle[]; market: MarketType }> {
  const safeLimit    = Math.min(Math.max(1, limit), MAX_CANDLE_LIMIT)
  const resolvedMarket = market ?? symbolRegistry.getPreferredMarket(symbol)
  const params: Record<string, string | number> = { symbol, interval, limit: safeLimit }
  if (endTime   !== undefined) params.endTime   = endTime
  if (startTime !== undefined) params.startTime = startTime

  if (resolvedMarket === 'futures') {
    if (import.meta.env.DEV) console.debug('[Binance] candles', symbol, '→ futures /fapi/v1/klines')
    const raw = await futuresRequest<RawCandle[]>('/fapi/v1/klines', params)
    return { candles: normaliseCandles(raw), market: 'futures' }
  }

  if (resolvedMarket === 'spot') {
    if (import.meta.env.DEV) console.debug('[Binance] candles', symbol, '→ spot /api/v3/klines')
    const raw = await spotRequest<RawCandle[]>('/api/v3/klines', params)
    return { candles: normaliseCandles(raw), market: 'spot' }
  }

  // 'unknown' — registry not yet loaded; spot-first with futures fallback on 400
  if (import.meta.env.DEV) console.debug('[Binance] candles', symbol, '→ unknown registry, trying spot first')
  try {
    const raw = await spotRequest<RawCandle[]>('/api/v3/klines', params)
    return { candles: normaliseCandles(raw), market: 'spot' }
  } catch (err) {
    if (err instanceof BinanceApiError && err.statusCode === 400) {
      if (import.meta.env.DEV) console.debug('[Binance] candles', symbol, '→ spot 400, retrying futures')
      const raw = await futuresRequest<RawCandle[]>('/fapi/v1/klines', params)
      return { candles: normaliseCandles(raw), market: 'futures' }
    }
    throw err
  }
}

/**
 * Fetch 24-hour ticker for a symbol.
 *
 * Pass `market` to bypass the registry lookup when the market has already been
 * determined upstream (e.g. by fetchMarketData). Omit it to let the registry
 * resolve the market automatically.
 */
export async function fetchTicker24hAuto(
  symbol: string,
  market?: 'spot' | 'futures',
): Promise<{ ticker: Ticker24h; market: MarketType }> {
  const resolvedMarket = market ?? symbolRegistry.getPreferredMarket(symbol)

  if (resolvedMarket === 'futures') {
    if (import.meta.env.DEV) console.debug('[Binance] ticker', symbol, '→ futures /fapi/v1/ticker/24hr')
    const raw = await futuresRequest<RawFuturesTicker24h>('/fapi/v1/ticker/24hr', { symbol })
    return { ticker: normaliseFuturesTicker24h(raw), market: 'futures' }
  }

  if (resolvedMarket === 'spot') {
    if (import.meta.env.DEV) console.debug('[Binance] ticker', symbol, '→ spot /api/v3/ticker/24hr')
    const raw = await spotRequest<RawTicker24h>('/api/v3/ticker/24hr', { symbol })
    return { ticker: normaliseTicker24h(raw), market: 'spot' }
  }

  // 'unknown' — registry not yet loaded; spot-first with futures fallback on 400
  if (import.meta.env.DEV) console.debug('[Binance] ticker', symbol, '→ unknown registry, trying spot first')
  try {
    const raw = await spotRequest<RawTicker24h>('/api/v3/ticker/24hr', { symbol })
    return { ticker: normaliseTicker24h(raw), market: 'spot' }
  } catch (err) {
    if (err instanceof BinanceApiError && err.statusCode === 400) {
      if (import.meta.env.DEV) console.debug('[Binance] ticker', symbol, '→ spot 400, retrying futures')
      const raw = await futuresRequest<RawFuturesTicker24h>('/fapi/v1/ticker/24hr', { symbol })
      return { ticker: normaliseFuturesTicker24h(raw), market: 'futures' }
    }
    throw err
  }
}

export async function fetchFundingRate(symbol: string): Promise<FundingRate> {
  if (import.meta.env.DEV) console.debug('[Binance] fundingRate', symbol, '→ /fapi/v1/fundingRate')
  const raw = await futuresRequest<RawFundingRate[]>('/fapi/v1/fundingRate', { symbol, limit: 1 })
  if (raw.length === 0) throw new Error(`No funding rate data for ${symbol}`)
  return normaliseFundingRate(raw[0])
}

export async function fetchOpenInterest(symbol: string): Promise<OpenInterest> {
  if (import.meta.env.DEV) console.debug('[Binance] openInterest', symbol, '→ /fapi/v1/openInterest')
  const raw = await futuresRequest<RawOpenInterest>('/fapi/v1/openInterest', { symbol })
  return normaliseOpenInterest(raw)
}
