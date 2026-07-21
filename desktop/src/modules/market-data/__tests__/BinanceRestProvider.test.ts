import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../binance/client', () => ({
  spotRequest: vi.fn(),
  BinanceApiError: class BinanceApiError extends Error {
    statusCode?: number
    constructor(msg: string, statusCode?: number) {
      super(msg)
      this.name = 'BinanceApiError'
      this.statusCode = statusCode
    }
  },
}))

import { spotRequest, BinanceApiError } from '../../binance/client'
import { BinanceRestProvider } from '../BinanceRestProvider'
import type { RawCandle } from '../../binance/normalise'

const mockSpot = vi.mocked(spotRequest)

function rawCandle(openTime: number): RawCandle {
  return [
    openTime, '100.00', '110.00', '90.00', '105.00',
    '1000', openTime + 3_599_999, '100000', 500, '600', '60000', '0',
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BinanceRestProvider', () => {
  const provider = new BinanceRestProvider()

  it('has id "binance-rest"', () => {
    expect(provider.id).toBe('binance-rest')
  })

  it('fetches and normalises candles', async () => {
    mockSpot.mockResolvedValue([rawCandle(1_000_000)])
    const candles = await provider.fetchCandles('BTCUSDT', '1h', 200)
    expect(candles).toHaveLength(1)
    expect(candles[0].open).toBe(100)
    expect(candles[0].high).toBe(110)
    expect(candles[0].low).toBe(90)
    expect(candles[0].close).toBe(105)
  })

  it('uppercases the symbol', async () => {
    mockSpot.mockResolvedValue([])
    await provider.fetchCandles('btcusdt', '1h')
    expect(mockSpot).toHaveBeenCalledWith('/api/v3/klines', expect.objectContaining({ symbol: 'BTCUSDT' }))
  })

  it('throws BinanceApiError for an invalid timeframe', async () => {
    await expect(provider.fetchCandles('BTCUSDT', '99x' as never)).rejects.toThrow('Invalid timeframe')
  })

  it('passes limit to spotRequest for requests ≤ 1000', async () => {
    mockSpot.mockResolvedValue([])
    await provider.fetchCandles('BTCUSDT', '4h', 500)
    expect(mockSpot).toHaveBeenCalledWith('/api/v3/klines', expect.objectContaining({ limit: 500 }))
  })

  it('paginates when limit > 1000 (two pages)', async () => {
    // First call (most recent page): 1000 candles
    const page1 = Array.from({ length: 1000 }, (_, i) => rawCandle(2_000_000 + i * 3_600_000))
    // Second call (older page): 500 candles
    const page2 = Array.from({ length: 500 }, (_, i) => rawCandle(1_000_000 + i * 3_600_000))

    mockSpot
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)

    const candles = await provider.fetchCandles('BTCUSDT', '1h', 1500)
    expect(mockSpot).toHaveBeenCalledTimes(2)
    expect(candles.length).toBe(1500)
    // Should be sorted ascending
    expect(candles[0].openTime).toBeLessThan(candles[candles.length - 1].openTime)
  })

  it('retries on network errors (up to 3 attempts)', async () => {
    vi.useFakeTimers()
    mockSpot
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue([rawCandle(1_000_000)])

    const fetchPromise = provider.fetchCandles('BTCUSDT', '1h', 1)
    await vi.runAllTimersAsync()
    const candles = await fetchPromise
    expect(mockSpot).toHaveBeenCalledTimes(3)
    expect(candles).toHaveLength(1)
    vi.useRealTimers()
  })

  it('does not retry on HTTP 400 errors', async () => {
    mockSpot.mockRejectedValue(new BinanceApiError('Bad request', 400))
    await expect(provider.fetchCandles('INVALID', '1h')).rejects.toThrow('Bad request')
    expect(mockSpot).toHaveBeenCalledTimes(1)
  })

  it('subscribeCandle returns a no-op unsubscribe', () => {
    const unsub = provider.subscribeCandle('BTCUSDT', '1h', vi.fn())
    expect(() => unsub()).not.toThrow()
  })

  it('supportsTimeframe returns true for valid timeframes', () => {
    expect(provider.supportsTimeframe('1h')).toBe(true)
    expect(provider.supportsTimeframe('4h')).toBe(true)
    expect(provider.supportsTimeframe('1d')).toBe(true)
  })

  it('supportsTimeframe returns false for invalid timeframes', () => {
    expect(provider.supportsTimeframe('99x' as never)).toBe(false)
    expect(provider.supportsTimeframe('7d' as never)).toBe(false)
  })

  it('fetchSymbols returns only TRADING symbols', async () => {
    mockSpot.mockResolvedValue({
      symbols: [
        { symbol: 'BTCUSDT', status: 'TRADING' },
        { symbol: 'XYZUSDT', status: 'BREAK' },
        { symbol: 'ETHUSDT', status: 'TRADING' },
      ],
    })
    const symbols = await provider.fetchSymbols()
    expect(symbols).toEqual(['BTCUSDT', 'ETHUSDT'])
  })

  it('dispose does not throw', () => {
    expect(() => provider.dispose()).not.toThrow()
  })
})
