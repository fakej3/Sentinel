import { useState, useEffect, useCallback } from 'react'
import { symbolRegistry } from '../../modules/binance'
import type { RawSymbolInfo } from '../../modules/binance/registry'
import { getEntries, subscribe, clear } from '../../modules/binance/netlog'
import type { NetLogEntry } from '../../modules/binance/netlog'
import { SPOT_BASE_URL, FUTURES_BASE_URL } from '../../modules/binance/constants'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TestResult {
  label: string
  url: string
  status: 'pending' | 'running' | 'ok' | 'error'
  httpStatus?: number
  errorName?: string
  errorMessage?: string
  corsOrigin?: string   // value of access-control-allow-origin header
  hadResponse?: boolean
  responseBytes?: number
  bodyPreview?: string  // first 500 chars
  elapsed?: number
}

// ── Raw test fetch (bypasses client.ts to capture ALL headers unfiltered) ─────

async function rawFetch(url: string): Promise<TestResult> {
  const t0 = Date.now()
  const result: TestResult = { label: '', url, status: 'running' }
  try {
    const res = await fetch(url, {
      headers: { Origin: window.location.origin },
    })
    const text = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
    result.httpStatus    = res.status
    result.corsOrigin    = headers['access-control-allow-origin']
    result.responseBytes = new TextEncoder().encode(text).length
    result.bodyPreview   = text.slice(0, 500)
    result.hadResponse   = true
    result.status        = res.ok ? 'ok' : 'error'
    result.elapsed       = Date.now() - t0
  } catch (err) {
    result.status      = 'error'
    result.hadResponse = false
    result.elapsed     = Date.now() - t0
    if (err instanceof Error) {
      result.errorName    = err.name
      result.errorMessage = err.message
    } else {
      result.errorMessage = String(err)
    }
  }
  return result
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
      ok ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
    }`}>
      {label}
    </span>
  )
}

function StatusDot({ phase }: { phase: NetLogEntry['phase'] }) {
  const colors: Record<NetLogEntry['phase'], string> = {
    pending: 'bg-yellow-400 animate-pulse',
    success: 'bg-green-400',
    error:   'bg-red-400',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[phase]}`} />
}

function TestStatusIcon({ status }: { status: TestResult['status'] }) {
  if (status === 'pending') return <span className="text-slate-500">–</span>
  if (status === 'running') return <span className="text-yellow-400 animate-pulse">●</span>
  if (status === 'ok')      return <span className="text-green-400">✓</span>
  return <span className="text-red-400">✗</span>
}

function ts(ms: number): string {
  return new Date(ms).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
}

const TRADFI_SYMBOLS = ['XAUUSDT', 'XAGUSDT', 'XPTUSDT', 'XPDUSDT']

const CONNECTION_TESTS: Array<{ label: string; url: string }> = [
  { label: 'spot ping',          url: `${SPOT_BASE_URL}/api/v3/ping` },
  { label: 'spot time',          url: `${SPOT_BASE_URL}/api/v3/time` },
  { label: 'spot exchangeInfo',  url: `${SPOT_BASE_URL}/api/v3/exchangeInfo` },
  { label: 'fapi time',          url: `${FUTURES_BASE_URL}/fapi/v1/time` },
  { label: 'fapi exchangeInfo',  url: `${FUTURES_BASE_URL}/fapi/v1/exchangeInfo` },
  { label: 'fapi klines BTCUSDT', url: `${FUTURES_BASE_URL}/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=3` },
  { label: 'fapi klines XAGUSDT', url: `${FUTURES_BASE_URL}/fapi/v1/klines?symbol=XAGUSDT&interval=1h&limit=3` },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function DiagnosticsPage() {
  // Registry state
  const [registryStatus, setRegistryStatus] = useState(symbolRegistry.getStatus())
  const [lookupSymbol, setLookupSymbol] = useState('XAGUSDT')
  const [tradfiRaw, setTradfiRaw] = useState<Record<string, RawSymbolInfo | null>>({})

  // Network log
  const [logEntries, setLogEntries] = useState<readonly NetLogEntry[]>(getEntries())

  // Connection tests
  const [testResults, setTestResults] = useState<TestResult[]>(
    CONNECTION_TESTS.map(t => ({ ...t, status: 'pending' as const }))
  )
  const [testRunning, setTestRunning] = useState(false)
  const [exchangeInfoForTradFi, setExchangeInfoForTradFi] = useState<Record<string, RawSymbolInfo | null>>({})

  // Auto-refresh registry status
  useEffect(() => {
    const id = setInterval(() => setRegistryStatus(symbolRegistry.getStatus()), 500)
    return () => clearInterval(id)
  }, [])

  // Populate TradFi entries from registry when it loads
  useEffect(() => {
    const id = setInterval(() => {
      if (symbolRegistry.isReady()) {
        setTradfiRaw(symbolRegistry.getRawFuturesSymbols(TRADFI_SYMBOLS))
      }
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Subscribe to netlog updates
  useEffect(() => subscribe(() => setLogEntries([...getEntries()])), [])

  const lookupEntry = symbolRegistry.isReady()
    ? symbolRegistry.getRawFuturesSymbol(lookupSymbol.toUpperCase().trim())
    : null
  const lookupPreferredMarket = symbolRegistry.getPreferredMarket(lookupSymbol.toUpperCase().trim())

  // Run all connection tests sequentially
  const runTests = useCallback(async () => {
    setTestRunning(true)
    setExchangeInfoForTradFi({})
    const results: TestResult[] = CONNECTION_TESTS.map(t => ({ ...t, status: 'pending' as const }))
    setTestResults([...results])

    for (let i = 0; i < CONNECTION_TESTS.length; i++) {
      const def = CONNECTION_TESTS[i]
      results[i] = { ...def, status: 'running' }
      setTestResults([...results])

      const res = await rawFetch(def.url)
      results[i] = { ...def, ...res }
      setTestResults([...results])

      // If this was the fapi exchangeInfo test, extract TradFi symbols from body
      if (def.label === 'fapi exchangeInfo' && res.status === 'ok' && res.bodyPreview) {
        try {
          // The body was truncated for preview — re-fetch just for symbol extraction
          const full = await fetch(def.url)
          const data = (await full.json()) as { symbols?: RawSymbolInfo[] }
          const found: Record<string, RawSymbolInfo | null> = {}
          const bySymbol = new Map((data.symbols ?? []).map(s => [s.symbol, s]))
          for (const sym of TRADFI_SYMBOLS) {
            found[sym] = bySymbol.get(sym) ?? null
          }
          setExchangeInfoForTradFi(found)
        } catch {
          // ignored — body parse failure is not critical
        }
      }
    }

    setTestRunning(false)
  }, [])

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Network Diagnostics</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Live evidence only — every result below is captured from runtime network calls.
        </p>
      </div>

      {/* ── Registry Status ─────────────────────────────────────────────────── */}
      <section className="bg-surface-900 rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Registry Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile label="Loaded" value={registryStatus.loaded ? 'Yes' : 'No'} ok={registryStatus.loaded} />
          <Tile label="Symbol Count" value={String(registryStatus.size)} ok={registryStatus.size > 0} />
          <Tile label="Loading" value={registryStatus.loading ? 'Yes' : 'No'} />
          <Tile label="Retries" value={String(registryStatus.retryCount)} ok={registryStatus.retryCount === 0} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Raw Futures (TRADING USDT)" value={String(registryStatus.rawFuturesCount)} />
          <Tile label="Raw Spot (TRADING USDT)" value={String(registryStatus.rawSpotCount)} />
        </div>
        {registryStatus.loadedAt > 0 && (
          <p className="text-[11px] text-slate-500">
            Loaded at: {ts(registryStatus.loadedAt)}
          </p>
        )}
      </section>

      {/* ── Symbol Lookup ───────────────────────────────────────────────────── */}
      <section className="bg-surface-900 rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Symbol Lookup</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-surface-800 border border-border-subtle rounded px-3 py-1.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
            value={lookupSymbol}
            onChange={e => setLookupSymbol(e.target.value)}
            placeholder="XAGUSDT"
          />
        </div>
        {lookupSymbol.trim() && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="text-slate-500">preferredMarket:</span>
              <span className={
                lookupPreferredMarket === 'futures' ? 'text-blue-400' :
                lookupPreferredMarket === 'spot'    ? 'text-green-400' :
                'text-yellow-400'
              }>{lookupPreferredMarket}</span>
              <span className="text-slate-500 ml-4">in registry:</span>
              <span className={lookupEntry ? 'text-green-400' : 'text-red-400'}>
                {lookupEntry ? 'YES' : 'NO'}
              </span>
            </div>
            {lookupEntry ? (
              <pre className="bg-surface-800 rounded p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
                {JSON.stringify(lookupEntry, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-red-400">
                {registryStatus.loaded
                  ? 'Symbol not found in registry. Registry is loaded — this symbol was excluded by the filter or does not exist in exchangeInfo.'
                  : 'Registry not yet loaded. Wait for load to complete.'}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── TradFi Symbols in Registry ──────────────────────────────────────── */}
      <section className="bg-surface-900 rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          TradFi Symbols — Raw exchangeInfo Entries (from registry)
        </h2>
        {!registryStatus.loaded && (
          <p className="text-xs text-yellow-400">Waiting for registry to load…</p>
        )}
        {registryStatus.loaded && TRADFI_SYMBOLS.map(sym => (
          <div key={sym} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-slate-300">{sym}</span>
              {tradfiRaw[sym]
                ? <Badge ok label={`contractType: ${tradfiRaw[sym]!.contractType ?? 'n/a'}`} />
                : <Badge ok={false} label="NOT IN FAPI EXCHANGEINFO" />
              }
              <Badge ok={symbolRegistry.getPreferredMarket(sym) === 'futures'} label={`preferred: ${symbolRegistry.getPreferredMarket(sym)}`} />
            </div>
            {tradfiRaw[sym] && (
              <pre className="bg-surface-800 rounded p-2 text-[10px] font-mono text-slate-400 overflow-x-auto">
                {JSON.stringify(tradfiRaw[sym], null, 2)}
              </pre>
            )}
          </div>
        ))}
      </section>

      {/* ── Connection Tests ─────────────────────────────────────────────────── */}
      <section className="bg-surface-900 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connection Tests</h2>
          <button
            onClick={runTests}
            disabled={testRunning}
            className="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {testRunning ? 'Running…' : 'Run Tests'}
          </button>
        </div>
        <div className="space-y-2">
          {testResults.map((r, i) => (
            <div key={i} className="bg-surface-800 rounded p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <TestStatusIcon status={r.status} />
                <span className="text-xs font-mono text-slate-300">{r.label}</span>
                {r.httpStatus !== undefined && (
                  <Badge ok={r.httpStatus >= 200 && r.httpStatus < 300} label={`HTTP ${r.httpStatus}`} />
                )}
                {r.corsOrigin !== undefined && (
                  <Badge ok label={`CORS: ${r.corsOrigin}`} />
                )}
                {r.corsOrigin === undefined && r.hadResponse && r.status === 'ok' && (
                  <Badge ok={false} label="NO CORS HEADER" />
                )}
                {r.elapsed !== undefined && (
                  <span className="text-[10px] text-slate-500">{r.elapsed}ms</span>
                )}
                {r.responseBytes !== undefined && (
                  <span className="text-[10px] text-slate-500">{(r.responseBytes / 1024).toFixed(1)}KB</span>
                )}
              </div>
              {r.status === 'error' && (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-mono text-red-300">
                    hadResponse: {String(r.hadResponse)} | {r.errorName}: {r.errorMessage}
                  </p>
                  {!r.hadResponse && (
                    <p className="text-[11px] text-orange-400">
                      fetch() threw before receiving any HTTP response — indicates CORS preflight rejection, DNS failure, or network block.
                    </p>
                  )}
                </div>
              )}
              {r.bodyPreview && r.status === 'error' && (
                <pre className="text-[10px] font-mono text-slate-500 overflow-x-auto">{r.bodyPreview}</pre>
              )}
            </div>
          ))}
        </div>

        {/* TradFi symbols extracted from live exchangeInfo fetch */}
        {Object.keys(exchangeInfoForTradFi).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <h3 className="text-xs font-semibold text-slate-400">
              TradFi Symbols in Live fapi/v1/exchangeInfo Response
            </h3>
            {TRADFI_SYMBOLS.map(sym => (
              <div key={sym} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300">{sym}</span>
                  {exchangeInfoForTradFi[sym]
                    ? <Badge ok label={`contractType: ${exchangeInfoForTradFi[sym]!.contractType ?? 'n/a'}`} />
                    : <Badge ok={false} label="ABSENT" />
                  }
                </div>
                {exchangeInfoForTradFi[sym] && (
                  <pre className="bg-surface-800 rounded p-2 text-[10px] font-mono text-slate-400 overflow-x-auto">
                    {JSON.stringify(exchangeInfoForTradFi[sym], null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Network Log ──────────────────────────────────────────────────────── */}
      <section className="bg-surface-900 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Network Log (last {logEntries.length})
          </h2>
          <button
            onClick={() => { clear(); setLogEntries([]) }}
            className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200 border border-border-subtle hover:border-slate-500 transition-colors"
          >
            Clear
          </button>
        </div>
        {logEntries.length === 0 ? (
          <p className="text-xs text-slate-500">No requests captured yet. Run an analysis or click Run Tests.</p>
        ) : (
          <div className="space-y-2">
            {logEntries.map(entry => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="bg-surface-800 rounded p-2.5 space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-sm font-mono font-semibold ${
        ok === undefined ? 'text-slate-200' :
        ok ? 'text-green-400' : 'text-red-400'
      }`}>{value}</p>
    </div>
  )
}

function LogRow({ entry }: { entry: NetLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const shortUrl = entry.url.replace(/^https?:\/\/[^/]+/, '')

  return (
    <div className="bg-surface-800 rounded text-[11px] font-mono">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-surface-700 rounded transition-colors"
      >
        <StatusDot phase={entry.phase} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${entry.market === 'futures' ? 'text-blue-400' : entry.market === 'spot' ? 'text-green-400' : 'text-slate-400'}`}>
              [{entry.market}]
            </span>
            {entry.symbol && <span className="text-yellow-300">{entry.symbol}</span>}
            <span className="text-slate-400 truncate">{shortUrl}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <span>{ts(entry.startedAt)}</span>
            {entry.elapsedMs !== undefined && <span>{entry.elapsedMs}ms</span>}
            {entry.status !== undefined && (
              <span className={entry.status >= 200 && entry.status < 300 ? 'text-green-400' : 'text-red-400'}>
                HTTP {entry.status}
              </span>
            )}
            {entry.phase === 'error' && (
              <span className="text-red-400">{entry.errorName}: {entry.errorMessage}</span>
            )}
          </div>
        </div>
        <span className="text-slate-600 ml-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border-subtle/50 mt-1 pt-2">
          <div>
            <p className="text-slate-500 mb-1">Full URL:</p>
            <p className="text-slate-300 break-all">{entry.url}</p>
          </div>

          {entry.phase === 'error' && (
            <div className="space-y-1">
              <p className="text-red-400">error.name: {entry.errorName}</p>
              <p className="text-red-400">error.message: {entry.errorMessage}</p>
              <p className="text-slate-500">hadResponse: <span className="text-slate-300">{String(entry.hadResponse)}</span></p>
              <p className="text-slate-500">navigator.onLine: <span className="text-slate-300">{String(entry.online)}</span></p>
              {!entry.hadResponse && (
                <p className="text-orange-400 mt-1">
                  ⚠ fetch() threw before receiving any HTTP response.
                  Cause: CORS preflight rejection, DNS failure, TLS error, or geo-block redirect without CORS headers.
                </p>
              )}
              {entry.stack && (
                <details>
                  <summary className="text-slate-500 cursor-pointer">stack trace</summary>
                  <pre className="text-[10px] text-slate-500 mt-1 overflow-x-auto whitespace-pre-wrap">{entry.stack}</pre>
                </details>
              )}
            </div>
          )}

          {entry.headers && Object.keys(entry.headers).length > 0 && (
            <div>
              <p className="text-slate-500 mb-1">Response Headers:</p>
              <pre className="text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                {Object.entries(entry.headers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join('\n')}
              </pre>
            </div>
          )}

          {entry.bodyPreview && (
            <div>
              <p className="text-slate-500 mb-1">Body (first 500 chars):</p>
              <pre className="text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">{entry.bodyPreview}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
