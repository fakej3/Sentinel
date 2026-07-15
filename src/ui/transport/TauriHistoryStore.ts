import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import type { PipelineResult } from '../types'
import type { HistoryMeta, HistoryEntry } from './types'

// Stored under $APPDATA/sentinel/history.json
const HISTORY_DIR  = 'sentinel'
const HISTORY_FILE = 'sentinel/history.json'
const BASE         = BaseDirectory.AppData

const MAX_ENTRIES  = 200
const DEDUP_WINDOW = 60_000

// Bump when the HistoryEntry shape changes in a way that requires migration.
const SCHEMA_VERSION = 1

interface HistoryFile {
  schemaVersion: number
  entries: HistoryEntry[]
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function stripResult(e: HistoryEntry): HistoryMeta {
  const { result: _result, ...meta } = e
  return meta
}

function migrate(raw: unknown): HistoryEntry[] {
  // Pre-versioning: the file was a plain HistoryEntry[]
  if (Array.isArray(raw)) return raw as HistoryEntry[]

  const file = raw as Partial<HistoryFile>
  if (!Array.isArray(file.entries)) return []

  // Future schema versions: add migration steps here before returning entries.
  return file.entries as HistoryEntry[]
}

async function load(): Promise<HistoryEntry[]> {
  try {
    const dirExists = await exists(HISTORY_DIR, { baseDir: BASE })
    if (!dirExists) return []
    const fileExists = await exists(HISTORY_FILE, { baseDir: BASE })
    if (!fileExists) return []
    const raw = await readTextFile(HISTORY_FILE, { baseDir: BASE })
    return migrate(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

async function persist(entries: HistoryEntry[]): Promise<void> {
  const dirExists = await exists(HISTORY_DIR, { baseDir: BASE })
  if (!dirExists) {
    await mkdir(HISTORY_DIR, { baseDir: BASE, recursive: true })
  }
  const file: HistoryFile = { schemaVersion: SCHEMA_VERSION, entries }
  await writeTextFile(HISTORY_FILE, JSON.stringify(file, null, 2), { baseDir: BASE })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listHistory(): Promise<HistoryMeta[]> {
  const entries = await load()
  return entries.map(stripResult).sort((a, b) => b.savedAt - a.savedAt)
}

export async function getHistory(id: string): Promise<HistoryEntry | null> {
  const entries = await load()
  return entries.find(e => e.id === id) ?? null
}

export async function addHistory(
  result: PipelineResult,
  symbol: string,
  interval: string,
): Promise<HistoryMeta> {
  const entries = await load()

  const plan       = result.tradePlan
  const confidence = result.confidence
  const decision   = result.decision
  const binancePost = result.generatedAnalysis?.fullReport ?? result.generatedAnalysis?.summary ?? ''

  const entry: HistoryEntry = {
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
    result,
  }

  const recent   = Date.now() - DEDUP_WINDOW
  const filtered = entries.filter(
    e => !(e.symbol === entry.symbol && e.interval === entry.interval && e.savedAt > recent),
  )
  filtered.unshift(entry)

  await persist(filtered.slice(0, MAX_ENTRIES))
  return stripResult(entry)
}

export async function deleteHistory(id: string): Promise<boolean> {
  const entries = await load()
  const filtered = entries.filter(e => e.id !== id)
  if (filtered.length === entries.length) return false
  await persist(filtered)
  return true
}

export async function clearHistory(): Promise<void> {
  await persist([])
}
