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
import { assertWellFormedSeries } from './validate'

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
 *
 * Wicks are applied in LOG space (`× exp(±w)`), not as `× (1 ± w)`. The linear
 * form drives `low` to zero or below once `w >= 1`, which a large `sigma`
 * reaches easily — `sigma = 0.5` needs only |z| > 2. That would have been a
 * generator that silently produced impossible candles in exactly the
 * high-volatility regime a stress test would reach for. The log form is also
 * the one consistent with the process: the path itself is multiplicative.
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
    const high = Math.max(open, close) * Math.exp(wick)
    const low = Math.min(open, close) * Math.exp(-wick)
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

/**
 * One segment of a multi-regime path.
 *
 * `drift` is geometric Brownian motion: a trend when the drift is non-zero, a
 * random walk when it is zero.
 *
 * `revert` is an Ornstein–Uhlenbeck process in LOG price,
 *
 *     d(log P) = −θ·(log P − log μ)·dt + σ·dW
 *
 * which is what a range actually is: price pulled back toward a level, rather
 * than merely drifting nowhere. The distinction matters for this engine
 * specifically. A zero-drift random walk is unpredictable but has no structure
 * to be wrong about; a mean-reverting range actively punishes trend-following,
 * because every breakout is retraced. Testing only against a random walk would
 * miss the regime where a momentum engine loses money rather than just failing
 * to make it.
 *
 * `theta` is the pull per bar toward `anchor` (0 < θ < 1); the half-life of a
 * deviation is ln(2)/θ bars.
 */
export type RegimeSegment =
  | { readonly kind: 'drift'; readonly bars: number; readonly drift: number; readonly sigma: number }
  | { readonly kind: 'revert'; readonly bars: number; readonly theta: number; readonly sigma: number }
  /**
   * AR(1) log returns: r_t = φ·r_{t−1} + σ·√(1−φ²)·z_t.
   *
   * THE PROCESS A TREND-FOLLOWING ENGINE EXISTS FOR, and the one the Phase 2
   * study never contained. `drift` is not it: geometric Brownian motion with
   * drift has ZERO return autocorrelation — the trend is a deterministic mean
   * shift, not persistence. A momentum rule cannot exploit a deterministic
   * shift any better than a coin flip weighted the same way, which is why the
   * engine's failure to beat always-long there was a weaker result than it
   * looked.
   *
   * Here φ > 0 means a move genuinely raises the odds of the next move going
   * the same way. The √(1−φ²) scaling keeps the stationary standard deviation
   * at σ regardless of φ, so momentum strength varies without volatility
   * varying with it — otherwise a φ sweep would confound the two.
   *
   * φ < 0 gives bar-to-bar mean reversion, which is a different (and faster)
   * process than the OU `revert` segment: OU reverts the LEVEL toward an
   * anchor, AR(1) with φ < 0 reverts each RETURN. Both are ranges; they punish
   * different things.
   */
  | { readonly kind: 'momentum'; readonly bars: number; readonly phi: number; readonly sigma: number }
  /**
   * A jump superimposed on a random walk: with probability `rate` per bar, a
   * log-return shock of ±`jump` sigma is added.
   *
   * Stands in for news. It is the only segment with a heavy tail; every other
   * process here has Gaussian returns, which is one of the standing
   * limitations of the whole synthetic study.
   */
  | { readonly kind: 'shock'; readonly bars: number; readonly rate: number; readonly jumpSigmas: number; readonly sigma: number }

export interface RegimeSpec {
  readonly symbol: string
  readonly timeframe: Timeframe
  readonly seed: number
  readonly segments: readonly RegimeSegment[]
  readonly startPrice?: number
}

/**
 * A continuous path stitched from regime segments.
 *
 * Continuity is exact: each segment starts from the previous segment's last
 * close, so there is no artificial gap at a regime boundary that the engine
 * could detect as a signal rather than as a change of character.
 *
 * The reversion anchor for a `revert` segment is the log price at the moment
 * the segment begins — a range forms around wherever price happened to be, not
 * around a level fixed in advance.
 */
export function syntheticRegimeSeries(spec: RegimeSpec): Series {
  const dur = TIMEFRAME_MS[spec.timeframe]
  const r = rng(spec.seed)
  const z = gaussian(r)
  let logP = Math.log(spec.startPrice ?? 100)
  let openTime = 0
  const candles: Candle[] = []

  for (const seg of spec.segments) {
    if (!Number.isInteger(seg.bars) || seg.bars < 1) throw new Error(`segment bars must be a positive integer, got ${seg.bars}`)
    if (seg.kind === 'revert' && !(seg.theta > 0 && seg.theta < 1)) {
      throw new Error(`revert theta must be in (0, 1), got ${seg.theta}`)
    }
    if (seg.kind === 'momentum' && !(seg.phi > -1 && seg.phi < 1)) {
      throw new Error(`momentum phi must be in (-1, 1) for stationarity, got ${seg.phi}`)
    }
    if (seg.kind === 'shock' && !(seg.rate >= 0 && seg.rate <= 1)) {
      throw new Error(`shock rate must be in [0, 1], got ${seg.rate}`)
    }
    const anchor = logP
    // AR(1) state. Carried within a segment only: a regime boundary resets
    // momentum, which is the point of a boundary.
    let prevReturn = 0
    for (let i = 0; i < seg.bars; i++) {
      const openLog = logP
      let step: number
      switch (seg.kind) {
        case 'drift':
          step = seg.drift + seg.sigma * z()
          break
        case 'revert':
          step = -seg.theta * (logP - anchor) + seg.sigma * z()
          break
        case 'momentum': {
          // Scaling by sqrt(1 - phi^2) fixes the stationary variance at sigma^2.
          step = seg.phi * prevReturn + seg.sigma * Math.sqrt(1 - seg.phi * seg.phi) * z()
          prevReturn = step
          break
        }
        case 'shock': {
          const jump = r() < seg.rate ? (r() < 0.5 ? -1 : 1) * seg.jumpSigmas * seg.sigma : 0
          step = seg.sigma * z() + jump
          break
        }
      }
      logP += step
      const open = Math.exp(openLog)
      const close = Math.exp(logP)
      const wick = seg.sigma * Math.abs(z())
      const volume = 1000 * Math.exp(0.3 * z())
      const buyShare = Math.min(0.99, Math.max(0.01, 0.5 + 0.1 * z()))
      candles.push({
        openTime,
        closeTime: openTime + dur - 1,
        open,
        high: Math.max(open, close) * Math.exp(wick),
        low: Math.min(open, close) * Math.exp(-wick),
        close,
        volume,
        quoteVolume: close * volume,
        trades: 100,
        takerBuyVolume: volume * buyShare,
        takerSellVolume: volume * (1 - buyShare),
      })
      openTime += dur
    }
  }
  return { symbol: spec.symbol, timeframe: spec.timeframe, candles }
}

export function regimeSource(specs: readonly RegimeSpec[], name: string): CandleSource {
  return { name, async list() { return specs.map(syntheticRegimeSeries) } }
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

  const series: Series = { symbol: o.symbol, timeframe: o.timeframe as Timeframe, candles }
  // The shape check above establishes only that the fields are numbers. What
  // makes a series USABLE — ordering, positivity, high >= low — has one
  // definition, in `validate.ts`, and this is not a second copy of it.
  try {
    assertWellFormedSeries(series)
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`)
  }
  return series
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
