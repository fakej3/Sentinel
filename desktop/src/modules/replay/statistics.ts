import type { TrackedTrade, ReplayStats, ConfidenceBucket } from './types'

const BUCKETS: Array<[string, number, number]> = [
  ['0–4',  0, 4],
  ['4–5',  4, 5],
  ['5–6',  5, 6],
  ['6–7',  6, 7],
  ['7–8',  7, 8],
  ['8–10', 8, 10.01],
]

function buildBuckets(trades: TrackedTrade[]): ConfidenceBucket[] {
  const buckets: ConfidenceBucket[] = BUCKETS.map(([label, min, max]) => ({
    label, minConfidence: min, maxConfidence: max, count: 0, wins: 0, winRate: 0,
  }))

  for (const t of trades) {
    if (t.outcome === 'open') continue
    const b = buckets.find(x => t.confidence >= x.minConfidence && t.confidence < x.maxConfidence)
    if (!b) continue
    b.count++
    if (t.outcome === 'tp_hit') b.wins++
  }

  for (const b of buckets) {
    b.winRate = b.count > 0 ? b.wins / b.count : 0
  }
  return buckets
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
}

export function computeReplayStats(trades: TrackedTrade[]): ReplayStats {
  const closed = trades.filter(t => t.outcome !== 'open')
  const wins   = closed.filter(t => t.outcome === 'tp_hit')
  const losses = closed.filter(t => t.outcome === 'sl_hit')
  const open   = trades.filter(t => t.outcome === 'open')

  const qualityDistribution: Record<string, number> = {}
  for (const t of trades) {
    qualityDistribution[t.setupQuality] = (qualityDistribution[t.setupQuality] ?? 0) + 1
  }

  return {
    totalTrades:         trades.length,
    wins:                wins.length,
    losses:              losses.length,
    openTrades:          open.length,
    winRate:             closed.length > 0 ? wins.length / closed.length : 0,
    avgRR:               avg(closed.filter(t => t.riskRewardRatio !== null).map(t => t.riskRewardRatio!)),
    avgHoldTimeCandles:  avg(closed.filter(t => t.durationCandles !== null).map(t => t.durationCandles!)),
    avgConfidence:       avg(trades.map(t => t.confidence)),
    avgMFE:              avg(trades.map(t => t.mfe)),
    avgMAE:              avg(trades.map(t => t.mae)),
    tpPercent:           closed.length > 0 ? wins.length   / closed.length : 0,
    slPercent:           closed.length > 0 ? losses.length / closed.length : 0,
    openPercent:         trades.length  > 0 ? open.length  / trades.length  : 0,
    confidenceBuckets:   buildBuckets(trades),
    qualityDistribution,
  }
}
