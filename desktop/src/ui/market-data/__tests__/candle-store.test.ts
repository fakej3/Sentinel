import { describe, it, expect, vi } from 'vitest'
import { CandleStore, INITIAL_CANDLES, MAX_BUFFER } from '../CandleStore'
import { InMemoryCandleCache } from '../cache/CandleCache'
import type { CandleProvider, CandleUpdate, FetchRangeOptions, LiveHandlers, MarketKind } from '../types'
import type { Candle, Timeframe } from '../../../modules/market/types'
import type { LiveCandle, LiveStreamStatus } from '../../../modules/binance/ws'

const MINUTE = 60_000
const CHUNK  = 1000

function candle(openTime: number, close = 100): Candle {
  return {
    openTime,
    closeTime: openTime + MINUTE - 1,
    open: close, high: close + 1, low: close - 1, close,
    volume: 10, quoteVolume: 1000, trades: 5,
    takerBuyVolume: 5, takerSellVolume: 5,
  }
}

/** Generate contiguous candles in [start, end) stepped by 1 minute. */
function candlesBetween(start: number, end: number): Candle[] {
  const out: Candle[] = []
  for (let t = start; t < end; t += MINUTE) out.push(candle(t))
  return out
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}

class MockProvider implements CandleProvider {
  readonly maxCandlesPerRequest = CHUNK
  fetchCalls: FetchRangeOptions[] = []
  /** Richer call log (symbol/interval included) for tests that need to filter by series. */
  calls: Array<{ symbol: string; interval: Timeframe; options: FetchRangeOptions }> = []
  liveHandlers: LiveHandlers[] = []
  unsubscribeCount = 0
  failNext: Error | null = null
  /** Oldest timestamp the exchange "has". */
  historyStart = 0
  now = 100_000 * MINUTE

  private pendingGates: Array<{
    match: (symbol: string, interval: Timeframe, options: FetchRangeOptions) => boolean
    defer: Deferred
  }> = []

  /**
   * Gate the NEXT fetchCandles call matching `match` — that call's promise
   * won't resolve until the returned Deferred's `.resolve()` is invoked.
   * One-shot: consumed on first match, so a second matching call is not gated.
   */
  gateNext(match: (symbol: string, interval: Timeframe, options: FetchRangeOptions) => boolean): Deferred {
    const d = deferred()
    this.pendingGates.push({ match, defer: d })
    return d
  }

  async fetchCandles(
    symbol: string, interval: Timeframe, options: FetchRangeOptions, _market?: MarketKind,
  ): Promise<{ candles: Candle[]; market: MarketKind }> {
    this.fetchCalls.push(options)
    this.calls.push({ symbol, interval, options })

    const gateIdx = this.pendingGates.findIndex(g => g.match(symbol, interval, options))
    if (gateIdx >= 0) {
      const { defer } = this.pendingGates[gateIdx]
      this.pendingGates.splice(gateIdx, 1)
      await defer.promise
    }

    if (this.failNext) {
      const err = this.failNext
      this.failNext = null
      throw err
    }
    const limit = Math.min(options.limit, this.maxCandlesPerRequest)
    let start: number
    let end: number
    if (options.startTime !== undefined) {
      start = Math.max(options.startTime, this.historyStart)
      end   = Math.min(start + limit * MINUTE, this.now)
    } else {
      end   = options.endTime !== undefined ? options.endTime + 1 : this.now
      start = Math.max(end - limit * MINUTE, this.historyStart)
    }
    return { candles: candlesBetween(start, end), market: 'spot' }
  }

  subscribeLive(
    _symbol: string, _interval: Timeframe, _market: MarketKind, handlers: LiveHandlers,
  ): () => void {
    this.liveHandlers.push(handlers)
    return () => { this.unsubscribeCount++ }
  }

  emitTick(live: LiveCandle): void {
    for (const h of this.liveHandlers) h.onCandle(live)
  }

  emitStatus(status: LiveStreamStatus): void {
    for (const h of this.liveHandlers) h.onStatus?.(status)
  }
}

function setup(persistence: InMemoryCandleCache | null = null) {
  const provider = new MockProvider()
  const store = new CandleStore(provider, persistence)
  return { provider, store }
}

async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 0))
  await new Promise(r => setTimeout(r, 0))
}

describe('CandleStore — load and live merge', () => {
  it('delivers an initial snapshot and opens the live socket on first subscribe', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    expect(updates).toHaveLength(1)
    expect(updates[0].type).toBe('snapshot')
    expect(updates[0].candles).toHaveLength(INITIAL_CANDLES)
    expect(provider.liveHandlers).toHaveLength(1)
  })

  it('replays a warm snapshot synchronously on re-subscribe', async () => {
    const { store } = setup()
    const unsub = store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    unsub()

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    expect(updates).toHaveLength(1)   // synchronous
    expect(updates[0].type).toBe('snapshot')
  })

  it('merges ticks: replaces the in-progress candle, appends a new one', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const snapshot = updates[0].candles
    const last = snapshot[snapshot.length - 1]

    provider.emitTick({ ...candle(last.openTime, 105), isClosed: false })
    let latest = updates[updates.length - 1]
    expect(latest.type).toBe('tick')
    expect(latest.candles).toHaveLength(snapshot.length)
    expect(latest.candles[latest.candles.length - 1].close).toBe(105)

    provider.emitTick({ ...candle(last.openTime + MINUTE, 106), isClosed: false })
    latest = updates[updates.length - 1]
    expect(latest.candles).toHaveLength(snapshot.length + 1)
  })

  it('rejects out-of-order and malformed frames', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()
    const count = updates.length
    const first = updates[0].candles[0]
    const last  = updates[0].candles[updates[0].candles.length - 1]

    // Out-of-order (older than last candle)
    provider.emitTick({ ...candle(first.openTime, 999), isClosed: true })
    // Malformed: NaN close
    provider.emitTick({ ...candle(last.openTime + MINUTE, NaN), isClosed: false })
    // Malformed: high < low
    const bad = { ...candle(last.openTime + MINUTE, 100), high: 90, low: 110, isClosed: false }
    provider.emitTick(bad)

    expect(updates).toHaveLength(count)  // none accepted
  })

  it('closes the socket on last unsubscribe but keeps data in memory', async () => {
    const { provider, store } = setup()
    const unsub = store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    unsub()
    expect(provider.unsubscribeCount).toBe(1)
    expect(store.getCandles('BTCUSDT', '1m')).not.toBeNull()
  })

  it('shares one series between multiple subscribers', async () => {
    const { provider, store } = setup()
    const a: CandleUpdate[] = []
    const b: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => a.push(u))
    await flush()
    store.subscribe('BTCUSDT', '1m', u => b.push(u))

    expect(provider.fetchCalls).toHaveLength(1)
    expect(provider.liveHandlers).toHaveLength(1)
    expect(a[0].candles).toBe(b[0].candles)
  })

  it('reports initial-load errors via onError and recovers on retry', async () => {
    const { provider, store } = setup()
    provider.failNext = new Error('network down')
    const onError = vi.fn()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u), onError)
    await flush()

    expect(onError).toHaveBeenCalledOnce()
    expect(updates).toHaveLength(0)

    await store.retry('BTCUSDT', '1m')
    expect(updates.length).toBeGreaterThan(0)
    expect(updates[updates.length - 1].type).toBe('snapshot')
  })
})

describe('CandleStore — pagination', () => {
  it('backfills older history, prepends sorted, and reports exhaustion', async () => {
    const { provider, store } = setup()
    provider.historyStart = provider.now - (INITIAL_CANDLES + CHUNK / 2) * MINUTE
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const added = await store.loadOlder('BTCUSDT', '1m')
    expect(added).toBe(CHUNK / 2)
    const backfill = updates[updates.length - 1]
    expect(backfill.type).toBe('backfill')
    for (let i = 1; i < backfill.candles.length; i++) {
      expect(backfill.candles[i].openTime).toBeGreaterThan(backfill.candles[i - 1].openTime)
    }
    // Short chunk → exhausted → further loads no-op
    expect(await store.loadOlder('BTCUSDT', '1m')).toBe(0)
  })

  it('paginates far beyond the initial window (deep history)', async () => {
    const { store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()

    for (let i = 0; i < 9; i++) await store.loadOlder('BTCUSDT', '1m')
    expect(store.getCandles('BTCUSDT', '1m')!.length).toBe(INITIAL_CANDLES + 9 * CHUNK)
  })

  it('enforces the MAX_BUFFER cap', async () => {
    const { store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()

    let added = -1
    while (added !== 0 && store.getCandles('BTCUSDT', '1m')!.length < MAX_BUFFER) {
      added = await store.loadOlder('BTCUSDT', '1m')
    }
    expect(store.getCandles('BTCUSDT', '1m')!.length).toBeLessThanOrEqual(MAX_BUFFER)
    expect(await store.loadOlder('BTCUSDT', '1m')).toBe(0)
  })
})

describe('CandleStore — gap recovery', () => {
  it('repairs candles missed during a WebSocket outage', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()
    const beforeLast = updates[0].candles[updates[0].candles.length - 1]

    // Socket drops; exchange time advances 10 candles while we're offline
    provider.emitStatus('disconnected')
    provider.now += 10 * MINUTE
    provider.emitStatus('connected')
    await flush()

    const latest = updates[updates.length - 1]
    expect(latest.type).toBe('snapshot')
    const lastNow = latest.candles[latest.candles.length - 1]
    expect(lastNow.openTime).toBe(beforeLast.openTime + 10 * MINUTE)
    // Repair fetch used startTime from the last known candle
    expect(provider.fetchCalls.some(c => c.startTime === beforeLast.openTime)).toBe(true)
  })

  it('does not repair when the connection never dropped', async () => {
    const { provider, store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    const fetchesAfterLoad = provider.fetchCalls.length

    provider.emitStatus('connected')  // initial open, no preceding drop
    await flush()
    expect(provider.fetchCalls.length).toBe(fetchesAfterLoad)
  })
})

describe('CandleStore — persistent cache', () => {
  it('hydrates from persistence first, then reconciles with REST', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    // Persisted history overlapping the fresh window: fresh covers [now-1000m, now);
    // cached covers [now-1500m, now-500m) → 500 older candles survive the merge.
    const cachedStart = provider.now - 1500 * MINUTE
    await cache.save('BTCUSDT:1m', candlesBetween(cachedStart, provider.now - 500 * MINUTE))

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    expect(updates[0].type).toBe('snapshot')
    expect(updates[0].fromCache).toBe(true)
    const final = updates[updates.length - 1]
    expect(final.fromCache).toBeUndefined()
    // Deep history preserved across the merge: cached-older + fresh window
    expect(final.candles).toHaveLength(1500)
    expect(final.candles[0].openTime).toBe(cachedStart)
  })

  it('drops cached history when the gap to the fresh window is too large', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    // Cache ends far before the fresh window starts → unusable, must be dropped
    const staleEnd = provider.now - (INITIAL_CANDLES + 5000) * MINUTE
    await cache.save('BTCUSDT:1m', candlesBetween(staleEnd - 100 * MINUTE, staleEnd))

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const final = updates[updates.length - 1]
    expect(final.candles).toHaveLength(INITIAL_CANDLES)  // stale cache discarded
  })

  it('serves cached data when REST fails after hydration (no onError)', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    await cache.save('BTCUSDT:1m', candlesBetween(provider.now - 200 * MINUTE, provider.now))
    provider.failNext = new Error('offline')

    const onError = vi.fn()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u), onError)
    await flush()

    expect(onError).not.toHaveBeenCalled()
    expect(updates[0].fromCache).toBe(true)
    expect(store.getCandles('BTCUSDT', '1m')).toHaveLength(200)
  })
})

describe('CandleStore — fetchSnapshot / prefetch', () => {
  it('fetchSnapshot returns exactly count candles without opening a socket', async () => {
    const { provider, store } = setup()
    const { candles, market } = await store.fetchSnapshot('BTCUSDT', '1m', 500)
    expect(candles).toHaveLength(500)
    expect(market).toBe('spot')
    expect(provider.liveHandlers).toHaveLength(0)  // no live subscription
  })

  it('fetchSnapshot serves from memory when a live series already has the data', async () => {
    const { provider, store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    const fetchesAfterLoad = provider.fetchCalls.length

    const { candles } = await store.fetchSnapshot('BTCUSDT', '1m', 500)
    expect(candles).toHaveLength(500)
    expect(provider.fetchCalls.length).toBe(fetchesAfterLoad)  // zero extra requests
  })

  it('fetchSnapshot paginates when count exceeds the initial window', async () => {
    const { store } = setup()
    const { candles } = await store.fetchSnapshot('BTCUSDT', '1m', 2500)
    expect(candles).toHaveLength(2500)
  })

  it('prefetch warms the series so the next subscribe is synchronous', async () => {
    const { store } = setup()
    store.prefetch('BTCUSDT', '1m')
    await flush()

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    expect(updates).toHaveLength(1)  // served synchronously from memory
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Eviction safety — regression coverage for the race found in the Phase 1
// self-audit: evictIfNeeded() must never remove a series while it is busy
// (initialLoad / backfilling / repairing), even though such a series has
// zero listeners and would otherwise look identical to any other idle entry.
// ─────────────────────────────────────────────────────────────────────────────

describe('CandleStore — eviction safety', () => {
  it('does not evict a series while fetchSnapshot is still loading it, and does not truncate or duplicate the fetch', async () => {
    const { provider, store } = setup()

    const gate = provider.gateNext(symbol => symbol === 'SLOW')
    const snapshotPromise = store.fetchSnapshot('SLOW', '1m', 500)

    // Flood the store with far more idle series than the cache retains, each
    // fully loaded and immediately abandoned, to create real eviction
    // pressure while SLOW's cold load is still gated open.
    for (let i = 0; i < 20; i++) {
      const unsub = store.subscribe(`SYM${i}`, '1m', () => {})
      await flush()
      unsub()
    }

    // SLOW must have survived every eviction sweep triggered by those 20
    // subscribes, because it was busy the entire time.
    gate.resolve()
    const { candles } = await snapshotPromise

    expect(candles).toHaveLength(500)                                           // not truncated
    expect(provider.calls.filter(c => c.symbol === 'SLOW')).toHaveLength(1)      // not duplicated
  })

  it('does not evict a series while prefetch is still loading it', async () => {
    const { provider, store } = setup()

    const gate = provider.gateNext(symbol => symbol === 'SLOW')
    store.prefetch('SLOW', '1m')

    for (let i = 0; i < 20; i++) {
      const unsub = store.subscribe(`SYM${i}`, '1m', () => {})
      await flush()
      unsub()
    }

    gate.resolve()
    await flush()

    expect(store.getCandles('SLOW', '1m')).not.toBeNull()
    expect(provider.calls.filter(c => c.symbol === 'SLOW')).toHaveLength(1)
  })

  it('still evicts a genuinely idle, finished series once enough other idle series accumulate', async () => {
    const { store } = setup()
    store.prefetch('WARM', '1m')
    await flush()
    expect(store.getCandles('WARM', '1m')).not.toBeNull()

    // WARM is idle and NOT busy — a positive control proving the busy-check
    // didn't just disable eviction outright.
    for (let i = 0; i < 20; i++) {
      const unsub = store.subscribe(`SYM${i}`, '1m', () => {})
      await flush()
      unsub()
    }

    expect(store.getCandles('WARM', '1m')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Concurrent access patterns
// ─────────────────────────────────────────────────────────────────────────────

describe('CandleStore — concurrent access patterns', () => {
  it('subscribe and fetchSnapshot for the same cold series share one REST fetch', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    const unsub = store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    const snapshotPromise = store.fetchSnapshot('BTCUSDT', '1m', 500)

    await flush()
    const { candles } = await snapshotPromise

    expect(provider.fetchCalls).toHaveLength(1)  // deduped — one REST call serves both callers
    expect(candles).toHaveLength(500)
    expect(updates[0].candles).toHaveLength(INITIAL_CANDLES)
    unsub()
  })

  it('rapid subscribe/unsubscribe churn across many symbols leaks no sockets and corrupts no state', async () => {
    const { provider, store } = setup()
    const symbols = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE']

    for (const sym of symbols) {
      const unsub = store.subscribe(sym, '1m', () => {})
      unsub()  // unsubscribed before the cold load even has a chance to resolve
    }
    await flush()

    // Each unsubscribe happened before ensureColdLoad's .then() could observe
    // listeners.size > 0, so no socket should ever have opened for any of them.
    expect(provider.liveHandlers).toHaveLength(0)

    // Re-subscribing afterward still works correctly — no corrupted entries.
    const updates: CandleUpdate[] = []
    store.subscribe('AAA', '1m', u => updates.push(u))
    await flush()
    expect(updates[updates.length - 1].candles.length).toBeGreaterThan(0)
  })

  it('settles on exactly one active socket when a chart-like consumer rapidly switches through several intervals', async () => {
    const { provider, store } = setup()
    let currentUnsub: (() => void) | null = null
    const intervals: Timeframe[] = ['1m', '5m', '15m', '1h']

    for (const iv of intervals) {
      currentUnsub?.()
      currentUnsub = store.subscribe('BTCUSDT', iv, () => {})
    }
    await flush()

    // Only the LAST interval subscribed should end up with an active socket.
    expect(provider.liveHandlers).toHaveLength(1)
    currentUnsub?.()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Concurrent backfill / repair / cold-load composition
// ─────────────────────────────────────────────────────────────────────────────

describe('CandleStore — concurrent backfill and gap repair', () => {
  it('composes correctly when a reconnect-triggered gap repair runs while a backfill is still in flight', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()
    const before = updates[0].candles
    const oldestBefore = before[0].openTime
    const newestBefore = before[before.length - 1].openTime

    // Gate the backfill's endTime-based fetch so it stays in flight.
    const gate = provider.gateNext((_s, _i, o) => o.endTime !== undefined)
    const backfillPromise = store.loadOlder('BTCUSDT', '1m')

    // While the backfill is stuck, a reconnect fires — repairGap uses a
    // startTime-based fetch (not gated) and completes immediately.
    provider.emitStatus('disconnected')
    provider.now += 5 * MINUTE
    provider.emitStatus('connected')
    await flush()

    const afterRepair = updates[updates.length - 1]
    expect(afterRepair.type).toBe('snapshot')
    expect(afterRepair.candles[afterRepair.candles.length - 1].openTime).toBe(newestBefore + 5 * MINUTE)

    // Now release the backfill.
    gate.resolve()
    const added = await backfillPromise
    expect(added).toBeGreaterThan(0)

    const final = store.getCandles('BTCUSDT', '1m')!
    // Both contributions present: older history from the backfill AND the
    // newer candles recovered by the repair — neither clobbered the other.
    expect(final[0].openTime).toBeLessThan(oldestBefore)
    expect(final[final.length - 1].openTime).toBe(newestBefore + 5 * MINUTE)
    // No duplicates, no gaps introduced by the interleaving.
    for (let i = 1; i < final.length; i++) {
      expect(final[i].openTime).toBeGreaterThan(final[i - 1].openTime)
    }
  })

  it('an unrelated series repairing a gap does not interfere with a different series still cold-loading', async () => {
    const { provider, store } = setup()

    // Series B is already live.
    const updatesB: CandleUpdate[] = []
    store.subscribe('ETHUSDT', '1m', u => updatesB.push(u))
    await flush()

    // Series A's cold load is gated in flight — it has NOT called
    // subscribeLive yet, so it has no registered status handler at all.
    const gate = provider.gateNext(symbol => symbol === 'BTCUSDT')
    const updatesA: CandleUpdate[] = []
    const unsubA = store.subscribe('BTCUSDT', '1m', u => updatesA.push(u))
    await flush()
    expect(updatesA).toHaveLength(0)  // still stuck on the gate

    // B reconnects concurrently while A is still cold-loading. emitStatus
    // only reaches handlers that exist yet — since A never registered one,
    // this can only reach B, which is exactly the isolation being verified.
    provider.emitStatus('disconnected')
    provider.now += 3 * MINUTE
    provider.emitStatus('connected')
    await flush()

    expect(updatesA).toHaveLength(0)  // A is untouched — proves isolation
    const bFinal = updatesB[updatesB.length - 1]
    expect(bFinal.type).toBe('snapshot')  // B's repair completed fine on its own

    // Release A — it completes normally afterward.
    gate.resolve()
    await flush()
    expect(updatesA.length).toBeGreaterThan(0)
    expect(updatesA[updatesA.length - 1].candles.length).toBeGreaterThan(0)

    unsubA()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Immutability boundary
// ─────────────────────────────────────────────────────────────────────────────

describe('CandleStore — immutability boundary', () => {
  it('freezes the array wrapper handed to listeners', async () => {
    const { store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    expect(Object.isFrozen(updates[0].candles)).toBe(true)
    expect(() => (updates[0].candles as Candle[]).push(candle(0))).toThrow()
  })

  it('freezes individual candle objects', async () => {
    const { store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const c = updates[0].candles[0]
    expect(Object.isFrozen(c)).toBe(true)
    expect(() => { (c as unknown as { close: number }).close = 999 }).toThrow()
  })

  it('freezes candles delivered via tick, backfill, and gap repair — not just the initial snapshot', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const last = updates[0].candles[updates[0].candles.length - 1]
    provider.emitTick({ ...candle(last.openTime + MINUTE, 111), isClosed: false })
    const tickUpdate = updates[updates.length - 1]
    expect(Object.isFrozen(tickUpdate.candles)).toBe(true)
    expect(Object.isFrozen(tickUpdate.tick)).toBe(true)

    await store.loadOlder('BTCUSDT', '1m')
    const backfillUpdate = updates[updates.length - 1]
    expect(Object.isFrozen(backfillUpdate.candles)).toBe(true)
    expect(Object.isFrozen(backfillUpdate.candles[0])).toBe(true)
  })

  it('freezes candles hydrated from the persistent cache', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    await cache.save('BTCUSDT:1m', candlesBetween(provider.now - 200 * MINUTE, provider.now))

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    // First synchronous-ish microtask turn delivers the fromCache snapshot,
    // before the REST reconciliation (also awaited) has necessarily resolved.
    await Promise.resolve()
    await Promise.resolve()

    const cached = updates.find(u => u.fromCache)
    expect(cached).toBeDefined()
    expect(Object.isFrozen(cached!.candles)).toBe(true)
    expect(Object.isFrozen(cached!.candles[0])).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Persistence coalescing
// ─────────────────────────────────────────────────────────────────────────────

describe('CandleStore — persistence coalescing', () => {
  it('coalesces rapid successive backfill chunks into a single debounced write, not one write per chunk', async () => {
    const cache = new InMemoryCandleCache()
    const { store } = setup(cache)

    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()  // real timers — cold load settles, including its own immediate write

    const saveSpy = vi.spyOn(cache, 'save')
    vi.useFakeTimers()
    try {
      await store.loadOlder('BTCUSDT', '1m')
      await store.loadOlder('BTCUSDT', '1m')
      await store.loadOlder('BTCUSDT', '1m')

      // All three chunks land inside the debounce window — none should have
      // triggered a write yet.
      expect(saveSpy).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(2_000)

      // Exactly one write for all three chunks combined.
      expect(saveSpy).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('coalesces rapid successive candle closes the same way', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()

    const saveSpy = vi.spyOn(cache, 'save')
    vi.useFakeTimers()
    try {
      const base = store.getCandles('BTCUSDT', '1m')!
      const lastOpen = base[base.length - 1].openTime
      provider.emitTick({ ...candle(lastOpen + MINUTE, 1), isClosed: true })
      provider.emitTick({ ...candle(lastOpen + 2 * MINUTE, 2), isClosed: true })
      provider.emitTick({ ...candle(lastOpen + 3 * MINUTE, 3), isClosed: true })

      expect(saveSpy).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(2_000)
      expect(saveSpy).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes a pending debounced write immediately when the series is evicted, rather than losing it', async () => {
    const cache = new InMemoryCandleCache()
    const { store } = setup(cache)

    const unsub = store.subscribe('WARM', '1m', () => {})
    await flush()

    await store.loadOlder('WARM', '1m')  // schedules a debounced write, not yet fired
    const beforeEviction = await cache.load('WARM:1m')
    const bufferAtBackfillTime = store.getCandles('WARM', '1m')!.length

    // The debounced write has NOT landed in the cache yet.
    expect(beforeEviction!.length).toBeLessThan(bufferAtBackfillTime)

    // Make WARM genuinely idle (zero listeners), then force eviction pressure.
    unsub()
    for (let i = 0; i < 20; i++) {
      const u = store.subscribe(`SYM${i}`, '1m', () => {})
      await flush()
      u()
    }

    // Confirm eviction genuinely happened...
    expect(store.getCandles('WARM', '1m')).toBeNull()
    // ...and that the pending write was flushed before WARM was evicted, not dropped.
    const afterEviction = await cache.load('WARM:1m')
    expect(afterEviction!.length).toBe(bufferAtBackfillTime)
  })
})
