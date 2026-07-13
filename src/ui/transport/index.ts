import { HttpTransport } from './HttpTransport'
import { TauriTransport } from './TauriTransport'
import type { AnalysisTransport } from './types'

// ── Environment detection ─────────────────────────────────────────────────────

// Tauri v2 injects __TAURI_INTERNALS__ into the webview before any JS runs.
// Checking typeof window first makes this safe in Node (test) environments too.
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ── Singleton transport instance ──────────────────────────────────────────────

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

let _transport: AnalysisTransport | null = null

/**
 * Returns the active transport implementation.
 *
 * - Inside Tauri webview → TauriTransport (discovers sidecar URL via IPC)
 * - Browser / dev server → HttpTransport (VITE_API_URL or localhost:3000)
 */
export function getTransport(): AnalysisTransport {
  if (!_transport) {
    _transport = isTauriEnv() ? new TauriTransport() : new HttpTransport(BASE_URL)
  }
  return _transport
}

// Re-export everything callers need from this single entry point
export { SentinelApiError } from './types'
export type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry, ApiErrorKind, ApiErrorInfo } from './types'
