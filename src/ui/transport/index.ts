import { HttpTransport } from './HttpTransport'
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

// Eagerly start loading TauriTransport when running inside Tauri so that by
// the time the first user action calls getTransport() the module is ready.
// Vite emits TauriTransport (and the full analysis pipeline it imports) as a
// separate chunk, so web builds never download or parse the pipeline code.
if (isTauriEnv()) {
  void import('./TauriTransport').then(m => { _transport = new m.TauriTransport() })
}

/**
 * Returns the active transport implementation.
 *
 * - Inside Tauri webview → TauriTransport (runs the pipeline locally)
 * - Browser / dev server → HttpTransport (VITE_API_URL or localhost:3000)
 */
export function getTransport(): AnalysisTransport {
  if (_transport) return _transport
  if (!isTauriEnv()) {
    _transport = new HttpTransport(BASE_URL)
    return _transport
  }
  // Tauri: dynamic import hasn't resolved yet (window between module evaluation
  // and the first microtask tick — should never be reached in practice).
  // Return a transient instance rather than assigning, so the real singleton
  // is still set by the pending .then() above.
  return new HttpTransport(BASE_URL)
}

// Re-export everything callers need from this single entry point
export { SentinelApiError } from './types'
export type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry, ApiErrorKind, ApiErrorInfo } from './types'
