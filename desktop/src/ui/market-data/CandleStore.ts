/**
 * CandleStore — the single source of truth for market candles in the UI.
 *
 * Responsibilities:
 *   - One candle series per (symbol, interval), shared by every consumer
 *     (chart, overlays, HUD, future indicators).
 *   - Initial history load + chained REST pagination for deeper backfill.
 *   - Owns the live WebSocket lifecycle: one socket per active series,
 *     opened on first subscriber, closed on last unsubscribe.
 *   - Merges live ticks into the buffer (replace-or-append by openTime).
 *   - Bounded memory: buffer capped, inactive series evicted LRU.
 *
 * Consumers never fetch candles themselves and never keep private buffers —
 * they subscribe and receive immutable snapshots.
 *
 * The store is provider-agnostic: all exchange I/O goes through the
 * CandleProvider interface. BinanceProvider is the default implementation.
 */
import type { Candle, Timeframe } from '../../modules/market/types'
import type { LiveCandle } from '../../modules/binance/ws'
import { fetchCandlesAuto } from '../../modules/binance/endpoints'
import { subscribeLiveCandles } from '../../modules/binance/ws'

// ── Tunables ──────────────────────────────────────────────────────────────────

/** Candles fetched on first load of a series (single REST request). */
export const INITIAL_CANDLES = 1000
/** Candles fetched per backfill request when the user scrolls into history. */
export const BACKFILL_CHUNK = 1000
/** Hard cap on candles kept per series (oldest evicted beyond this). */
export const MAX_BUFFER = 5000
/** Inactive (unsubscribed) series kept cached before LRU eviction. */
const MAX_CACHED_SERIES = 6

// ── Provider abstraction ──────────────────────────────────────────────────────

export type MarketKind = 'spot' | 'futures'

export interface CandleProvider {
  /**
   * Fetch up to `limit` candles ending at `endTime` (exclusive) or at the
   * present when `endTime` is undefined. Returns candles sorted ascending.
   */
  fetchCandles(
    symbol: string,
    interval: Timeframe,
    limit: number,
    market?: MarketKind,
    endTime?: number,
  ): Promise<{ candles: Candle[]; market: MarketKind }>

  /** Subscribe to live candle updates. Returns an unsubscribe function. */
  subscribeLive(
    symbol: string,
    interval: Timeframe,
    market: MarketKind,
    onCandle: (candle: LiveCandle) => void,
  ): () => void
}

export class BinanceProvider implements CandleProvider {
  fetchCandles(
    symbol: string,
    interval: Timeframe,
    limit: number,
    market?: MarketKind,
    endTime?: number,
  ): Promise<{ candles: Candle[]; market: MarketKind }> {
    return fetchCandlesAuto(symbol, interval, limit, market, endTime)
  }

  subscribeLive(
    symbol: string,
    interval: Timeframe,
    market: MarketKind,
    onCandle: (candle: LiveCandle) => void,
  ): () => void {
    return subscribeLiveCandles(symbol, interval, onCandle, market)
  }
}

// ── Update events ─────────────────────────────────────────────────────────────

export type CandleUpdateType = 'snapshot' | 'backfill' | 'tick'

export interface CandleUpdate {
  type: CandleUpdateType
  /** Full sorted buffer. A new array reference on every structural change. */
  candles: Candle[]
  /** The live candle for 'tick' updates (may be unclosed). */
  tick?: LiveCandle
  /** True when the tick closed a candle (consumers may recompute derived series). */
  tickClosed?: boolean
  market: MarketKind
}

export type CandleListener = (update: CandleUpdate) => void

// ── Internal series entry ─────────────────────────────────────────────────────

interface SeriesEntry {
  key: string
  symbol: string
  interval: Timeframe
  market: MarketKind
  /** Sorted ascending by openTime. Replaced (never mutated) on change. */
  candles: Candle[]
  listeners: Set<CandleListener>
  unsubWs: (() => void) | null
  /** True once a backfill returned fewer candles than requested (history exhausted). */
  historyExhausted: boolean
  initialLoad: Promise<void> | null
  backfilling: boolean
  lastAccess: number
}

function seriesKey(symbol: string, interval: Timeframe): string {
  return `${symbol.toUpperCase()}:${interval}`
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class CandleStore {
  private readonly provider: CandleProvider
  private readonly series = new Map<string, SeriesEntry>()

  constructor(provider: CandleProvider = new BinanceProvider()) {
    this.provider = provider
  }

  /**
   * Subscribe to a (symbol, interval) series.
   * - First subscriber triggers the initial load and opens the live socket.
   * - If the series is already cached, the listener receives a snapshot
   *   immediately (synchronously) and live updates resume.
   * - Returns an unsubscribe function. The last unsubscribe closes the
   *   socket but keeps the data cached for instant re-entry.
   *
   * Errors from the initial load are delivered via `onError`; the
   * subscription stays registered so a later `retry()` can recover.
   */
  subscribe(
    symbol: string,
    interval: Timeframe,
    listener: CandleListener,
    onError?: (err: unknown) => void,
  ): () => void {
    const key = seriesKey(symbol, interval)
    let entry = this.series.get(key)

    if (!entry) {
      entry = {
        key,
        symbol: symbol.toUpperCase(),
        interval,
        market: 'spot',
        candles: [],
        listeners: new Set(),
        unsubWs: null,
        historyExhausted: false,
        initialLoad: null,
        backfilling: false,
        lastAccess: Date.now(),
      }
      this.series.set(key, entry)
    }

    entry.listeners.add(listener)
    entry.lastAccess = Date.now()

    if (entry.candles.length > 0) {
      // Cached — replay immediately
      listener({ type: 'snapshot', candles: entry.candles, market: entry.market })
      this.ensureLive(entry)
    } else {
      // Cold — load then go live
      if (!entry.initialLoad) {
        entry.initialLoad = this.loadInitial(entry).catch(err => {
          entry!.initialLoad = null
          throw err
        })
      }
      entry.initialLoad
        .then(() => {
          if (entry!.listeners.size > 0) this.ensureLive(entry!)
        })
        .catch(err => onError?.(err))
    }

    this.evictIfNeeded()

    return () => {
      const e = this.series.get(key)
      if (!e) return
      e.listeners.delete(listener)
      if (e.listeners.size === 0 && e.unsubWs) {
        e.unsubWs()
        e.unsubWs = null
      }
    }
  }

  /** Current buffer for a series, or null if not loaded. */
  getCandles(symbol: string, interval: Timeframe): Candle[] | null {
    const entry = this.series.get(seriesKey(symbol, interval))
    return entry && entry.candles.length > 0 ? entry.candles : null
  }

  /**
   * Load older history before the current oldest candle.
   * Returns the number of candles added (0 when history is exhausted or a
   * backfill is already in flight). Notifies listeners with type 'backfill'.
   */
  async loadOlder(symbol: string, interval: Timeframe): Promise<number> {
    const entry = this.series.get(seriesKey(symbol, interval))
    if (!entry || entry.candles.length === 0) return 0
    if (entry.backfilling || entry.historyExhausted) return 0
    if (entry.candles.length >= MAX_BUFFER) return 0

    entry.backfilling = true
    try {
      const oldest = entry.candles[0].openTime
      const { candles: older } = await this.provider.fetchCandles(
        entry.symbol, entry.interval, BACKFILL_CHUNK, entry.market, oldest - 1,
      )
      if (older.length < BACKFILL_CHUNK) entry.historyExhausted = true

      // Dedupe against the existing buffer, keep only strictly-older candles
      const fresh = older.filter(c => c.openTime < oldest)
      if (fresh.length === 0) {
        entry.historyExhausted = true
        return 0
      }

      let merged = [...fresh, ...entry.candles]
      if (merged.length > MAX_BUFFER) merged = merged.slice(merged.length - MAX_BUFFER)
      entry.candles = merged
      this.notify(entry, { type: 'backfill', candles: merged, market: entry.market })
      return fresh.length
    } finally {
      entry.backfilling = false
    }
  }

  /** Retry a failed initial load (e.g. after a network error). */
  async retry(symbol: string, interval: Timeframe): Promise<void> {
    const entry = this.series.get(seriesKey(symbol, interval))
    if (!entry || entry.candles.length > 0) return
    entry.initialLoad = this.loadInitial(entry).catch(err => {
      entry.initialLoad = null
      throw err
    })
    await entry.initialLoad
    if (entry.listeners.size > 0) this.ensureLive(entry)
  }

  /** Dispose everything (app teardown / tests). */
  dispose(): void {
    for (const entry of this.series.values()) {
      entry.unsubWs?.()
      entry.unsubWs = null
      entry.listeners.clear()
    }
    this.series.clear()
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async loadInitial(entry: SeriesEntry): Promise<void> {
    const { candles, market } = await this.provider.fetchCandles(
      entry.symbol, entry.interval, INITIAL_CANDLES,
    )
    entry.market = market
    entry.candles = candles
    if (candles.length < INITIAL_CANDLES) entry.historyExhausted = true
    this.notify(entry, { type: 'snapshot', candles, market })
  }

  private ensureLive(entry: SeriesEntry): void {
    if (entry.unsubWs) return
    entry.unsubWs = this.provider.subscribeLive(
      entry.symbol, entry.interval, entry.market,
      live => this.applyTick(entry, live),
    )
  }

  private applyTick(entry: SeriesEntry, live: LiveCandle): void {
    const prev = entry.candles
    const last = prev[prev.length - 1]

    let next: Candle[]
    if (last && last.openTime === live.openTime) {
      // Update the in-progress candle (fast path — replace last element)
      next = prev.slice(0, -1)
      next.push(live)
    } else if (!last || live.openTime > last.openTime) {
      next = prev.concat(live)
      if (next.length > MAX_BUFFER) next = next.slice(next.length - MAX_BUFFER)
    } else {
      // Out-of-order tick for an older candle — ignore (REST history wins)
      return
    }

    entry.candles = next
    this.notify(entry, {
      type: 'tick',
      candles: next,
      tick: live,
      tickClosed: live.isClosed,
      market: entry.market,
    })
  }

  private notify(entry: SeriesEntry, update: CandleUpdate): void {
    for (const listener of entry.listeners) listener(update)
  }

  private evictIfNeeded(): void {
    const inactive = [...this.series.values()].filter(e => e.listeners.size === 0)
    if (inactive.length <= MAX_CACHED_SERIES) return
    inactive.sort((a, b) => a.lastAccess - b.lastAccess)
    const toEvict = inactive.slice(0, inactive.length - MAX_CACHED_SERIES)
    for (const e of toEvict) {
      e.unsubWs?.()
      this.series.delete(e.key)
    }
  }
}

/** App-wide singleton — every consumer shares one store. */
export const candleStore = new CandleStore()
