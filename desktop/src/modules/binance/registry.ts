/**
 * SymbolRegistry — single source of truth for every tradable Binance symbol.
 *
 * Loads /api/v3/exchangeInfo (spot) and /fapi/v1/exchangeInfo (futures perpetual)
 * in parallel and merges them into one in-memory map.  Every API call in this
 * module consults the registry first so we never guess which market to use.
 *
 * The registry is a lazy singleton:
 *  - prime() starts a background fetch (call once at app startup)
 *  - getMarket() triggers loading on first call if not already started
 *  - Returns 'unknown' until the fetch resolves; callers fall back gracefully
 */

import { SPOT_BASE_URL, FUTURES_BASE_URL, REQUEST_TIMEOUT_MS } from './constants'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SymbolMarket = 'spot' | 'futures' | 'both'

export interface RegistryEntry {
  symbol: string
  base:   string
  quote:  string
  /** 'spot' = Binance Spot only; 'futures' = FAPI perpetual only; 'both' = listed on both */
  market: SymbolMarket
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface RawSymbolInfo {
  symbol:        string
  baseAsset:     string
  quoteAsset:    string
  status:        string
  contractType?: string
}

async function loadExchangeInfo(url: string): Promise<RawSymbolInfo[]> {
  if (typeof fetch === 'undefined') return []
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return []
    const data = (await res.json()) as { symbols?: RawSymbolInfo[] }
    return data.symbols ?? []
  } catch {
    clearTimeout(timer)
    return []
  }
}

// ── SymbolRegistry singleton ──────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1_000  // 5 minutes

class SymbolRegistrySingleton {
  private bySymbol:   Map<string, RegistryEntry> = new Map()
  private allEntries: RegistryEntry[] = []
  private loadedAt  = 0
  private loading:    Promise<void> | null = null

  private async build(): Promise<void> {
    const [spotRaw, futRaw] = await Promise.all([
      loadExchangeInfo(`${SPOT_BASE_URL}/api/v3/exchangeInfo`),
      loadExchangeInfo(`${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`),
    ])

    const map = new Map<string, RegistryEntry>()

    for (const s of spotRaw) {
      if (s.status === 'TRADING' && s.quoteAsset === 'USDT') {
        map.set(s.symbol, { symbol: s.symbol, base: s.baseAsset, quote: 'USDT', market: 'spot' })
      }
    }

    for (const s of futRaw) {
      if (s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL') {
        const existing = map.get(s.symbol)
        if (existing) {
          map.set(s.symbol, { ...existing, market: 'both' })
        } else {
          map.set(s.symbol, { symbol: s.symbol, base: s.baseAsset, quote: 'USDT', market: 'futures' })
        }
      }
    }

    if (map.size > 0) {
      this.bySymbol   = map
      this.allEntries = Array.from(map.values())
      this.loadedAt   = Date.now()
    }
  }

  private ensureLoading(): void {
    if (this.loading) return
    if (this.loadedAt > 0 && Date.now() - this.loadedAt < CACHE_TTL_MS) return
    this.loading = this.build()
      .catch(() => { /* fail silently — callers use fallback */ })
      .finally(() => { this.loading = null })
  }

  /** Start loading the registry in the background. Call once at app startup. */
  prime(): void {
    this.ensureLoading()
  }

  /**
   * Returns the canonical market for a symbol.
   * 'unknown' means the registry has not loaded yet or the symbol is not listed.
   * Callers should fall back to spot→futures retry when 'unknown'.
   */
  getMarket(symbol: string): SymbolMarket | 'unknown' {
    this.ensureLoading()
    return this.bySymbol.get(symbol)?.market ?? 'unknown'
  }

  /** All known entries (empty until the first load completes). */
  getAll(): RegistryEntry[] {
    this.ensureLoading()
    return this.allEntries
  }

  /** True once the first load has succeeded. */
  isReady(): boolean {
    return this.loadedAt > 0
  }
}

export const symbolRegistry = new SymbolRegistrySingleton()
