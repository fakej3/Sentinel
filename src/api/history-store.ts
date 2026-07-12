/**
 * File-based JSON history store.
 * Persists saved analyses to data/history.json relative to the repo root.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PipelineResult } from '../modules/pipeline/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = path.join(__dirname, '..', '..', 'data')
const HISTORY_FILE = path.join(DATA_DIR, 'history.json')

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
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
  result: PipelineResult
}

export type HistoryMeta = Omit<HistoryEntry, 'result'>

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function load(): HistoryEntry[] {
  ensureDir()
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as HistoryEntry[] : []
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[]): void {
  ensureDir()
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), 'utf-8')
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function stripResult(e: HistoryEntry): HistoryMeta {
  const { result: _result, ...meta } = e
  return meta
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listHistory(): HistoryMeta[] {
  return load().map(stripResult).sort((a, b) => b.savedAt - a.savedAt)
}

export function getHistory(id: string): HistoryEntry | null {
  return load().find(e => e.id === id) ?? null
}

export function addHistory(result: PipelineResult, symbol: string, interval: string): HistoryMeta {
  const entries = load()

  const plan = result.tradePlan
  const confidence = result.confidence
  const decision = result.decision

  const binancePost = result.generatedAnalysis?.fullReport ?? result.generatedAnalysis?.summary ?? ''

  const entry: HistoryEntry = {
    id:          makeId(),
    savedAt:     Date.now(),
    symbol:      symbol.toUpperCase(),
    interval,
    decision:    decision?.label ?? 'No Trade',
    grade:       confidence.grade,
    confidence:  confidence.score,
    trust:       confidence.trust?.level ?? null,
    riskLevel:   decision?.riskLevel ?? null,
    rr:          plan?.riskRewardRatio ?? null,
    entry:       plan?.entryZone ? [plan.entryZone.lower, plan.entryZone.upper] : null,
    stop:        plan?.invalidationLevel ?? null,
    targets:     plan?.targetLevel ? [plan.targetLevel] : [],
    trend:       result.analysis.fullTrend.trend,
    binancePost,
    result,
  }

  // Deduplicate: replace existing entry for same symbol+interval if saved within last 60s
  const recent = Date.now() - 60_000
  const filtered = entries.filter(
    e => !(e.symbol === entry.symbol && e.interval === entry.interval && e.savedAt > recent),
  )
  filtered.unshift(entry)

  // Keep max 200 entries
  save(filtered.slice(0, 200))
  return stripResult(entry)
}

export function deleteHistory(id: string): boolean {
  const entries = load()
  const filtered = entries.filter(e => e.id !== id)
  if (filtered.length === entries.length) return false
  save(filtered)
  return true
}
