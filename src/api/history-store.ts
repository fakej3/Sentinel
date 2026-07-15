/**
 * File-based JSON history store.
 * Persists saved analyses to data/history.json relative to the repo root.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PipelineResult } from '../modules/pipeline/types'
import { buildHistoryEntry, stripResult } from '../modules/pipeline/history-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = path.join(__dirname, '..', '..', 'data')
const HISTORY_FILE = path.join(DATA_DIR, 'history.json')

// Bump when the HistoryEntry shape changes in a way that requires migration.
const SCHEMA_VERSION = 1

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

interface HistoryFile {
  schemaVersion: number
  entries: HistoryEntry[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function migrate(raw: unknown): HistoryEntry[] {
  // Pre-versioning: the file was a plain HistoryEntry[]
  if (Array.isArray(raw)) return raw as HistoryEntry[]

  const file = raw as Partial<HistoryFile>
  if (!Array.isArray(file.entries)) return []

  // Future schema versions: add migration steps here before returning entries.
  return file.entries as HistoryEntry[]
}

function load(): HistoryEntry[] {
  ensureDir()
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8')
    return migrate(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[]): void {
  ensureDir()
  const file: HistoryFile = { schemaVersion: SCHEMA_VERSION, entries }
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(file, null, 2), 'utf-8')
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listHistory(): HistoryMeta[] {
  return load().map(e => stripResult(e)).sort((a, b) => b.savedAt - a.savedAt)
}

export function getHistory(id: string): HistoryEntry | null {
  return load().find(e => e.id === id) ?? null
}

export function addHistory(result: PipelineResult, symbol: string, interval: string): HistoryMeta {
  const entries = load()

  const entry: HistoryEntry = {
    ...buildHistoryEntry(result, symbol, interval),
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
