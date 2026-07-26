/**
 * CandleStore — the single source of truth for market candles.
 *
 * Responsibilities:
 *   - One candle series per (symbol, interval), shared by every consumer:
 *     chart, overlays, replay, analysis fetch, future indicators.
 *   - Initial history load, chained REST pagination for deep backfill, and
 *     persistent caching (IndexedDB) for instant warm starts.
 *   - Owns the live WebSocket lifecycle. The socket layer emits events only;
 *     ALL merge decisions happen here: update in-progress candle, append
 *     closed candle, reject invalid or out-of-order data.
 *   - Gap recovery: after a WebSocket reconnect, candles missed while the
 *     socket was down are re-fetched via REST and merged forward.
 *   - Bounded memory: per-series buffer cap, LRU eviction of inactive series
 *     (evicted series rehydrate instantly from the persistent cache).
 *
 * Consumers never fetch candles themselves and never keep private buffers —
 * they subscribe (live) or fetchSnapshot (one-shot) and receive immutable
 * snapshots.
 *
 * Provider-agnostic: all exchange I/O goes through CandleProvider.
 */
import type { Candle, Timeframe } from '../../modules/market/types'
import type {
  CandleProvider,
  CandlePersistence,
  CandleListener,
  CandleUpdate,
  LiveCandle,
  LiveStreamStatus,
  MarketKind,
} from './types'
import { BinanceProvider } from './providers/BinanceProvider'
import { createDefaultCandleCache } from './cache/CandleCache'

export type { CandleProvider, CandlePersistence, CandleListener, CandleUpdate, MarketKind } from './types'
export { BinanceProvider } from './providers/BinanceProvider'

// ── Tunables ──────────────────────────────────────────────────────────────────

/** Candles fetched on first load of a series (single REST request). */
export const INITIAL_CANDLES = 1000
/**
 * Hard cap on candles kept in memory per series. Backfill pagination continues
 * until exchange history is exhausted or this cap is reached.
 * 50k ≈ 5.7 years of 1h candles, 34 days of 1m, 136 years of 1d.
 */
export const MAX_BUFFER = 50_000
/** Inactive (unsubscribed) series kept in memory before LRU eviction. */
const MAX_CACHED_SERIES = 6
/** Minimum interval between persistence writes triggered by live ticks. */
const PERSIST_THROTTLE_MS = 30_000
/** Safety bound on chained requests in a single gap-repair pass. */
const MAX_REPAIR_CHUNKS = 5

/** Milliseconds per timeframe — used for cache-merge gap tolerance. */
const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000, '3m': 180_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '2h': 7_200_000, '4h': 14_400_000, '6h': 21_600_000,
  '8h': 28_800_000, '12h': 43_200_000,
  '1d': 86_400_000, '3d': 259_200_000, '1w': 604_800_000, '1M': 2_592_000_000,
}

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
  /** True once a backfill hit the start of exchange history. */
  historyExhausted: boolean
  initialLoad: Promise<void> | null
  backfilling: boolean
  repairing: boolean
  /** Set on WS drop; triggers gap repair on the next reconnect. */
  disconnected: boolean
  lastPersistAt: number
  lastAccess: number
}

function seriesKey(symbol: string, interval: Timeframe): string {
  return `${symbol.toUpperCase()}:${interval}`
}

function isValidCandle(c: Candle): boolean {
  return Number.isFinite(c.open) && Number.isFinite(c.high) &&
         Number.isFinite(c.low)  && Number.isFinite(c.close) &&
         Number.isFinite(c.volume) && c.openTime > 0 && c.high >= c.low
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class CandleStore {
  private readonly provider: CandleProvider
  private readonly persistence: CandlePersistence | null
  private readonly series = new Map<string, SeriesEntry>()

  constructor(
    provider: CandleProvider = new BinanceProvider(),
    persistence: CandlePersistence | null = createDefaultCandleCache(),
  ) {
    this.provider = provider
    this.persistence = persistence
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to a live (symbol, interval) series.
   * - Warm (in memory): snapshot delivered synchronously; live resumes.
   * - Cached (IndexedDB): hydrated snapshot delivered fast (`fromCache: true`),
   *   then a REST refresh reconciles and a fresh snapshot follows.
   * - Cold: REST load, then snapshot, then live.
   * The last unsubscribe closes the socket but keeps data cached.
   * `onError` fires only when the series ends up with no data at all.
   */
  subscribe(
    symbol: string,
    interval: Timeframe,
    listener: CandleListener,
    onError?: (err: unknown) => void,
  ): () => void {
    const entry = this.getOrCreate(symbol, interval)
    entry.listeners.add(listener)
    entry.lastAccess = Date.now()

    if (entry.candles.length > 0) {
      listener({ type: 'snapshot', candles: entry.candles, market: entry.market })
      this.ensureLive(entry)
    } else {
      this.ensureColdLoad(entry)
        .then(() => {
          if (entry.listeners.size > 0 && entry.candles.length > 0) this.ensureLive(entry)
        })
        .catch(err => onError?.(err))
    }

    this.evictIfNeeded()

    return () => {
      const e = this.series.get(entry.key)
      if (!e) return
      e.listeners.delete(listener)
      if (e.listeners.size === 0 && e.unsubWs) {
        e.unsubWs()
        e.unsubWs = null
      }
    }
  }

  /**
   * One-shot fetch of the most recent `count` candles WITHOUT subscribing to
   * live updates. Serves from memory when possible, otherwise loads (and
   * paginates) through the store so the result also warms the cache.
   * Used by replay and the desktop analysis pipeline.
   */
  async fetchSnapshot(
    symbol: string,
    interval: Timeframe,
    count: number,
  ): Promise<{ candles: Candle[]; market: MarketKind }> {
    const entry = this.getOrCreate(symbol, interval)
    entry.lastAccess = Date.now()

    if (entry.candles.length === 0) {
      await this.ensureColdLoad(entry)
    } else if (entry.initialLoad) {
      await entry.initialLoad
    }

    // Paginate older history until we have `count` candles or history ends.
    while (entry.candles.length < count) {
      const added = await this.loadOlder(symbol, interval)
      if (added === 0) break
    }

    const candles = entry.candles.length > count
      ? entry.candles.slice(entry.candles.length - count)
      : entry.candles
    return { candles, market: entry.market }
  }

  /** Warm the cache for a series in the background (no listeners, no socket). */
  prefetch(symbol: string, interval: Timeframe): void {
    const entry = this.getOrCreate(symbol, interval)
    if (entry.candles.length > 0 || entry.initialLoad) return
    void this.ensureColdLoad(entry).catch(() => { /* prefetch is best-effort */ })
  }

  /** Current in-memory buffer for a series, or null if not loaded. */
  getCandles(symbol: string, interval: Timeframe): Candle[] | null {
    const entry = this.series.get(seriesKey(symbol, interval))
    return entry && entry.candles.length > 0 ? entry.candles : null
  }

  /**
   * Load older history before the current oldest candle (one provider chunk).
   * Returns candles added (0 when exhausted, capped, or already in flight).
   * Notifies listeners with type 'backfill'.
   */
  async loadOlder(symbol: string, interval: Timeframe): Promise<number> {
    const entry = this.series.get(seriesKey(symbol, interval))
    if (!entry || entry.candles.length === 0) return 0
    if (entry.backfilling || entry.historyExhausted) return 0
    if (entry.candles.length >= MAX_BUFFER) return 0

    entry.backfilling = true
    try {
      const chunk  = this.provider.maxCandlesPerRequest
      const oldest = entry.candles[0].openTime
      const { candles: older } = await this.provider.fetchCandles(
        entry.symbol, entry.interval, { limit: chunk, endTime: oldest - 1 }, entry.market,
      )
      if (older.length < chunk) entry.historyExhausted = true

      const fresh = older.filter(c => isValidCandle(c) && c.openTime < oldest)
      if (fresh.length === 0) {
        entry.historyExhausted = true
        return 0
      }

      let merged = [...fresh, ...entry.candles]
      if (merged.length > MAX_BUFFER) merged = merged.slice(merged.length - MAX_BUFFER)
      entry.candles = merged
      this.notify(entry, { type: 'backfill', candles: merged, market: entry.market })
      this.persist(entry, true)
      return fresh.length
    } finally {
      entry.backfilling = false
    }
  }

  /** Retry a failed initial load (e.g. after a network error). */
  async retry(symbol: string, interval: Timeframe): Promise<void> {
    const entry = this.series.get(seriesKey(symbol, interval))
    if (!entry || entry.candles.length > 0) return
    await this.ensureColdLoad(entry)
    if (entry.listeners.size > 0 && entry.candles.length > 0) this.ensureLive(entry)
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

  // ── Cold load: cache hydration + REST refresh ───────────────────────────────

  private getOrCreate(symbol: string, interval: Timeframe): SeriesEntry {
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
        repairing: false,
        disconnected: false,
        lastPersistAt: 0,
        lastAccess: Date.now(),
      }
      this.series.set(key, entry)
    }
    return entry
  }

  /** Deduplicated cold-load: all concurrent callers share one promise. */
  private ensureColdLoad(entry: SeriesEntry): Promise<void> {
    if (!entry.initialLoad) {
      entry.initialLoad = this.loadCold(entry)
        .catch(err => {
          entry.initialLoad = null  // allow retry
          throw err
        })
        .then(() => { entry.initialLoad = null })
    }
    return entry.initialLoad
  }

  private async loadCold(entry: SeriesEntry): Promise<void> {
    // 1. Hydrate from the persistent cache for an instant (possibly stale) chart.
    let hydrated: Candle[] | null = null
    if (this.persistence) {
      hydrated = await this.persistence.load(entry.key)
      if (hydrated && hydrated.length > 0 && entry.candles.length === 0) {
        hydrated = hydrated.filter(isValidCandle)
        entry.candles = hydrated
        this.notify(entry, { type: 'snapshot', candles: hydrated, market: entry.market, fromCache: true })
      }
    }

    // 2. REST refresh — always, so hydrated data is reconciled with reality.
    try {
      const { candles: fresh, market } = await this.provider.fetchCandles(
        entry.symbol, entry.interval, { limit: INITIAL_CANDLES },
      )
      const freshValid = fresh.filter(isValidCandle)
      entry.market  = market
      entry.candles = this.mergeCachedWithFresh(entry.candles, freshValid, entry.interval)
      if (freshValid.length < INITIAL_CANDLES && entry.candles.length === freshValid.length) {
        entry.historyExhausted = true
      }
      this.notify(entry, { type: 'snapshot', candles: entry.candles, market })
      this.persist(entry, true)
    } catch (err) {
      // REST failed. With hydrated data the chart is still usable (stale);
      // without any data this is a hard failure surfaced to the caller.
      if (entry.candles.length === 0) throw err
      if (import.meta.env.DEV) console.warn('[CandleStore] REST refresh failed, serving cached data', err)
    }
  }

  /**
   * Merge persisted history with a fresh REST window.
   * Cached candles strictly older than the fresh window are kept only when the
   * two ranges join without a hole (tolerance: 2 intervals) — deep history
   * survives restarts, but a months-old cache can't silently splice a gap
   * into the middle of the buffer.
   */
  private mergeCachedWithFresh(cached: Candle[], fresh: Candle[], interval: Timeframe): Candle[] {
    if (fresh.length === 0) return cached
    if (cached.length === 0) return fresh

    const freshStart = fresh[0].openTime
    let cut = cached.length
    while (cut > 0 && cached[cut - 1].openTime >= freshStart) cut--
    const older = cached.slice(0, cut)

    if (older.length > 0) {
      const gap = freshStart - older[older.length - 1].openTime
      const tolerance = 2 * (TIMEFRAME_MS[interval] ?? 3_600_000)
      if (gap > tolerance) return fresh  // hole too large — drop stale history
    }

    let merged = [...older, ...fresh]
    if (merged.length > MAX_BUFFER) merged = merged.slice(merged.length - MAX_BUFFER)
    return merged
  }

  // ── Live stream: merge policy + gap recovery ────────────────────────────────

  private ensureLive(entry: SeriesEntry): void {
    if (entry.unsubWs) return
    entry.unsubWs = this.provider.subscribeLive(
      entry.symbol, entry.interval, entry.market,
      {
        onCandle: live => this.applyTick(entry, live),
        onStatus: status => this.handleStreamStatus(entry, status),
      },
    )
  }

  private applyTick(entry: SeriesEntry, live: LiveCandle): void {
    if (!isValidCandle(live)) return  // reject malformed frames

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
      // Out-of-order frame for an older candle — reject (REST history wins)
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
    if (live.isClosed) this.persist(entry, false)
  }

  private handleStreamStatus(entry: SeriesEntry, status: LiveStreamStatus): void {
    if (status === 'disconnected') {
      entry.disconnected = true
      return
    }
    if (status === 'connected' && entry.disconnected) {
      entry.disconnected = false
      void this.repairGap(entry)
    }
  }

  /**
   * After a reconnect, REST-fetch everything from the last known candle
   * forward and merge, so candles missed during the outage are recovered.
   * Emits one 'snapshot' when done.
   */
  private async repairGap(entry: SeriesEntry): Promise<void> {
    if (entry.repairing || entry.candles.length === 0) return
    entry.repairing = true
    try {
      const chunk = this.provider.maxCandlesPerRequest
      let changed = false

      for (let i = 0; i < MAX_REPAIR_CHUNKS; i++) {
        const last = entry.candles[entry.candles.length - 1]
        const { candles: fetched } = await this.provider.fetchCandles(
          entry.symbol, entry.interval,
          { limit: chunk, startTime: last.openTime },
          entry.market,
        )
        const valid = fetched.filter(isValidCandle)
        if (valid.length === 0) break

        const firstNew = valid[0].openTime
        let cut = entry.candles.length
        while (cut > 0 && entry.candles[cut - 1].openTime >= firstNew) cut--
        let merged = entry.candles.slice(0, cut).concat(valid)
        if (merged.length > MAX_BUFFER) merged = merged.slice(merged.length - MAX_BUFFER)

        const grew = merged.length !== entry.candles.length ||
          merged[merged.length - 1].openTime !== entry.candles[entry.candles.length - 1].openTime
        entry.candles = merged
        changed = true

        if (!grew || valid.length < chunk) break
      }

      if (changed) {
        this.notify(entry, { type: 'snapshot', candles: entry.candles, market: entry.market })
        this.persist(entry, true)
      }
    } catch {
      // Repair is best-effort; the next reconnect (or tick) tries again.
      entry.disconnected = true
    } finally {
      entry.repairing = false
    }
  }

  // ── Persistence + eviction ──────────────────────────────────────────────────

  private persist(entry: SeriesEntry, force: boolean): void {
    if (!this.persistence || entry.candles.length === 0) return
    const now = Date.now()
    if (!force && now - entry.lastPersistAt < PERSIST_THROTTLE_MS) return
    entry.lastPersistAt = now
    void this.persistence.save(entry.key, entry.candles).catch(() => { /* cache is best-effort */ })
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
      this.series.delete(e.key)  // persisted copy remains for instant rehydration
    }
  }
}

/** App-wide singleton — every consumer shares one store. */
export const candleStore = new CandleStore()
