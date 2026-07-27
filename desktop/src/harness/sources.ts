/**
 * Candle sources.
 *
 * The harness is deliberately independent of any exchange. Two sources ship:
 *
 *   - `syntheticSource` generates data whose true answer is KNOWN. A driftless
 *     random walk contains no predictable structure by construction, so any
 *     signal the harness reports on it is a defect in the harness. This is the
 *     null calibration, and it is the only way to distinguish "Sentinel has
 *     edge" from "the measurement is broken".
 *
 *   - `jsonFileSource` reads candles from disk, so real market data can be
 *     evaluated the moment it is available without touching the runner. This
 *     environment has no route to `api.binance.com` (the proxy returns 403 on
 *     CONNECT), so the file source is the path for real data.
 *
 * A source is a plain interface; a Binance-backed one would be ten lines and
 * would not require any change here.
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Candle, Timeframe } from '../modules/market/types'
import type { CandleSource, Series } from './types'

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000, '3m': 180_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '2h': 7_200_000, '4h': 14_400_000, '6h': 21_600_000,
  '8h': 28_800_000, '12h': 43_200_000,
  // '1M' is nominal: calendar months are 28–31 days. It is used only to space
  // synthetic bars and to validate the timeframe string, never to convert a
  // real timestamp, so the approximation cannot corrupt a measurement.
  '1d': 86_400_000, '3d': 259_200_000, '1w': 604_800_000, '1M': 2_592_000_000,
}

/** Deterministic LCG. Same constants as the V6 fixtures — reproducibility over quality. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/** Box–Muller, so returns are Gaussian rather than uniform. */
function gaussian(r: () => number): () => number {
  let spare: number | null = null
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v }
    let u = 0, v = 0, s = 0
    do {
      u = r() * 2 - 1
      v = r() * 2 - 1
      s = u * u + v * v
    } while (s === 0 || s >= 1)
    const f = Math.sqrt(-2 * Math.log(s) / s)
    spare = v * f
    return u * f
  }
}

export interface SyntheticSpec {
  readonly symbol: string
  readonly timeframe: Timeframe
  readonly bars: number
  readonly seed: number
  /** Per-bar log drift. 0 = a martingale in log price: the null hypothesis. */
  readonly drift?: number
  /** Per-bar log return standard deviation. */
  readonly sigma?: number
  readonly startPrice?: number
}

/**
 * Geometric Brownian motion with the intrabar range drawn independently.
 *
 * Log returns are i.i.d. Gaussian, so:
 *   - no return is predictable from any function of past returns;
 *   - E[log(P_{t+h}/P_t)] = h·drift, exactly;
 *   - with drift = 0 the up-rate at every horizon is 1/2 in the limit.
 *
 * The intrabar high/low are drawn from an independent half-normal rather than
 * simulated as a bridge. That understates true intrabar range slightly, which
 * is fine: MFE/MAE are compared against the same generator, not against a
 * theoretical value.
 */
export function syntheticSeries(spec: SyntheticSpec): Series {
  const { symbol, timeframe, bars, seed } = spec
  const drift = spec.drift ?? 0
  const sigma = spec.sigma ?? 0.01
  const dur = TIMEFRAME_MS[timeframe]
  const r = rng(seed)
  const z = gaussian(r)

  // Epoch-aligned so UTC session anchoring (VWAP) behaves as it does live.
  let openTime = 0
  let price = spec.startPrice ?? 100
  const candles: Candle[] = []

  for (let i = 0; i < bars; i++) {
    const open = price
    const close = open * Math.exp(drift + sigma * z())
    const wick = sigma * Math.abs(z())
    const high = Math.max(open, close) * (1 + wick)
    const low = Math.min(open, close) * (1 - wick)
    const volume = 1000 * Math.exp(0.3 * z())
    const buyShare = 0.5 + 0.1 * z()
    const takerBuyVolume = volume * Math.min(0.99, Math.max(0.01, buyShare))
    candles.push({
      openTime,
      closeTime: openTime + dur - 1,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume: close * volume,
      trades: 100,
      takerBuyVolume,
      takerSellVolume: volume - takerBuyVolume,
    })
    price = close
    openTime += dur
  }
  return { symbol, timeframe, candles }
}

/** A source over synthetic specs. `name` records the parameters, so runs are self-describing. */
export function syntheticSource(specs: readonly SyntheticSpec[]): CandleSource {
  return {
    name: `synthetic(${specs.map(s => `${s.symbol}/${s.timeframe}/${s.bars}b/seed${s.seed}/drift${s.drift ?? 0}`).join(',')})`,
    async list() { return specs.map(syntheticSeries) },
  }
}

/** Any candle array, wrapped. For evaluating data that came from somewhere else. */
export function inMemorySource(series: readonly Series[], name = 'in-memory'): CandleSource {
  return { name, async list() { return series } }
}

// ── File source ───────────────────────────────────────────────────────────────

function isCandle(v: unknown): v is Candle {
  if (v === null || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  for (const k of ['openTime', 'closeTime', 'open', 'high', 'low', 'close', 'volume']) {
    if (typeof c[k] !== 'number' || !Number.isFinite(c[k] as number)) return false
  }
  return true
}

/**
 * Parses one series file. Rejects rather than repairs.
 *
 * Silent repair is how a corpus acquires bars that no exchange ever printed.
 * A malformed file must fail loudly, at load, naming the file — not produce
 * observations that are subtly wrong 400 bars later.
 */
export function parseSeriesFile(file: string, text: string): Series {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new Error(`${file}: not valid JSON (${(e as Error).message})`)
  }
  // Arrays are `typeof 'object'`, and a bare candle array is the likeliest
  // wrong input (someone dumps `marketData.candles` instead of `marketData`).
  // It must be named as such rather than reported as a missing "symbol".
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${file}: expected an object of the form { symbol, timeframe, candles }`)
  }
  const o = raw as Record<string, unknown>
  if (typeof o.symbol !== 'string' || o.symbol.length === 0) throw new Error(`${file}: missing "symbol"`)
  if (typeof o.timeframe !== 'string' || !(o.timeframe in TIMEFRAME_MS)) {
    throw new Error(`${file}: "timeframe" must be one of ${Object.keys(TIMEFRAME_MS).join(', ')}`)
  }
  if (!Array.isArray(o.candles)) throw new Error(`${file}: missing "candles" array`)

  const candles: Candle[] = []
  o.candles.forEach((c, i) => {
    if (!isCandle(c)) throw new Error(`${file}: candle ${i} is malformed`)
    candles.push(c)
  })
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].openTime <= candles[i - 1].openTime) {
      throw new Error(`${file}: candles are not strictly increasing in openTime at index ${i}`)
    }
  }
  return { symbol: o.symbol, timeframe: o.timeframe as Timeframe, candles }
}

/**
 * Every `*.json` in `dir`, sorted by filename so the run order is stable.
 *
 * Expected shape: `{ symbol, timeframe, candles: Candle[] }` — the same shape
 * `MarketData` uses, so a captured API response needs no transformation.
 */
export function jsonFileSource(dir: string): CandleSource {
  return {
    name: `json:${dir}`,
    async list() {
      const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort()
      const out: Series[] = []
      for (const f of files) {
        const full = path.join(dir, f)
        out.push(parseSeriesFile(full, await readFile(full, 'utf8')))
      }
      return out
    },
  }
}
