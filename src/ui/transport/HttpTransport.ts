import type { PipelineResult } from '../types'
import type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry } from './types'
import { SentinelApiError } from './types'

// ── Friendly message map ──────────────────────────────────────────────────────

function friendlyForHttp(status: number, code?: string): string {
  if (code === 'fetch_failure')       return 'Could not reach the data source. The upstream market data API may be unavailable.'
  if (code === 'insufficient_candles') return 'Not enough candle data for this symbol and timeframe.'
  if (code === 'configuration_error') return 'Invalid request configuration.'
  if (code === 'validation_failure')  return 'The analysis output failed internal validation.'
  if (status === 400) return 'Invalid request. Check that the symbol and interval are correct.'
  if (status === 408) return 'Analysis timed out. The server took too long to respond.'
  if (status === 422) return 'The server could not process this request. Check symbol and timeframe.'
  if (status === 500) return 'Server returned an internal error.'
  if (status === 502) return 'Upstream service unavailable.'
  if (status === 503) return 'The API is temporarily unavailable.'
  return `Server returned an error (HTTP ${status}).`
}

// ── HttpTransport ─────────────────────────────────────────────────────────────

/**
 * HTTP implementation of AnalysisTransport.
 * All fetch logic lives here; the rest of the UI is unaware of URLs or HTTP.
 */
export class HttpTransport implements AnalysisTransport {
  private readonly base: string

  constructor(baseUrl: string) {
    this.base = baseUrl
  }

  async analyze(
    symbol: string,
    interval: string,
    options?: AnalyzeOptions,
    signal?: AbortSignal,
  ): Promise<PipelineResult> {
    let res: Response

    try {
      res = await fetch(`${this.base}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          interval,
          ...(options?.candleLimit !== undefined && { candleLimit: options.candleLimit }),
          ...(options?.config      !== undefined && { config: options.config }),
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
        kind:    'http',
        status:  res.status,
        code:    body.error?.code,
        friendly: friendlyForHttp(res.status, body.error?.code),
        detail:  body.error?.message ?? `HTTP ${res.status} ${res.statusText}`,
      })
    }

    try {
      return (await res.json()) as PipelineResult
    } catch {
      throw new SentinelApiError({
        kind:    'parse',
        friendly: 'Invalid response from server.',
        detail:  'The server response was not valid JSON.',
      })
    }
  }

  async health(signal?: AbortSignal): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/health`, { signal })
      return res.ok
    } catch {
      return false
    }
  }

  async listHistory(): Promise<HistoryMeta[]> {
    try {
      const res = await fetch(`${this.base}/history`)
      if (!res.ok) return []
      const data = (await res.json()) as { history?: HistoryMeta[] }
      return data.history ?? []
    } catch {
      return []
    }
  }

  async getHistory(id: string): Promise<HistoryEntry | null> {
    try {
      const res = await fetch(`${this.base}/history/${id}`)
      if (!res.ok) return null
      return (await res.json()) as HistoryEntry
    } catch {
      return null
    }
  }

  async saveHistory(
    result: PipelineResult,
    symbol: string,
    interval: string,
  ): Promise<HistoryMeta | null> {
    try {
      const res = await fetch(`${this.base}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, symbol, interval }),
      })
      if (!res.ok) return null
      return (await res.json()) as HistoryMeta
    } catch {
      return null
    }
  }

  async deleteHistory(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/history/${id}`, { method: 'DELETE' })
      return res.ok
    } catch {
      return false
    }
  }
}
