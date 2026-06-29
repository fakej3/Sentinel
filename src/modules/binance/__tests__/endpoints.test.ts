import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  spotRequest: vi.fn(),
  futuresRequest: vi.fn(),
}))

import { spotRequest, futuresRequest } from '../client'
import { fetchCandles, fetchTicker24h, fetchFundingRate, fetchOpenInterest } from '../endpoints'
import type { RawCandle, RawTicker24h, RawFundingRate, RawOpenInterest } from '../normalise'

const mockSpot = vi.mocked(spotRequest)
const mockFutures = vi.mocked(futuresRequest)

const RAW_CANDLE: RawCandle = [
  1700000000000, '106800.00', '108200.50', '105600.25', '107300.75',
  '1234.567', 1700003599999, '132000000.00', 4521, '680.123', '72800000.00', '0',
]

const RAW_TICKER: RawTicker24h = {
  symbol: 'BTCUSDT',
  priceChange: '2300.00', priceChangePercent: '2.19',
  weightedAvgPrice: '106500.00', lastPrice: '107300.75',
  bidPrice: '107298.00', askPrice: '107302.00',
  openPrice: '105000.75', highPrice: '108200.50', lowPrice: '104800.00',
  volume: '48200.000', quoteVolume: '5130000000.00',
  openTime: 1699913600000, closeTime: 1700000000000, count: 1284500,
}

const RAW_FUNDING: RawFundingRate = {
  symbol: 'BTCUSDT',
  fundingRate: '0.00010000',
  fundingTime: 1700000000000,
}

const RAW_OI: RawOpenInterest = {
  symbol: 'BTCUSDT',
  openInterest: '85420.123',
  time: 1700000000000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchCandles', () => {
  it('calls spotRequest with the correct endpoint and params', async () => {
    mockSpot.mockResolvedValue([RAW_CANDLE])
    await fetchCandles('BTCUSDT', '4h', 100)
    expect(mockSpot).toHaveBeenCalledOnce()
    expect(mockSpot).toHaveBeenCalledWith('/api/v3/klines', {
      symbol: 'BTCUSDT',
      interval: '4h',
      limit: 100,
    })
  })

  it('clamps limit to MAX_CANDLE_LIMIT (1000)', async () => {
    mockSpot.mockResolvedValue([])
    await fetchCandles('BTCUSDT', '1h', 9999)
    expect(mockSpot).toHaveBeenCalledWith('/api/v3/klines', expect.objectContaining({ limit: 1000 }))
  })

  it('clamps limit to minimum of 1', async () => {
    mockSpot.mockResolvedValue([])
    await fetchCandles('BTCUSDT', '1h', 0)
    expect(mockSpot).toHaveBeenCalledWith('/api/v3/klines', expect.objectContaining({ limit: 1 }))
  })

  it('returns normalised Candle objects', async () => {
    mockSpot.mockResolvedValue([RAW_CANDLE])
    const candles = await fetchCandles('BTCUSDT', '4h')
    expect(candles).toHaveLength(1)
    expect(candles[0].open).toBe(106800.00)
    expect(candles[0].close).toBe(107300.75)
  })

  it('propagates errors from spotRequest', async () => {
    mockSpot.mockRejectedValue(new Error('Network error'))
    await expect(fetchCandles('BTCUSDT', '4h')).rejects.toThrow('Network error')
  })
})

describe('fetchTicker24h', () => {
  it('calls spotRequest with the correct endpoint and params', async () => {
    mockSpot.mockResolvedValue(RAW_TICKER)
    await fetchTicker24h('BTCUSDT')
    expect(mockSpot).toHaveBeenCalledWith('/api/v3/ticker/24hr', { symbol: 'BTCUSDT' })
  })

  it('returns a normalised Ticker24h object', async () => {
    mockSpot.mockResolvedValue(RAW_TICKER)
    const ticker = await fetchTicker24h('BTCUSDT')
    expect(ticker.symbol).toBe('BTCUSDT')
    expect(ticker.lastPrice).toBe(107300.75)
    expect(ticker.priceChangePercent).toBe(2.19)
  })

  it('propagates errors from spotRequest', async () => {
    mockSpot.mockRejectedValue(new Error('Invalid symbol'))
    await expect(fetchTicker24h('INVALID')).rejects.toThrow('Invalid symbol')
  })
})

describe('fetchFundingRate', () => {
  it('calls futuresRequest with the correct endpoint and params', async () => {
    mockFutures.mockResolvedValue([RAW_FUNDING])
    await fetchFundingRate('BTCUSDT')
    expect(mockFutures).toHaveBeenCalledWith('/fapi/v1/fundingRate', { symbol: 'BTCUSDT', limit: 1 })
  })

  it('returns the most recent funding rate entry', async () => {
    mockFutures.mockResolvedValue([RAW_FUNDING])
    const fr = await fetchFundingRate('BTCUSDT')
    expect(fr.fundingRate).toBe(0.0001)
    expect(fr.symbol).toBe('BTCUSDT')
  })

  it('throws if the API returns an empty array', async () => {
    mockFutures.mockResolvedValue([])
    await expect(fetchFundingRate('BTCUSDT')).rejects.toThrow('No funding rate data for BTCUSDT')
  })
})

describe('fetchOpenInterest', () => {
  it('calls futuresRequest with the correct endpoint and params', async () => {
    mockFutures.mockResolvedValue(RAW_OI)
    await fetchOpenInterest('BTCUSDT')
    expect(mockFutures).toHaveBeenCalledWith('/fapi/v1/openInterest', { symbol: 'BTCUSDT' })
  })

  it('returns a normalised OpenInterest object', async () => {
    mockFutures.mockResolvedValue(RAW_OI)
    const oi = await fetchOpenInterest('BTCUSDT')
    expect(oi.openInterest).toBe(85420.123)
    expect(oi.timestamp).toBe(1700000000000)
  })
})
