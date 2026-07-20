import { BrowserTransport } from './BrowserTransport'
import type { AnalysisTransport } from '@ui/transport/types'

let _transport: AnalysisTransport | null = null

export function getTransport(): AnalysisTransport {
  if (!_transport) _transport = new BrowserTransport()
  return _transport
}

// Re-export everything callers need from this single entry point
export { SentinelApiError } from '@ui/transport/types'
export type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry, ApiErrorKind, ApiErrorInfo } from '@ui/transport/types'
