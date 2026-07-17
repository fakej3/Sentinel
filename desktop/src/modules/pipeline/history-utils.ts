/**
 * Shared utilities for building history entries.
 * Both the HTTP history store (src/api/history-store.ts) and the Tauri history
 * store (src/ui/transport/TauriHistoryStore.ts) use these to avoid duplicated
 * entry-construction logic.
 */
import type { PipelineResult } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BaseHistoryEntry {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function stripResult<T extends BaseHistoryEntry & { result: unknown }>(
  e: T,
): Omit<T, 'result'> {
  const { result: _result, ...meta } = e
  return meta as Omit<T, 'result'>
}

export function buildHistoryEntry(
  result: PipelineResult,
  symbol: string,
  interval: string,
): BaseHistoryEntry {
  const plan       = result.tradePlan
  const confidence = result.confidence
  const decision   = result.decision
  const binancePost = result.generatedAnalysis?.fullReport ?? result.generatedAnalysis?.summary ?? ''

  return {
    id:         makeId(),
    savedAt:    Date.now(),
    symbol:     symbol.toUpperCase(),
    interval,
    decision:   decision?.label ?? 'No Trade',
    grade:      confidence.grade,
    confidence: confidence.score,
    trust:      confidence.trust?.level ?? null,
    riskLevel:  decision?.riskLevel ?? null,
    rr:         plan?.riskRewardRatio ?? null,
    entry:      plan?.entryZone ? [plan.entryZone.lower, plan.entryZone.upper] : null,
    stop:       plan?.invalidationLevel ?? null,
    targets:    plan?.targetLevel ? [plan.targetLevel] : [],
    trend:      result.analysis.fullTrend.trend,
    binancePost,
  }
}
