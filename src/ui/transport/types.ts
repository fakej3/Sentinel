import type { PipelineResult } from '../types'

// ── Error types ───────────────────────────────────────────────────────────────

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

// ── Option types ──────────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  candleLimit?: number
  config?: Record<string, unknown>
}

// ── History types ─────────────────────────────────────────────────────────────

export interface HistoryMeta {
  id: string
  savedAt: number
  symbol: string
  interval: string
  decision: string
  grade: string
  confidence: number
  trust: string | null
  riskLevel: string | null
  rr: number | null
  entry: [number, number] | null
  stop: number | null
  targets: number[]
  trend: string
  binancePost: string
}

export interface HistoryEntry extends HistoryMeta {
  result: PipelineResult
}

// ── Transport interface ───────────────────────────────────────────────────────

/**
 * Decouples the React UI from any specific transport mechanism.
 * Implementations: HttpTransport (Express HTTP) and TauriTransport (in-process).
 */
export interface AnalysisTransport {
  /** Run the full analysis pipeline for a symbol/interval. */
  analyze(
    symbol: string,
    interval: string,
    options?: AnalyzeOptions,
    signal?: AbortSignal,
  ): Promise<PipelineResult>

  /** Returns true if the backend is reachable. */
  health(signal?: AbortSignal): Promise<boolean>

  /** List all saved analyses (summary metadata only). */
  listHistory(): Promise<HistoryMeta[]>

  /** Fetch a single saved analysis by id. */
  getHistory(id: string): Promise<HistoryEntry | null>

  /** Persist an analysis result and return its metadata record. */
  saveHistory(
    result: PipelineResult,
    symbol: string,
    interval: string,
  ): Promise<HistoryMeta | null>

  /** Delete a saved analysis. Returns true on success. */
  deleteHistory(id: string): Promise<boolean>

  /** Delete all saved analyses and return to first-launch state. */
  clearAllHistory(): Promise<void>
}
