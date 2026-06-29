import type { Candle } from '../../binance'

/**
 * Builds a minimal Candle for tests.
 * close is the primary price; high/low default to close ± 0.5 when omitted.
 * index is used for timestamps only.
 */
export function candle(
  close: number,
  opts: { high?: number; low?: number; volume?: number } = {},
  index = 0,
): Candle {
  const high = opts.high ?? close + 0.5
  const low = opts.low ?? close - 0.5
  const volume = opts.volume ?? 1000
  return {
    openTime: index * 3_600_000,
    closeTime: index * 3_600_000 + 3_599_999,
    open: close,
    high,
    low,
    close,
    volume,
    quoteVolume: close * volume,
    trades: 10,
    takerBuyVolume: volume * 0.5,
    takerSellVolume: volume * 0.5,
  }
}

/**
 * Builds an array of candles from a compact description array.
 * Each entry is [close, high, low, volume?] or just a number (close only).
 */
export function candles(
  entries: Array<number | [number, number, number, number?]>,
): Candle[] {
  return entries.map((e, i) => {
    if (typeof e === 'number') return candle(e, {}, i)
    const [close, high, low, volume] = e
    return candle(close, { high, low, volume }, i)
  })
}
