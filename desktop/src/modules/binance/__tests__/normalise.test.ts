import { describe, it, expect } from 'vitest'
import {
  normaliseCandle,
  normaliseCandles,
  normaliseTicker24h,
  normaliseFundingRate,
  normaliseOpenInterest,
  type RawCandle,
  type RawTicker24h,
  type RawFundingRate,
  type RawOpenInterest,
} from '../normalise'

const RAW_CANDLE: RawCandle = [
  1700000000000,  // openTime
  '106800.00',    // open
  '108200.50',    // high
  '105600.25',    // low
  '107300.75',    // close
  '1234.567',     // volume (base)
  1700003599999,  // closeTime
  '132000000.00', // quoteVolume
  4521,           // trades
  '680.123',      // takerBuyVolume
  '72800000.00',  // takerBuyQuoteVolume
  '0',            // ignore
]

const RAW_TICKER: RawTicker24h = {
  symbol: 'BTCUSDT',
  priceChange: '2300.00',
  priceChangePercent: '2.19',
  weightedAvgPrice: '106500.00',
  lastPrice: '107300.75',
  bidPrice: '107298.00',
  askPrice: '107302.00',
  openPrice: '105000.75',
  highPrice: '108200.50',
  lowPrice: '104800.00',
  volume: '48200.000',
  quoteVolume: '5130000000.00',
  openTime: 1699913600000,
  closeTime: 1700000000000,
  count: 1284500,
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

describe('normaliseCandle', () => {
  it('parses all numeric fields from string', () => {
    const c = normaliseCandle(RAW_CANDLE)
    expect(c.openTime).toBe(1700000000000)
    expect(c.open).toBe(106800.00)
    expect(c.high).toBe(108200.50)
    expect(c.low).toBe(105600.25)
    expect(c.close).toBe(107300.75)
    expect(c.volume).toBe(1234.567)
    expect(c.closeTime).toBe(1700003599999)
    expect(c.quoteVolume).toBe(132000000.00)
    expect(c.trades).toBe(4521)
    expect(c.takerBuyVolume).toBe(680.123)
  })

  it('derives takerSellVolume as total volume minus takerBuyVolume', () => {
    const c = normaliseCandle(RAW_CANDLE)
    expect(c.takerSellVolume).toBeCloseTo(1234.567 - 680.123, 3)
  })

  it('takerBuyVolume + takerSellVolume equals total volume', () => {
    const c = normaliseCandle(RAW_CANDLE)
    expect(c.takerBuyVolume + c.takerSellVolume).toBeCloseTo(c.volume, 3)
  })

  it('returns numbers, not strings', () => {
    const c = normaliseCandle(RAW_CANDLE)
    expect(typeof c.open).toBe('number')
    expect(typeof c.high).toBe('number')
    expect(typeof c.low).toBe('number')
    expect(typeof c.close).toBe('number')
    expect(typeof c.volume).toBe('number')
  })
})

describe('normaliseCandles', () => {
  it('maps an array of raw candles', () => {
    const candles = normaliseCandles([RAW_CANDLE, RAW_CANDLE])
    expect(candles).toHaveLength(2)
    expect(candles[0].open).toBe(106800.00)
    expect(candles[1].open).toBe(106800.00)
  })

  it('returns an empty array for empty input', () => {
    expect(normaliseCandles([])).toEqual([])
  })
})

describe('normaliseTicker24h', () => {
  it('parses all string number fields', () => {
    const t = normaliseTicker24h(RAW_TICKER)
    expect(t.symbol).toBe('BTCUSDT')
    expect(t.priceChange).toBe(2300.00)
    expect(t.priceChangePercent).toBe(2.19)
    expect(t.weightedAvgPrice).toBe(106500.00)
    expect(t.lastPrice).toBe(107300.75)
    expect(t.bidPrice).toBe(107298.00)
    expect(t.askPrice).toBe(107302.00)
    expect(t.openPrice).toBe(105000.75)
    expect(t.highPrice).toBe(108200.50)
    expect(t.lowPrice).toBe(104800.00)
    expect(t.volume).toBe(48200.000)
    expect(t.quoteVolume).toBe(5130000000.00)
  })

  it('preserves integer timestamp fields', () => {
    const t = normaliseTicker24h(RAW_TICKER)
    expect(t.openTime).toBe(1699913600000)
    expect(t.closeTime).toBe(1700000000000)
    expect(t.tradeCount).toBe(1284500)
  })
})

describe('normaliseFundingRate', () => {
  it('parses funding rate from string', () => {
    const f = normaliseFundingRate(RAW_FUNDING)
    expect(f.symbol).toBe('BTCUSDT')
    expect(f.fundingRate).toBe(0.0001)
    expect(f.fundingTime).toBe(1700000000000)
  })

  it('handles negative funding rates', () => {
    const negative: RawFundingRate = { ...RAW_FUNDING, fundingRate: '-0.00025000' }
    expect(normaliseFundingRate(negative).fundingRate).toBe(-0.00025)
  })
})

describe('normaliseOpenInterest', () => {
  it('parses open interest from string', () => {
    const oi = normaliseOpenInterest(RAW_OI)
    expect(oi.symbol).toBe('BTCUSDT')
    expect(oi.openInterest).toBe(85420.123)
    expect(oi.timestamp).toBe(1700000000000)
  })
})
