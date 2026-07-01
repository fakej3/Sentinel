import type { Candle, Timeframe, FetchOptions, MarketData, Ticker24h } from '../../binance/types'
import type { FetchFn } from '../types'

export function makeCandles(count: number, basePrice = 50_000): Candle[] {
  const candles: Candle[] = []
  let price = basePrice
  for (let i = 0; i < count; i++) {
    const move = Math.sin(i * 0.2) * (basePrice * 0.002)
    price = Math.max(basePrice * 0.5, price + move)
    const range = Math.abs(Math.cos(i * 0.3)) * (basePrice * 0.001) + basePrice * 0.0005
    const high = price + range
    const low = Math.max(0.01, price - range)
    const volume = 1000 + Math.abs(Math.sin(i * 0.15)) * 500
    const takerBuy = volume * (0.5 + Math.sin(i * 0.1) * 0.1)
    candles.push({
      openTime: i * 3_600_000,
      closeTime: i * 3_600_000 + 3_599_999,
      open: Math.max(0.01, price - move / 2),
      high,
      low,
      close: price,
      volume,
      quoteVolume: price * volume,
      trades: 100,
      takerBuyVolume: takerBuy,
      takerSellVolume: volume - takerBuy,
    })
  }
  return candles
}

function makeTicker(symbol: string, candles: Candle[]): Ticker24h {
  const last = candles[candles.length - 1]
  const first = candles[0]
  const lastPrice = last?.close ?? 50_000
  const firstPrice = first?.close ?? 50_000
  const highPrice = candles.reduce((m, c) => Math.max(m, c.high), -Infinity)
  const lowPrice = candles.reduce((m, c) => Math.min(m, c.low), Infinity)
  return {
    symbol,
    priceChange: lastPrice - firstPrice,
    priceChangePercent: ((lastPrice - firstPrice) / firstPrice) * 100,
    weightedAvgPrice: lastPrice,
    lastPrice,
    bidPrice: lastPrice - 1,
    askPrice: lastPrice + 1,
    openPrice: firstPrice,
    highPrice,
    lowPrice,
    volume: candles.reduce((s, c) => s + c.volume, 0),
    quoteVolume: candles.reduce((s, c) => s + c.quoteVolume, 0),
    openTime: first?.openTime ?? 0,
    closeTime: last?.closeTime ?? 0,
    tradeCount: candles.reduce((s, c) => s + c.trades, 0),
  }
}

export function mockFetch(candles: Candle[], fetchedAt = 1_000_000_000): FetchFn {
  return async (symbol: string, timeframe: Timeframe, _options: FetchOptions): Promise<MarketData> => ({
    symbol: symbol.toUpperCase(),
    timeframe,
    fetchedAt,
    candles,
    ticker: makeTicker(symbol.toUpperCase(), candles),
    fundingRate: null,
    openInterest: null,
  })
}

export function failingFetch(message = 'Network error'): FetchFn {
  return async () => {
    throw new Error(message)
  }
}
