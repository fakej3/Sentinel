import { analyzeMarket, PipelineError } from '@engine/pipeline'
import { buildHistoryEntry, stripResult } from '@engine/pipeline/history-utils'
import { SentinelApiError } from '@ui/transport/types'
import type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry } from '@ui/transport/types'
import type { PipelineResult } from '@ui/types'
import type { Timeframe } from '@engine/market/types'
import { STORAGE_KEYS } from '@ui/constants/storageKeys'

const HISTORY_LIST_KEY  = 'sentinel_web_history_list'
const HISTORY_ENTRY_KEY = (id: string) => `sentinel_web_history_${id}`
const MAX_HISTORY = 50

function friendlyForCode(code: string, fallback: string): string {
  switch (code) {
    case 'fetch_failure':        return 'Could not reach market data. Check your internet connection.'
    case 'insufficient_candles': return 'Not enough candle data for this symbol and timeframe.'
    case 'configuration_error':  return 'Invalid request configuration.'
    case 'validation_failure':   return 'The analysis output failed internal validation.'
    default:                     return fallback
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

    const geminiKey = typeof localStorage !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEYS.geminiKey) ?? '')
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
