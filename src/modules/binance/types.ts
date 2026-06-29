export type Timeframe =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

export interface Candle {
  openTime: number
  closeTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  trades: number
  takerBuyVolume: number
  takerSellVolume: number
}

export interface Ticker24h {
  symbol: string
  priceChange: number
  priceChangePercent: number
  weightedAvgPrice: number
  lastPrice: number
  bidPrice: number
  askPrice: number
  openPrice: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
  openTime: number
  closeTime: number
  tradeCount: number
}

export interface FundingRate {
  symbol: string
  fundingRate: number
  fundingTime: number
}

export interface OpenInterest {
  symbol: string
  openInterest: number
  timestamp: number
}

export interface MarketData {
  symbol: string
  timeframe: Timeframe
  fetchedAt: number
  candles: Candle[]
  ticker: Ticker24h
  fundingRate: FundingRate | null
  openInterest: OpenInterest | null
}

export interface FetchOptions {
  candleLimit?: number
  includeFunding?: boolean
  includeOpenInterest?: boolean
}
