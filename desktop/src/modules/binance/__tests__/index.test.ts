import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../endpoints', () => ({
  fetchCandles: vi.fn(),
  fetchTicker24h: vi.fn(),
  fetchFundingRate: vi.fn(),
  fetchOpenInterest: vi.fn(),
}))

import { fetchMarketData, BinanceApiError } from '../index'
import * as endpoints from '../endpoints'
import type { Candle, Ticker24h, FundingRate, OpenInterest } from '../types'

const mockFetchCandles = vi.mocked(endpoints.fetchCandles)
const mockFetchTicker = vi.mocked(endpoints.fetchTicker24h)
const mockFetchFunding = vi.mocked(endpoints.fetchFundingRate)
const mockFetchOI = vi.mocked(endpoints.fetchOpenInterest)

const STUB_CANDLE: Candle = {
  openTime: 1700000000000, closeTime: 1700003599999,
  open: 106800, high: 108200, low: 105600, close: 107300,
  volume: 1234, quoteVolume: 132000000, trades: 4521,
  takerBuyVolume: 680, takerSellVolume: 554,
}

const STUB_TICKER: Ticker24h = {
  symbol: 'BTCUSDT',
  priceChange: 2300, priceChangePercent: 2.19,
  weightedAvgPrice: 106500, lastPrice: 107300,
  bidPrice: 107298, askPrice: 107302,
  openPrice: 105000, highPrice: 108200, lowPrice: 104800,
  volume: 48200, quoteVolume: 5130000000,
  openTime: 1699913600000, closeTime: 1700000000000, tradeCount: 1284500,
}

const STUB_FUNDING: FundingRate = {
  symbol: 'BTCUSDT', fundingRate: 0.0001, fundingTime: 1700000000000,
}

const STUB_OI: OpenInterest = {
  symbol: 'BTCUSDT', openInterest: 85420, timestamp: 1700000000000,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchCandles.mockResolvedValue([STUB_CANDLE])
  mockFetchTicker.mockResolvedValue(STUB_TICKER)
  mockFetchFunding.mockResolvedValue(STUB_FUNDING)
  mockFetchOI.mockResolvedValue(STUB_OI)
})

describe('fetchMarketData', () => {
  it('returns a complete MarketData object', async () => {
    const data = await fetchMarketData('BTCUSDT', '4h')
    expect(data.symbol).toBe('BTCUSDT')
    expect(data.timeframe).toBe('4h')
    expect(data.candles).toHaveLength(1)
    expect(data.ticker.lastPrice).toBe(107300)
    expect(data.fundingRate).toBeNull()
    expect(data.openInterest).toBeNull()
    expect(data.fetchedAt).toBeGreaterThan(0)
  })

  it('uppercases the symbol', async () => {
    const data = await fetchMarketData('btcusdt', '1h')
    expect(data.symbol).toBe('BTCUSDT')
    expect(mockFetchCandles).toHaveBeenCalledWith('BTCUSDT', '1h', expect.any(Number))
    expect(mockFetchTicker).toHaveBeenCalledWith('BTCUSDT')
  })

  it('throws BinanceApiError for an invalid timeframe', async () => {
    await expect(fetchMarketData('BTCUSDT', '99x' as never)).rejects.toThrow(BinanceApiError)
    await expect(fetchMarketData('BTCUSDT', '99x' as never)).rejects.toThrow('Invalid timeframe')
  })

  it('does not fetch funding rate unless includeFunding is true', async () => {
    await fetchMarketData('BTCUSDT', '4h')
    expect(mockFetchFunding).not.toHaveBeenCalled()
  })

  it('does not fetch open interest unless includeOpenInterest is true', async () => {
    await fetchMarketData('BTCUSDT', '4h')
    expect(mockFetchOI).not.toHaveBeenCalled()
  })

  it('fetches funding rate when includeFunding is true', async () => {
    const data = await fetchMarketData('BTCUSDT', '4h', { includeFunding: true })
    expect(mockFetchFunding).toHaveBeenCalledWith('BTCUSDT')
    expect(data.fundingRate).toEqual(STUB_FUNDING)
  })

  it('fetches open interest when includeOpenInterest is true', async () => {
    const data = await fetchMarketData('BTCUSDT', '4h', { includeOpenInterest: true })
    expect(mockFetchOI).toHaveBeenCalledWith('BTCUSDT')
    expect(data.openInterest).toEqual(STUB_OI)
  })

  it('passes candleLimit option to fetchCandles', async () => {
    await fetchMarketData('BTCUSDT', '1d', { candleLimit: 50 })
    expect(mockFetchCandles).toHaveBeenCalledWith('BTCUSDT', '1d', 50)
  })

  it('fetches candles and ticker concurrently', async () => {
    const order: string[] = []
    mockFetchCandles.mockImplementation(async () => { order.push('candles'); return [STUB_CANDLE] })
    mockFetchTicker.mockImplementation(async () => { order.push('ticker'); return STUB_TICKER })
    await fetchMarketData('BTCUSDT', '4h')
    // Both called — order may vary since they run concurrently
    expect(order).toContain('candles')
    expect(order).toContain('ticker')
    expect(mockFetchCandles).toHaveBeenCalledOnce()
    expect(mockFetchTicker).toHaveBeenCalledOnce()
  })

  it('propagates errors from fetchCandles', async () => {
    mockFetchCandles.mockRejectedValue(new Error('API unavailable'))
    await expect(fetchMarketData('BTCUSDT', '4h')).rejects.toThrow('API unavailable')
  })
})
