// Re-export exchange-neutral market types from the canonical module.
// All consumers should import from '../market/types' directly; this file exists
// purely for backwards-compatibility during the transition and for Binance-internal use.
export type {
  Timeframe,
  Candle,
  Ticker24h,
  FundingRate,
  OpenInterest,
  MarketData,
  FetchOptions,
} from '../market/types'
