/**
 * Module 38 — Synthetic multi-regime candle generator.
 *
 * Produces a 540-candle sequence that walks through 9 market regimes
 * in order, with price continuity across segment boundaries.
 * Deterministic: same symbol + timeframe → identical candles every run.
 */
import type { Candle, Timeframe } from '../../market/types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT',
] as const

export type SymbolName = typeof SYMBOLS[number]

export const TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h']

export type MarketRegime =
  | 'range' | 'bull' | 'distribution'
  | 'high_volatility' | 'bear' | 'low_volatility'
  | 'accumulation' | 'breakout' | 'reversal'

const SYMBOL_BASE_PRICES: Record<string, number> = {
  BTCUSDT: 42000, ETHUSDT: 2500,  BNBUSDT: 300,  SOLUSDT: 100,
  XRPUSDT: 0.55,  ADAUSDT: 0.45,  DOGEUSDT: 0.09, LINKUSDT: 14,
  AVAXUSDT: 25,   SUIUSDT: 1.5,
}

/**
 * 9-segment regime sequence, 540 total candles.
 * Order mimics a realistic market cycle.
 */
const SEGMENTS: ReadonlyArray<{ regime: MarketRegime; count: number }> = [
  { regime: 'range',           count: 80  },
  { regime: 'bull',            count: 90  },
  { regime: 'distribution',    count: 50  },
  { regime: 'high_volatility', count: 40  },
  { regime: 'bear',            count: 90  },
  { regime: 'low_volatility',  count: 40  },
  { regime: 'accumulation',    count: 50  },
  { regime: 'breakout',        count: 60  },
  { regime: 'reversal',        count: 40  },
]

export const TOTAL_CANDLES = SEGMENTS.reduce((s, seg) => s + seg.count, 0) // 540

/** Return the dominant regime at a given candle index (0-based). */
export function getRegimeAtIndex(index: number): MarketRegime {
  let cumulative = 0
  for (const seg of SEGMENTS) {
    cumulative += seg.count
    if (index < cumulative) return seg.regime
  }
  return 'range'
}

// ── Seeded RNG ────────────────────────────────────────────────────────────────

class Rng {
  private s: number
  constructor(seed: number) { this.s = (seed >>> 0) || 1 }

  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0
    return this.s / 0x100000000
  }

  gauss(): number {
    // Box-Muller; guard against log(0)
    const u1 = Math.max(1e-10, this.next())
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * this.next())
  }
}

function symbolSeed(symbol: string, timeframe: Timeframe): number {
  let h = 0x811c9dc5
  for (const ch of (symbol + timeframe)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  }
  return h || 1
}

function intervalMs(timeframe: Timeframe): number {
  if (timeframe === '15m') return 900_000
  if (timeframe === '1h')  return 3_600_000
  return 14_400_000
}

// ── Candle factory ────────────────────────────────────────────────────────────

function oneCandle(
  t: number, ms: number,
  open: number, close: number,
  highExtra: number, lowExtra: number,
  vol: number, buyRatio: number,
): Candle {
  const high = Math.max(open, close) + Math.abs(highExtra)
  const low  = Math.max(open * 0.00001, Math.min(open, close) - Math.abs(lowExtra))
  const qv   = vol * (open + close) / 2
  const tbv  = vol * Math.min(1, Math.max(0, buyRatio))
  return {
    openTime:        t,
    closeTime:       t + ms - 1,
    open, high, low, close,
    volume:          Math.max(1, vol),
    quoteVolume:     qv,
    trades:          Math.max(1, Math.round(vol / 10)),
    takerBuyVolume:  tbv,
    takerSellVolume: vol - tbv,
  }
}

// ── Segment builders ──────────────────────────────────────────────────────────

function buildSegment(
  regime: MarketRegime,
  count: number,
  entryPrice: number,
  startTime: number,
  ms: number,
  rng: Rng,
  baseVol: number,
): Candle[] {
  const candles: Candle[] = []
  let p = entryPrice

  for (let i = 0; i < count; i++) {
    const g    = rng.gauss()
    const prog = i / Math.max(1, count - 1)

    let drift: number
    let wick:  number
    let vol:   number
    let buy:   number

    switch (regime) {
      case 'bull': {
        drift = p * (0.0018 + rng.next() * 0.001) + g * p * 0.004
        wick  = p * 0.003
        vol   = baseVol * (0.8 + prog * 0.6)
        buy   = 0.58 + prog * 0.08
        break
      }
      case 'bear': {
        drift = -p * (0.0018 + rng.next() * 0.001) + g * p * 0.004
        wick  = p * 0.003
        vol   = baseVol * (0.8 + prog * 0.5)
        buy   = 0.42 - prog * 0.06
        break
      }
      case 'range': {
        const amp    = entryPrice * 0.04
        const period = 22
        const target = entryPrice + amp * Math.sin((i * 2 * Math.PI) / period)
        drift = (target - p) * 0.25 + g * p * 0.003
        wick  = p * 0.004
        vol   = baseVol * (0.7 + rng.next() * 0.4)
        buy   = 0.48 + rng.next() * 0.06
        break
      }
      case 'distribution': {
        drift = -p * 0.001 + g * p * 0.005
        wick  = p * 0.005
        vol   = baseVol * Math.max(0.2, 1.0 - prog * 0.5)
        buy   = 0.44 - prog * 0.05
        break
      }
      case 'accumulation': {
        drift = p * 0.0003 + g * p * 0.002
        wick  = p * 0.003
        vol   = baseVol * (0.25 + prog * 0.45)
        buy   = 0.51 + prog * 0.04
        break
      }
      case 'high_volatility': {
        drift = g * p * 0.015
        wick  = p * 0.010
        vol   = baseVol * (1.8 + rng.next() * 0.8)
        buy   = 0.45 + rng.next() * 0.12
        break
      }
      case 'low_volatility': {
        drift = g * p * 0.0008
        wick  = p * 0.0008
        vol   = baseVol * (0.25 + rng.next() * 0.15)
        buy   = 0.49 + rng.next() * 0.04
        break
      }
      case 'breakout': {
        if (prog < 0.45) {
          const amp    = entryPrice * 0.02
          const period = 12
          const target = entryPrice + amp * Math.sin((i * 2 * Math.PI) / period)
          drift = (target - p) * 0.2 + g * p * 0.002
          wick  = p * 0.003
          vol   = baseVol * 0.6
          buy   = 0.49 + rng.next() * 0.04
        } else {
          drift = p * (0.005 + rng.next() * 0.003) + Math.abs(g) * p * 0.003
          wick  = p * 0.004
          vol   = baseVol * (2.5 + prog * 1.5)
          buy   = 0.72 + rng.next() * 0.08
        }
        break
      }
      case 'reversal': {
        if (prog < 0.45) {
          // Topping / pause
          drift = -p * 0.0008 + g * p * 0.003
          wick  = p * 0.004
          vol   = baseVol * 1.2
          buy   = 0.52
        } else {
          // Sharp decline
          drift = -p * (0.005 + rng.next() * 0.003) + Math.min(0, g) * p * 0.004
          wick  = p * 0.004
          vol   = baseVol * (1.8 + (prog - 0.5) * 2)
          buy   = 0.28 + rng.next() * 0.06
        }
        break
      }
    }

    const open  = p
    const close = Math.max(open * 0.0001, open + drift)
    const hE    = wick * (0.4 + rng.next() * 0.9)
    const lE    = wick * (0.4 + rng.next() * 0.9)

    candles.push(oneCandle(
      startTime + i * ms, ms,
      open, close, hE, lE,
      Math.max(1, vol),
      Math.min(1, Math.max(0, buy)),
    ))
    p = close
  }

  return candles
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a 540-candle multi-regime sequence for the given symbol + timeframe.
 * Deterministic: same inputs → same output.
 */
export function generateMultiRegimeCandles(symbol: string, timeframe: Timeframe): Candle[] {
  const rng       = new Rng(symbolSeed(symbol, timeframe))
  const ms        = intervalMs(timeframe)
  const basePrice = SYMBOL_BASE_PRICES[symbol] ?? 100
  // Base volume is inversely scaled with price so low-cap coins have more volume
  const baseVol   = basePrice > 10_000 ? 300
    : basePrice > 1000  ? 1_000
    : basePrice > 100   ? 3_000
    : basePrice > 1     ? 15_000
    : 200_000

  const START_TIME = 1_704_067_200_000 // 2024-01-01 00:00 UTC

  const all: Candle[] = []
  let price = basePrice
  let time  = START_TIME

  for (const { regime, count } of SEGMENTS) {
    const seg = buildSegment(regime, count, price, time, ms, rng, baseVol)
    all.push(...seg)
    const last = seg[seg.length - 1]
    price = last?.close ?? price
    time  = (last?.closeTime ?? time) + 1
  }

  return all
}
