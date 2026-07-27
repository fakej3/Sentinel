import type { Candle } from '../../modules/market/types'
import { rng } from '../sources'

export const HOUR = 3_600_000

/** A candle with explicit OHLC. Volume fields are consistent by construction. */
export function bar(
  openTime: number, o: number, h: number, l: number, c: number, v = 1000,
): Candle {
  return {
    openTime,
    closeTime: openTime + HOUR - 1,
    open: o, high: h, low: l, close: c,
    volume: v, quoteVolume: c * v,
    trades: 10, takerBuyVolume: v * 0.5, takerSellVolume: v * 0.5,
  }
}

/** Candles from an explicit close path; H/L bracket O and C by a fixed fraction. */
export function fromCloses(closes: readonly number[], start = 0): Candle[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c : closes[i - 1]
    return bar(start + i * HOUR, o, Math.max(o, c) * 1.01, Math.min(o, c) * 0.99, c)
  })
}

/**
 * Replaces every candle strictly after `i` with unrelated random data.
 *
 * Timestamps are preserved so the series stays well-formed; only prices and
 * volumes change. Anything that reads the future will produce a different
 * observation at bar `i` after this transformation.
 */
export function randomiseAfter(candles: readonly Candle[], i: number, seed: number): Candle[] {
  const r = rng(seed)
  return candles.map((c, k) => {
    if (k <= i) return c
    const close = 10 + r() * 500
    const open = 10 + r() * 500
    const volume = 1 + r() * 10_000
    return {
      ...c,
      open,
      high: Math.max(open, close) * (1 + r()),
      low: Math.min(open, close) * (1 - r() * 0.5),
      close,
      volume,
      quoteVolume: close * volume,
      trades: Math.floor(r() * 1000),
      takerBuyVolume: volume * 0.4,
      takerSellVolume: volume * 0.6,
    }
  })
}
