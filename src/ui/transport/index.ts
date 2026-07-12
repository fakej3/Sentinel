import { HttpTransport } from './HttpTransport'
import type { AnalysisTransport } from './types'

// ── Singleton transport instance ──────────────────────────────────────────────

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

let _transport: AnalysisTransport | null = null

/**
 * Returns the active transport implementation.
 *
 * Today this always returns HttpTransport (Express HTTP).
 * To add Tauri or mobile support, replace the constructor call here —
 * every React component that calls getTransport() picks up the change
 * automatically, with no other modifications needed.
 */
export function getTransport(): AnalysisTransport {
  if (!_transport) _transport = new HttpTransport(BASE_URL)
  return _transport
}

// Re-export everything callers need from this single entry point
export { SentinelApiError } from './types'
export type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry, ApiErrorKind, ApiErrorInfo } from './types'
