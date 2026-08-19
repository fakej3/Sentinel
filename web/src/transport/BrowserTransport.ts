import { analyzeMarket, PipelineError } from '@engine/pipeline'
import { buildHistoryEntry, stripResult } from '@engine/pipeline/history-utils'
import { SentinelApiError } from '@ui/transport/types'
import type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry } from '@ui/transport/types'
import type { PipelineResult } from '@ui/types'
import type { Timeframe } from '@engine/market/types'

const GEMINI_ENDPOINT = '/api/gemini'

const HISTORY_LIST_KEY  = 'sentinel_web_history_list'
const HISTORY_ENTRY_KEY = (id: string) => `sentinel_web_history_${id}`
const MAX_HISTORY = 50

function friendlyForCode(code: string, reason: string): string {
  switch (code) {
    case 'fetch_failure': {
      const match = reason.match(/:\s*([^:]+)$/)
      const detail = match ? match[1].trim() : null
      if (!detail) return 'Market data fetch failed. Check your internet connection.'
      const lower = detail.toLowerCase()
      if (lower.includes('invalid symbol')) return 'Symbol not found on Binance. Verify the ticker is correct.'
      if (lower.includes('timeout') || lower.includes('timed out')) return 'Market data request timed out. Check your internet connection.'
      if (lower.includes('network error') || lower.includes('failed to fetch')) return 'Network error reaching Binance. Check your internet connection.'
      return `Market data error: ${detail}`
    }
    case 'insufficient_candles': return 'Not enough candle data for this symbol and timeframe.'
    case 'configuration_error':  return 'Invalid request configuration.'
    case 'validation_failure':   return 'The analysis output failed internal validation.'
    default:                     return reason
  }
}

export class BrowserTransport implements AnalysisTransport {
  async analyze(
    symbol: string,
    interval: string,
    options?: AnalyzeOptions,
    signal?: AbortSignal,
  ): Promise<PipelineResult> {
    if (signal?.aborted) {
      throw new SentinelApiError({ kind: 'abort', friendly: 'Request cancelled.' })
    }

    try {
      const result = await analyzeMarket({
        symbol:      symbol.trim().toUpperCase(),
        interval:    interval as Timeframe,
        candleLimit: options?.candleLimit,
      })

      // Optional server-side AI enhancement — Gemini key never touches the browser.
      // Runs after the pipeline so it can only affect summary/conclusion text.
      if (!signal?.aborted) {
        try {
          const ga = result.generatedAnalysis
          const aiRes = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol,
              interval,
              headline:        ga.headline,
              summary:         ga.summary,
              conclusion:      ga.conclusion,
              fullReport:      ga.fullReport,
              confidenceScore: result.confidence.score,
              confidenceGrade: result.confidence.grade,
            }),
            signal,
          })
          if (aiRes.ok) {
            const enhanced = await aiRes.json() as { summary?: string; conclusion?: string }
            if (enhanced.summary && enhanced.conclusion) {
              result.generatedAnalysis = {
                ...ga,
                summary:    enhanced.summary,
                conclusion: enhanced.conclusion,
                aiEnhanced: true,
              }
            }
          }
        } catch {
          // AI enhancement is always optional — silently fall back to deterministic output
        }
      }

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

  async health(): Promise<boolean> {
    return true
  }

  async listHistory(): Promise<HistoryMeta[]> {
    try {
      const raw = localStorage.getItem(HISTORY_LIST_KEY)
      return raw ? (JSON.parse(raw) as HistoryMeta[]) : []
    } catch {
      return []
    }
  }

  async getHistory(id: string): Promise<HistoryEntry | null> {
    try {
      const raw = localStorage.getItem(HISTORY_ENTRY_KEY(id))
      return raw ? (JSON.parse(raw) as HistoryEntry) : null
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
      const base    = buildHistoryEntry(result, symbol, interval)
      const entry: HistoryEntry = { ...base, result }
      localStorage.setItem(HISTORY_ENTRY_KEY(base.id), JSON.stringify(entry))

      const meta    = stripResult(entry)
      const list    = await this.listHistory()
      const updated = [meta, ...list].slice(0, MAX_HISTORY)
      localStorage.setItem(HISTORY_LIST_KEY, JSON.stringify(updated))

      return meta
    } catch {
      return null
    }
  }

  async deleteHistory(id: string): Promise<boolean> {
    try {
      localStorage.removeItem(HISTORY_ENTRY_KEY(id))
      const list    = await this.listHistory()
      const updated = list.filter((m: HistoryMeta) => m.id !== id)
      localStorage.setItem(HISTORY_LIST_KEY, JSON.stringify(updated))
      return true
    } catch {
      return false
    }
  }

  async clearAllHistory(): Promise<void> {
    try {
      const list = await this.listHistory()
      list.forEach(m => localStorage.removeItem(HISTORY_ENTRY_KEY(m.id)))
      localStorage.removeItem(HISTORY_LIST_KEY)
    } catch {
      // ignore
    }
  }
}
