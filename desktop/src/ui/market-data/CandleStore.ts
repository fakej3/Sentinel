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
import { selectEvictionCandidates } from './eviction'
import type { EvictionCandidate } from './eviction'

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
/** Inactive AND idle (unsubscribed, not mid-load) series kept in memory before LRU eviction. */
const MAX_CACHED_SERIES = 6
/**
 * Debounce window for persistence writes triggered by rapid, repeated
 * activity (successive backfill chunks, successive candle closes). Multiple
 * calls within this window collapse into a single write of whatever the
 * buffer looks like when the timer fires — not one write per call.
 */
const PERSIST_DEBOUNCE_MS = 2_000
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
  /** Pending debounced persistence write, if any. See PERSIST_DEBOUNCE_MS. */
  persistTimer: ReturnType<typeof setTimeout> | null
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

/**
 * Freeze each newly-created candle so it can never be mutated after entering
 * the store. Candle has only primitive numeric fields (no nested objects),
 * so a shallow Object.freeze is a complete immutability boundary — no
 * deep/recursive freeze is needed. Cost is O(k) for k NEW candles per call
 * (freezing an already-frozen object is a fast no-op check under the hood),
 * negligible next to the REST/JSON-parse work that produced them — this is
 * not a case where freezing is "too expensive."
 *
 * Only NEW candles need freezing here; candles already in entry.candles from
 * a prior assignment are already frozen (every assignment site freezes
 * before writing), so re-running this over the full merged array each time
 * would just be redundant no-op checks — callers freeze only the incoming
 * slice, then freeze the array wrapper of the merge result separately via
 * freezeArray().
 */
function freezeCandles(candles: Candle[]): void {
  for (const c of candles) Object.freeze(c)
}

/**
 * Freeze the array wrapper itself (blocks push/splice/index-assignment).
 * Element mutation is blocked separately by freezeCandles() on the elements
 * that were new when they entered the store.
 *
 * Deliberate scope limitation: the public Candle[]/CandleUpdate types are
 * NOT changed to `readonly Candle[]`. Doing so would be the fully rigorous
 * version of this contract (a compile-time guarantee, not just a runtime
 * one) but would ripple `readonly` through every overlay and consumer that
 * touches candles — out of scope for the market-data subsystem and
 * explicitly excluded by prior instruction not to touch overlay/drawing
 * code. The cast below confines that gap to this one call site: the type
 * system will not catch a violation, only a thrown TypeError at the actual
 * mutation site will. That is a real, accepted tradeoff, not an oversight.
 */
function freezeArray(candles: Candle[]): Candle[] {
  return Object.freeze(candles) as Candle[]
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
   *
   * The entry this operates on has zero listeners (fetchSnapshot never
   * subscribes), which would normally make it eviction-eligible — but it is
   * provably protected for the full duration of this method: `initialLoad`
   * is assigned synchronously before ensureColdLoad's first await, and
   * `backfilling` is set synchronously at the top of every loadOlder call
   * before ITS first await, so there is no window between iterations where
   * a concurrent evictIfNeeded() (triggered by an unrelated subscribe())
   * could observe this entry as idle. See eviction.ts for the policy this
   * relies on.
   *
   * Deliberately does NOT call evictIfNeeded() on completion: a series that
   * has just finished loading is, by definition, the single most-idle entry
   * at that instant, so self-triggering a sweep here would tend to evict the
   * very data this call just fetched — defeating repeated fetchSnapshot
   * calls' ability to reuse a warm buffer (e.g. re-analyzing the same pair).
   * Eviction pressure from ordinary subscribe() churn is sufficient to keep
   * the cache bounded over time without this entry doing it to itself.
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

  /**
   * Warm the cache for a series in the background (no listeners, no socket).
   * Does not call evictIfNeeded() on completion, for the same reason as
   * fetchSnapshot above — doubly so here, since prefetch's entire purpose is
   * to keep data warm for a later subscribe(); self-evicting the moment the
   * load finishes would be actively counterproductive.
   */
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
      freezeCandles(fresh)

      let merged = [...fresh, ...entry.candles]
      if (merged.length > MAX_BUFFER) merged = merged.slice(merged.length - MAX_BUFFER)
      entry.candles = freezeArray(merged)
      this.notify(entry, { type: 'backfill', candles: entry.candles, market: entry.market })
      // Debounced, not forced: a fast scroll can trigger many chunks in a
      // row, and each one writing the full (growing) buffer to IndexedDB
      // would be wasted work — coalesce into one write after activity settles.
      this.persistDebounced(entry)
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
      // Cancel rather than flush: dispose() means the store is going away
      // now (test teardown; the singleton has no production call site),
      // not "series is retiring but the app keeps running" — kicking off a
      // fresh async write while tearing down is not something to guarantee.
      if (entry.persistTimer !== null) {
        clearTimeout(entry.persistTimer)
        entry.persistTimer = null
      }
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
        persistTimer: null,
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
    if (this.persistence) {
      const hydrated = await this.persistence.load(entry.key)
      if (hydrated && hydrated.length > 0 && entry.candles.length === 0) {
        const valid = hydrated.filter(isValidCandle)
        freezeCandles(valid)  // fresh from JSON.parse — not frozen yet
        entry.candles = freezeArray(valid)
        this.notify(entry, { type: 'snapshot', candles: entry.candles, market: entry.market, fromCache: true })
      }
    }

    // 2. REST refresh — always, so hydrated data is reconciled with reality.
    try {
      const { candles: fresh, market } = await this.provider.fetchCandles(
        entry.symbol, entry.interval, { limit: INITIAL_CANDLES },
      )
      const freshValid = fresh.filter(isValidCandle)
      freezeCandles(freshValid)
      entry.market  = market
      entry.candles = freezeArray(this.mergeCachedWithFresh(entry.candles, freshValid, entry.interval))
      if (freshValid.length < INITIAL_CANDLES && entry.candles.length === freshValid.length) {
        entry.historyExhausted = true
      }
      this.notify(entry, { type: 'snapshot', candles: entry.candles, market })
      this.persistNow(entry)
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
    Object.freeze(live)

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

    entry.candles = freezeArray(next)
    this.notify(entry, {
      type: 'tick',
      candles: entry.candles,
      tick: live,
      tickClosed: live.isClosed,
      market: entry.market,
    })
    if (live.isClosed) this.persistDebounced(entry)
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
        freezeCandles(valid)

        const firstNew = valid[0].openTime
        let cut = entry.candles.length
        while (cut > 0 && entry.candles[cut - 1].openTime >= firstNew) cut--
        let merged = entry.candles.slice(0, cut).concat(valid)
        if (merged.length > MAX_BUFFER) merged = merged.slice(merged.length - MAX_BUFFER)

        const grew = merged.length !== entry.candles.length ||
          merged[merged.length - 1].openTime !== entry.candles[entry.candles.length - 1].openTime
        entry.candles = freezeArray(merged)
        changed = true

        if (!grew || valid.length < chunk) break
      }

      if (changed) {
        this.notify(entry, { type: 'snapshot', candles: entry.candles, market: entry.market })
        // Immediate, not debounced: gap repair is infrequent (fires only on
        // reconnect-after-drop) and its result should be captured promptly.
        this.persistNow(entry)
      }
    } catch {
      // Repair is best-effort; the next reconnect (or tick) tries again.
      entry.disconnected = true
    } finally {
      entry.repairing = false
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  /** Write immediately. Used for infrequent, significant events (cold load, gap repair). */
  private persistNow(entry: SeriesEntry): void {
    if (!this.persistence || entry.candles.length === 0) return
    if (entry.persistTimer !== null) {
      clearTimeout(entry.persistTimer)
      entry.persistTimer = null
    }
    entry.lastPersistAt = Date.now()
    void this.persistence.save(entry.key, entry.candles).catch(() => { /* cache is best-effort */ })
  }

  /**
   * Schedule a write after PERSIST_DEBOUNCE_MS of no further scheduling.
   * Used for potentially-rapid events (successive backfill chunks, successive
   * candle closes) — repeated calls within the window collapse into exactly
   * one write of whatever entry.candles is when the timer fires, rather than
   * one write per call.
   */
  private persistDebounced(entry: SeriesEntry): void {
    if (!this.persistence || entry.candles.length === 0) return
    if (entry.persistTimer !== null) return  // already scheduled — it reads entry.candles at fire time
    entry.persistTimer = setTimeout(() => {
      entry.persistTimer = null
      entry.lastPersistAt = Date.now()
      void this.persistence!.save(entry.key, entry.candles).catch(() => { /* cache is best-effort */ })
    }, PERSIST_DEBOUNCE_MS)
  }

  /** Fire a pending debounced write immediately instead of losing it (used before eviction). */
  private flushPersist(entry: SeriesEntry): void {
    if (entry.persistTimer !== null) {
      clearTimeout(entry.persistTimer)
      entry.persistTimer = null
      this.persistNow(entry)
    }
  }

  private notify(entry: SeriesEntry, update: CandleUpdate): void {
    for (const listener of entry.listeners) listener(update)
  }

  // ── Eviction ───────────────────────────────────────────────────────────────

  /** True while any async operation is in flight for this entry — protects it from eviction. */
  private isBusy(entry: SeriesEntry): boolean {
    return entry.initialLoad !== null || entry.backfilling || entry.repairing
  }

  private evictIfNeeded(): void {
    const candidates: EvictionCandidate[] = [...this.series.values()].map(e => ({
      key: e.key,
      listenerCount: e.listeners.size,
      busy: this.isBusy(e),
      lastAccess: e.lastAccess,
    }))

    for (const key of selectEvictionCandidates(candidates, MAX_CACHED_SERIES)) {
      const e = this.series.get(key)
      if (!e) continue
      this.flushPersist(e)  // don't lose a pending debounced write on eviction
      e.unsubWs?.()
      this.series.delete(key)  // persisted copy remains for instant rehydration
    }
  }
}

/** App-wide singleton — every consumer shares one store. */
export const candleStore = new CandleStore()
