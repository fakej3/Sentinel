import { analyzeMarket } from '../pipeline/index'
import type { PipelineConfig } from '../pipeline/types'
import type { Candle, Timeframe, Ticker24h } from '../market/types'
import type { ReplayEngineOptions, ReplayFrame } from './types'
import { REPLAY_MIN_CANDLES } from './types'

/** Build a synthetic Ticker24h from a candle slice (mirrors benchmark/replay.ts) */
function buildTicker(symbol: string, candles: Candle[]): Ticker24h {
  const last  = candles[candles.length - 1]
  const first = candles[0]
  const lastPrice  = last?.close  ?? 0
  const firstPrice = first?.close ?? 0
  return {
    symbol,
    priceChange:        lastPrice - firstPrice,
    priceChangePercent: firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0,
    weightedAvgPrice:   lastPrice,
    lastPrice,
    bidPrice:   lastPrice,
    askPrice:   lastPrice,
    openPrice:  firstPrice,
    highPrice:  candles.reduce((m, c) => Math.max(m, c.high),  -Infinity),
    lowPrice:   candles.reduce((m, c) => Math.min(m, c.low),    Infinity),
    volume:      candles.reduce((s, c) => s + c.volume,        0),
    quoteVolume: candles.reduce((s, c) => s + c.quoteVolume,   0),
    openTime:    first?.openTime  ?? 0,
    closeTime:   last?.closeTime  ?? 0,
    tradeCount:  candles.reduce((s, c) => s + c.trades,        0),
  }
}

/**
 * Drives the replay pipeline.
 *
 * At every step, only candles[0..currentIndex] are passed to analyzeMarket —
 * future candles are never visible. This guarantees zero look-ahead bias.
 */
export class ReplayEngine {
  private readonly allCandles: readonly Candle[]
  private readonly symbol: string
  private readonly interval: Timeframe
  private readonly config?: Partial<PipelineConfig>
  private _index: number

  constructor(options: ReplayEngineOptions) {
    if (options.candles.length < REPLAY_MIN_CANDLES) {
      throw new Error(
        `ReplayEngine requires at least ${REPLAY_MIN_CANDLES} candles, got ${options.candles.length}`,
      )
    }
    this.allCandles = Object.freeze([...options.candles])
    this.symbol   = options.symbol
    this.interval = options.interval
    this.config   = options.config

    const requestedStart = options.startIndex ?? REPLAY_MIN_CANDLES - 1
    this._index = Math.max(REPLAY_MIN_CANDLES - 1, Math.min(requestedStart, options.candles.length - 1))
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  get currentIndex(): number  { return this._index }
  get totalCandles(): number  { return this.allCandles.length }
  get minIndex(): number      { return REPLAY_MIN_CANDLES - 1 }
  get maxIndex(): number      { return this.allCandles.length - 1 }
  get isAtStart(): boolean    { return this._index <= this.minIndex }
  get isAtEnd(): boolean      { return this._index >= this.maxIndex }
  get progress(): number      { return this._index / this.maxIndex }

  // ── Navigation ───────────────────────────────────────────────────────────────

  /** Run the pipeline at the current position without advancing */
  currentFrame(): Promise<ReplayFrame> {
    return this.computeFrame(this._index)
  }

  /** Advance one candle. Returns null if already at the end. */
  async stepForward(): Promise<ReplayFrame | null> {
    if (this.isAtEnd) return null
    return this.computeFrame(++this._index)
  }

  /** Retreat one candle. Returns null if already at the start. */
  async stepBack(): Promise<ReplayFrame | null> {
    if (this.isAtStart) return null
    return this.computeFrame(--this._index)
  }

  /** Jump forward n candles (clamped to end) */
  jumpForward(n = 10): Promise<ReplayFrame> {
    this._index = Math.min(this._index + n, this.maxIndex)
    return this.computeFrame(this._index)
  }

  /** Jump back n candles (clamped to start) */
  jumpBack(n = 10): Promise<ReplayFrame> {
    this._index = Math.max(this._index - n, this.minIndex)
    return this.computeFrame(this._index)
  }

  /** Jump to an absolute index (clamped) */
  jumpToIndex(index: number): Promise<ReplayFrame> {
    this._index = Math.max(this.minIndex, Math.min(index, this.maxIndex))
    return this.computeFrame(this._index)
  }

  /** Jump to the candle whose openTime is nearest to (but not after) timestamp (ms) */
  jumpToTimestamp(timestamp: number): Promise<ReplayFrame> {
    let idx = this.minIndex
    for (let i = 0; i < this.allCandles.length; i++) {
      if (this.allCandles[i].openTime <= timestamp) idx = i
      else break
    }
    return this.jumpToIndex(idx)
  }

  /** Reset to the first valid frame */
  restart(): Promise<ReplayFrame> {
    this._index = this.minIndex
    return this.computeFrame(this._index)
  }

  // ── Pipeline execution ────────────────────────────────────────────────────────

  private async computeFrame(index: number): Promise<ReplayFrame> {
    // Expose only candles[0..index] — this is the no-look-ahead guarantee.
    const visible = this.allCandles.slice(0, index + 1) as Candle[]
    const ticker   = buildTicker(this.symbol, visible)
    const fetchedAt = visible[visible.length - 1].closeTime

    const result = await analyzeMarket({
      symbol:   this.symbol,
      interval: this.interval,
      config:   this.config,
      fetchImpl: async (sym, tf) => ({
        symbol:      sym.toUpperCase(),
        timeframe:   tf,
        fetchedAt,
        candles:     visible,
        ticker,
        fundingRate:  null,
        openInterest: null,
      }),
    })

    return {
      index,
      candleTimestamp: this.allCandles[index].openTime,
      candles: visible,
      result,
    }
  }
}
