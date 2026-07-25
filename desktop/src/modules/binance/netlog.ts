/**
 * Network request log — captures every outgoing Binance HTTP call.
 *
 * Kept as a pure-TypeScript singleton (no React dependency) so it can be
 * imported anywhere in the engine without creating a circular dependency.
 * UI components subscribe via `subscribe()` and unsubscribe on unmount.
 */

export interface NetLogEntry {
  id: number
  url: string
  market: 'spot' | 'futures' | 'other'
  symbol: string | null
  startedAt: number
  phase: 'pending' | 'success' | 'error'
  // set on completion
  elapsedMs?: number
  // success
  status?: number
  headers?: Record<string, string>
  bodyPreview?: string  // first 500 chars of raw body
  // error
  errorName?: string
  errorMessage?: string
  stack?: string
  online?: boolean
  hadResponse?: boolean  // false = TypeError before any HTTP response
}

type Listener = () => void

const MAX_ENTRIES = 20

let nextId = 1
const entries: NetLogEntry[] = []
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l()
}

function inferMarket(url: string): 'spot' | 'futures' | 'other' {
  if (url.includes('fapi.binance.com')) return 'futures'
  if (url.includes('api.binance.com'))  return 'spot'
  return 'other'
}

function parseSymbol(url: string): string | null {
  try {
    const u = new URL(url)
    return u.searchParams.get('symbol')
  } catch {
    return null
  }
}

/** Call before issuing a fetch. Returns the entry id. */
export function logRequestStart(url: string): number {
  const id: number = nextId++
  const entry: NetLogEntry = {
    id,
    url,
    market: inferMarket(url),
    symbol: parseSymbol(url),
    startedAt: Date.now(),
    phase: 'pending',
  }
  entries.unshift(entry)
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES
  notify()
  return id
}

/** Call after a successful HTTP response (even a non-2xx). */
export function logRequestSuccess(
  id: number,
  status: number,
  headers: Record<string, string>,
  bodyPreview: string,
): void {
  const entry = entries.find(e => e.id === id)
  if (!entry) return
  entry.phase      = 'success'
  entry.elapsedMs  = Date.now() - entry.startedAt
  entry.status     = status
  entry.headers    = headers
  entry.bodyPreview = bodyPreview
  notify()
}

/** Call when fetch() throws (CORS, network failure, timeout, etc.). */
export function logRequestError(
  id: number,
  err: unknown,
  hadResponse: boolean,
): void {
  const entry = entries.find(e => e.id === id)
  if (!entry) return
  entry.phase      = 'error'
  entry.elapsedMs  = Date.now() - entry.startedAt
  entry.hadResponse = hadResponse
  entry.online      = typeof navigator !== 'undefined' ? navigator.onLine : true
  if (err instanceof Error) {
    entry.errorName    = err.name
    entry.errorMessage = err.message
    entry.stack        = err.stack ?? ''
  } else {
    entry.errorName    = 'Unknown'
    entry.errorMessage = String(err)
  }
  notify()
}

export function getEntries(): readonly NetLogEntry[] {
  return entries
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function clear(): void {
  entries.length = 0
  notify()
}
