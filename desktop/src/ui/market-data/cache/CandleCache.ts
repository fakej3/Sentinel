/**
 * Persistent candle cache implementations.
 *
 * IndexedDBCandleCache — browser persistence so recently viewed symbols reopen
 * instantly (hydrate from disk, then background-refresh from REST). One record
 * per (symbol, interval); the newest MAX_PERSISTED_CANDLES are kept.
 *
 * InMemoryCandleCache — Map-backed implementation for tests and non-browser
 * environments (Node, SSR) where indexedDB does not exist.
 *
 * Both implementations are failure-silent by contract: a broken or unavailable
 * cache degrades to cold REST loads, never to a broken store.
 */
import type { Candle } from '../../../modules/market/types'
import type { CandlePersistence } from '../types'

/** Newest candles persisted per series. ~20k ≈ 2.3 years of 1h, 55 years of 1d. */
export const MAX_PERSISTED_CANDLES = 20_000

const DB_NAME    = 'sentinel-market-data'
const DB_VERSION = 1
const STORE_NAME = 'candles'

// ── IndexedDB implementation ──────────────────────────────────────────────────

export class IndexedDBCandleCache implements CandlePersistence {
  private dbPromise: Promise<IDBDatabase | null> | null = null

  private open(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise
    this.dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror   = () => resolve(null)
        req.onblocked = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    return this.dbPromise
  }

  async load(key: string): Promise<Candle[] | null> {
    const db = await this.open()
    if (!db) return null
    return new Promise(resolve => {
      try {
        const tx  = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(key)
        req.onsuccess = () => {
          const value = req.result as Candle[] | undefined
          resolve(Array.isArray(value) && value.length > 0 ? value : null)
        }
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  async save(key: string, candles: Candle[]): Promise<void> {
    const db = await this.open()
    if (!db) return
    const toPersist = candles.length > MAX_PERSISTED_CANDLES
      ? candles.slice(candles.length - MAX_PERSISTED_CANDLES)
      : candles
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(toPersist, key)
        tx.oncomplete = () => resolve()
        tx.onerror    = () => resolve()
        tx.onabort    = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async clear(): Promise<void> {
    const db = await this.open()
    if (!db) return
    return new Promise(resolve => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).clear()
        tx.oncomplete = () => resolve()
        tx.onerror    = () => resolve()
        tx.onabort    = () => resolve()
      } catch {
        resolve()
      }
    })
  }
}

// ── In-memory implementation (tests / non-browser) ────────────────────────────

export class InMemoryCandleCache implements CandlePersistence {
  private readonly map = new Map<string, Candle[]>()

  async load(key: string): Promise<Candle[] | null> {
    const value = this.map.get(key)
    return value && value.length > 0 ? [...value] : null
  }

  async save(key: string, candles: Candle[]): Promise<void> {
    const toPersist = candles.length > MAX_PERSISTED_CANDLES
      ? candles.slice(candles.length - MAX_PERSISTED_CANDLES)
      : candles
    this.map.set(key, [...toPersist])
  }

  async clear(): Promise<void> {
    this.map.clear()
  }
}

/** Environment-appropriate default: IndexedDB in the browser, in-memory elsewhere. */
export function createDefaultCandleCache(): CandlePersistence {
  if (typeof indexedDB !== 'undefined') return new IndexedDBCandleCache()
  return new InMemoryCandleCache()
}
