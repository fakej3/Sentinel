/**
 * Binance Data Engine — fetches and normalises OHLCV candles and market data
 * from the official Binance REST API.
 *
 * Inputs:  symbol (e.g. "BTCUSDT"), timeframe (e.g. "1h"), FetchOptions
 * Outputs: MarketData (candles[], ticker, fundingRate?, openInterest?)
 * Deps:    Binance REST API (external)
 */
import { BinanceApiError } from './client'
import { fetchCandlesAuto, fetchTicker24hAuto, fetchFundingRate, fetchOpenInterest } from './endpoints'
import { VALID_TIMEFRAMES, DEFAULT_CANDLE_LIMIT } from './constants'
import { symbolRegistry } from './registry'
import type { MarketData, Timeframe, FetchOptions } from './types'

export { BinanceApiError } from './client'
export type { MarketType } from './endpoints'
export { symbolRegistry } from './registry'
export type { SymbolMarket, RegistryEntry } from './registry'
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

  // Resolve the market ONCE from the registry so every downstream request
  // uses an identical source. 'unknown' means the registry hasn't loaded yet —
  // fetchCandlesAuto / fetchTicker24hAuto handle the spot→futures fallback.
  const preferredMarket = symbolRegistry.getPreferredMarket(upperSymbol)
  const knownMarket = preferredMarket !== 'unknown' ? preferredMarket : undefined

  if (import.meta.env.DEV) {
    console.debug('[Pipeline] fetchMarketData', upperSymbol, '| registry:', preferredMarket)
  }

  const [{ candles, market }, { ticker }] = await Promise.all([
    fetchCandlesAuto(upperSymbol, timeframe, candleLimit, knownMarket),
    fetchTicker24hAuto(upperSymbol, knownMarket),
  ])

  // Funding rate and open interest are futures-only data; never mix them with
  // spot candles / ticker. Only fetch when the resolved market is 'futures'.
  const isFutures = market === 'futures'

  if (import.meta.env.DEV) {
    console.debug('[Pipeline] fetchMarketData', upperSymbol, '| resolved market:', market, '| funding eligible:', isFutures)
  }

  const [fundingRate, openInterest] = await Promise.all([
    includeFunding && isFutures ? fetchFundingRate(upperSymbol) : Promise.resolve(null),
    includeOpenInterest && isFutures ? fetchOpenInterest(upperSymbol) : Promise.resolve(null),
  ])

  return {
    symbol: upperSymbol,
    timeframe,
    fetchedAt: Date.now(),
    candles,
    ticker,
    market,
    fundingRate,
    openInterest,
  }
}

// Re-export DEFAULT_CANDLE_LIMIT so callers can know what the default is
export { DEFAULT_CANDLE_LIMIT } from './constants'
