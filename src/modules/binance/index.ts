/**
 * Binance Data Engine — fetches and normalises OHLCV candles and market data
 * from the official Binance REST API.
 *
 * Inputs:  symbol (e.g. "BTCUSDT"), timeframe (e.g. "1h"), FetchOptions
 * Outputs: MarketData (candles[], ticker, fundingRate?, openInterest?)
 * Deps:    Binance REST API (external)
 */
import { BinanceApiError } from './client'
import { fetchCandles, fetchTicker24h, fetchFundingRate, fetchOpenInterest } from './endpoints'
import { VALID_TIMEFRAMES, DEFAULT_CANDLE_LIMIT } from './constants'
import type { MarketData, Timeframe, FetchOptions } from './types'

export { BinanceApiError } from './client'
export type {
  MarketData,
  Candle,
  Ticker24h,
  FundingRate,
  OpenInterest,
  Timeframe,
  FetchOptions,
} from './types'

export async function fetchMarketData(
  symbol: string,
  timeframe: Timeframe,
  options: FetchOptions = {},
): Promise<MarketData> {
  const upperSymbol = symbol.toUpperCase()

  if (!VALID_TIMEFRAMES.has(timeframe)) {
    throw new BinanceApiError(`Invalid timeframe: "${timeframe}"`)
  }

  const {
    candleLimit = DEFAULT_CANDLE_LIMIT,
    includeFunding = false,
    includeOpenInterest = false,
  } = options

  const [candles, ticker] = await Promise.all([
    fetchCandles(upperSymbol, timeframe, candleLimit),
    fetchTicker24h(upperSymbol),
  ])

  const [fundingRate, openInterest] = await Promise.all([
    includeFunding ? fetchFundingRate(upperSymbol) : Promise.resolve(null),
    includeOpenInterest ? fetchOpenInterest(upperSymbol) : Promise.resolve(null),
  ])

  return {
    symbol: upperSymbol,
    timeframe,
    fetchedAt: Date.now(),
    candles,
    ticker,
    fundingRate,
    openInterest,
  }
}

// Re-export DEFAULT_CANDLE_LIMIT so callers can know what the default is
export { DEFAULT_CANDLE_LIMIT } from './constants'
