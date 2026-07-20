import type { ReplaySnapshot, TimelineEntry, TrackedTrade, ReplayStats } from './types'

const STORAGE_KEY  = 'sentinel_replay_snapshots'
const MAX_SNAPSHOTS = 5

function generateId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export class SnapshotManager {
  private snapshots: ReplaySnapshot[] = []

  constructor() {
    this.hydrate()
  }

  private hydrate(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      this.snapshots = raw ? (JSON.parse(raw) as ReplaySnapshot[]) : []
    } catch {
      this.snapshots = []
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshots))
    } catch {
      // Storage quota — trim to last 3 and retry
      this.snapshots = this.snapshots.slice(0, 3)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshots)) } catch {}
    }
  }

  save(
    label: string,
    symbol: string,
    interval: string,
    timeline: TimelineEntry[],
    trades: TrackedTrade[],
    stats: ReplayStats,
  ): ReplaySnapshot {
    const snap: ReplaySnapshot = {
      id: generateId(),
      label,
      symbol,
      interval,
      createdAt: Date.now(),
      totalFrames: timeline.length,
      timeline,
      trades,
      stats,
    }
    this.snapshots = [snap, ...this.snapshots].slice(0, MAX_SNAPSHOTS)
    this.persist()
    return snap
  }

  list(): ReplaySnapshot[] {
    return [...this.snapshots]
  }

  delete(id: string): void {
    this.snapshots = this.snapshots.filter(s => s.id !== id)
    this.persist()
  }

  clear(): void {
    this.snapshots = []
    this.persist()
  }
}
