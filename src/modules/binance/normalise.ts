import type { Candle, Ticker24h, FundingRate, OpenInterest } from './types'

// Raw API response shapes — internal to this module
export type RawCandle = [
  number, // 0  openTime
  string, // 1  open
  string, // 2  high
  string, // 3  low
  string, // 4  close
  string, // 5  volume (base asset)
  number, // 6  closeTime
  string, // 7  quoteAssetVolume
  number, // 8  numberOfTrades
  string, // 9  takerBuyBaseAssetVolume
  string, // 10 takerBuyQuoteAssetVolume
  string, // 11 ignore
]

export interface RawTicker24h {
  symbol: string
  priceChange: string
  priceChangePercent: string
  weightedAvgPrice: string
  lastPrice: string
  bidPrice: string
  askPrice: string
  openPrice: string
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
  openTime: number
  closeTime: number
  count: number
}

export interface RawFundingRate {
  symbol: string
  fundingRate: string
  fundingTime: number
}

export interface RawOpenInterest {
  symbol: string
  openInterest: string
  time: number
}

export function normaliseCandle(raw: RawCandle): Candle {
  const totalVolume = parseFloat(raw[5])
  const takerBuyVolume = parseFloat(raw[9])
  return {
    openTime: raw[0],
    open: parseFloat(raw[1]),
    high: parseFloat(raw[2]),
    low: parseFloat(raw[3]),
    close: parseFloat(raw[4]),
    volume: totalVolume,
    closeTime: raw[6],
    quoteVolume: parseFloat(raw[7]),
    trades: raw[8],
    takerBuyVolume,
    takerSellVolume: totalVolume - takerBuyVolume,
  }
}

export function normaliseCandles(raw: RawCandle[]): Candle[] {
  return raw.map(normaliseCandle)
}

export function normaliseTicker24h(raw: RawTicker24h): Ticker24h {
  return {
    symbol: raw.symbol,
    priceChange: parseFloat(raw.priceChange),
    priceChangePercent: parseFloat(raw.priceChangePercent),
    weightedAvgPrice: parseFloat(raw.weightedAvgPrice),
    lastPrice: parseFloat(raw.lastPrice),
    bidPrice: parseFloat(raw.bidPrice),
    askPrice: parseFloat(raw.askPrice),
    openPrice: parseFloat(raw.openPrice),
    highPrice: parseFloat(raw.highPrice),
    lowPrice: parseFloat(raw.lowPrice),
    volume: parseFloat(raw.volume),
    quoteVolume: parseFloat(raw.quoteVolume),
    openTime: raw.openTime,
    closeTime: raw.closeTime,
    tradeCount: raw.count,
  }
}

export function normaliseFundingRate(raw: RawFundingRate): FundingRate {
  return {
    symbol: raw.symbol,
    fundingRate: parseFloat(raw.fundingRate),
    fundingTime: raw.fundingTime,
  }
}

export function normaliseOpenInterest(raw: RawOpenInterest): OpenInterest {
  return {
    symbol: raw.symbol,
    openInterest: parseFloat(raw.openInterest),
    timestamp: raw.time,
  }
}
