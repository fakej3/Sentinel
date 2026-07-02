import type { PipelineResult } from './types'

const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ── Typed error ───────────────────────────────────────────────────────────────

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse' | 'abort'

export interface ApiErrorInfo {
  kind: ApiErrorKind
  friendly: string
  detail?: string
  status?: number
  code?: string
}

export class SentinelApiError extends Error {
  readonly kind: ApiErrorKind
  readonly friendly: string
  readonly detail?: string
  readonly status?: number
  readonly code?: string

  constructor(info: ApiErrorInfo) {
    super(info.friendly)
    this.name = 'SentinelApiError'
    this.kind = info.kind
    this.friendly = info.friendly
    this.detail = info.detail
    this.status = info.status
    this.code = info.code
  }
}

// ── Friendly message map ──────────────────────────────────────────────────────

function friendlyForHttp(status: number, code?: string): string {
  if (code === 'fetch_failure') return 'Could not reach the data source. The upstream market data API may be unavailable.'
  if (code === 'insufficient_candles') return 'Not enough candle data for this symbol and timeframe.'
  if (code === 'configuration_error') return 'Invalid request configuration.'
  if (code === 'validation_failure') return 'The analysis output failed internal validation.'
  if (status === 400) return 'Invalid request. Check that the symbol and interval are correct.'
  if (status === 408) return 'Analysis timed out. The server took too long to respond.'
  if (status === 422) return 'The server could not process this request. Check symbol and timeframe.'
  if (status === 500) return 'Server returned an internal error.'
  if (status === 502) return 'Upstream service unavailable.'
  if (status === 503) return 'The API is temporarily unavailable.'
  return `Server returned an error (HTTP ${status}).`
}

// ── analyze ───────────────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  candleLimit?: number
  config?: Record<string, unknown>
}

export async function analyze(
  symbol: string,
  interval: string,
  options?: AnalyzeOptions,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  let res: Response

  try {
    res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: symbol.trim().toUpperCase(),
        interval,
        ...(options?.candleLimit !== undefined && { candleLimit: options.candleLimit }),
        ...(options?.config !== undefined && { config: options.config }),
      }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new SentinelApiError({ kind: 'abort', friendly: 'Request cancelled.' })
    }
    const detail = err instanceof Error ? err.message : String(err)
    throw new SentinelApiError({
      kind: 'network',
      friendly: 'Cannot connect to the API. Make sure the backend server is running on port 3000.',
      detail,
    })
  }

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } = {}
    try { body = (await res.json()) as typeof body } catch { /* ignore parse failures on error bodies */ }
    throw new SentinelApiError({
      kind: 'http',
      status: res.status,
      code: body.error?.code,
      friendly: friendlyForHttp(res.status, body.error?.code),
      detail: body.error?.message ?? `HTTP ${res.status} ${res.statusText}`,
    })
  }

  try {
    return (await res.json()) as PipelineResult
  } catch {
    throw new SentinelApiError({
      kind: 'parse',
      friendly: 'Invalid response from server.',
      detail: 'The server response was not valid JSON.',
    })
  }
}

// ── health ────────────────────────────────────────────────────────────────────

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal })
    return res.ok
  } catch {
    return false
  }
}
