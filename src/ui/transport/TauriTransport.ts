import { analyzeMarket, PipelineError } from '../../modules/pipeline'
import { SentinelApiError } from './types'
import type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry } from './types'
import type { PipelineResult } from '../types'
import type { Timeframe } from '../../modules/binance/types'
import * as historyStore from './TauriHistoryStore'

// ── Error mapping ─────────────────────────────────────────────────────────────

function friendlyForCode(code: string, fallback: string): string {
  switch (code) {
    case 'fetch_failure':        return 'Could not reach the data source. The upstream market data API may be unavailable.'
    case 'insufficient_candles': return 'Not enough candle data for this symbol and timeframe.'
    case 'configuration_error':  return 'Invalid request configuration.'
    case 'validation_failure':   return 'The analysis output failed internal validation.'
    default:                     return fallback
  }
}

// ── TauriTransport ────────────────────────────────────────────────────────────

/**
 * Desktop implementation of AnalysisTransport.
 *
 * Runs the full analysis pipeline directly in the Tauri webview renderer —
 * no sidecar, no Express, no HTTP round-trip. All pipeline modules use only
 * Web APIs (fetch, AbortController, URLSearchParams) and are browser-safe.
 *
 * Gemini API key is injected at call time from localStorage (Module 5 wires
 * the UI for this). History is implemented in Module 4.
 */
export class TauriTransport implements AnalysisTransport {
  async analyze(
    symbol: string,
    interval: string,
    options?: AnalyzeOptions,
    signal?: AbortSignal,
  ): Promise<PipelineResult> {
    if (signal?.aborted) {
      throw new SentinelApiError({ kind: 'abort', friendly: 'Request cancelled.' })
    }

    // Gemini key from localStorage — set by Settings UI (Module 5).
    // Empty string → Gemini disabled; pipeline works without it.
    const geminiKey = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('sentinel_gemini_key') ?? '')
      : ''

    try {
      const result = await analyzeMarket({
        symbol:      symbol.trim().toUpperCase(),
        interval:    interval as Timeframe,
        candleLimit: options?.candleLimit,
        ...(geminiKey && {
          config: { ai: { provider: 'gemini' as const, apiKey: geminiKey } },
        }),
      })

      if (signal?.aborted) {
        throw new SentinelApiError({ kind: 'abort', friendly: 'Request cancelled.' })
      }

      return result
    } catch (err) {
      if (err instanceof SentinelApiError) throw err

      if (err instanceof PipelineError) {
        throw new SentinelApiError({
          kind:     'network',
          friendly: friendlyForCode(err.code, err.message),
          detail:   err.message,
          code:     err.code,
        })
      }

      const msg = err instanceof Error ? err.message : String(err)
      throw new SentinelApiError({
        kind:     'network',
        friendly: msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')
          ? 'Analysis timed out fetching market data.'
          : 'Analysis failed. Check your internet connection.',
        detail: msg,
      })
    }
  }

  // Pipeline runs locally — always healthy.
  async health(): Promise<boolean> {
    return true
  }

  // ── History — AppData JSON store via Tauri FS plugin ─────────────────────────

  async listHistory(): Promise<HistoryMeta[]> {
    return historyStore.listHistory()
  }

  async getHistory(id: string): Promise<HistoryEntry | null> {
    return historyStore.getHistory(id)
  }

  async saveHistory(result: PipelineResult, symbol: string, interval: string): Promise<HistoryMeta | null> {
    return historyStore.addHistory(result, symbol, interval)
  }

  async deleteHistory(id: string): Promise<boolean> {
    return historyStore.deleteHistory(id)
  }
}
