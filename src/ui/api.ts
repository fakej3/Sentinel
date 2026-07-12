/**
 * Backward-compatible re-export façade.
 *
 * All network logic now lives in src/ui/transport/.
 * This file delegates to getTransport() so that existing tests, which import
 * named functions from this module and mock global fetch, continue to work
 * without changes.
 *
 * React components should prefer importing from '../transport' (or './transport')
 * directly and calling getTransport().<method>() instead of these wrappers.
 */
import { getTransport } from './transport'
import type { PipelineResult } from './types'

export { SentinelApiError } from './transport'
export type { ApiErrorKind, ApiErrorInfo, AnalyzeOptions, HistoryMeta, HistoryEntry } from './transport'

export async function analyze(
  symbol: string,
  interval: string,
  options?: import('./transport').AnalyzeOptions,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  return getTransport().analyze(symbol, interval, options, signal)
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  return getTransport().health(signal)
}

export async function fetchHistory(): Promise<import('./transport').HistoryMeta[]> {
  return getTransport().listHistory()
}

export async function fetchHistoryEntry(id: string): Promise<import('./transport').HistoryEntry | null> {
  return getTransport().getHistory(id)
}

export async function saveAnalysis(
  result: PipelineResult,
  symbol: string,
  interval: string,
): Promise<import('./transport').HistoryMeta | null> {
  return getTransport().saveHistory(result, symbol, interval)
}

export async function deleteHistoryEntry(id: string): Promise<boolean> {
  return getTransport().deleteHistory(id)
}
