import { memo } from 'react'
import { clsx } from 'clsx'
import type { ReplayStats } from '../../../modules/replay/types'

interface StatsPanelProps {
  stats: ReplayStats
  onClose?: () => void
}

export const StatsPanel = memo(function StatsPanel({ stats }: StatsPanelProps) {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const fmt  = (n: number) => n.toFixed(2)

  return (
    <div className="overflow-y-auto text-[11px] divide-y divide-border-subtle">
      {/* Overview */}
      <Section title="Overview">
        <Grid>
          <BigStat label="Win Rate"     value={pct(stats.winRate)} color="text-emerald-400" />
          <BigStat label="Total Trades" value={String(stats.totalTrades)} />
          <BigStat label="Wins"         value={String(stats.wins)} color="text-emerald-400" />
          <BigStat label="Losses"       value={String(stats.losses)} color="text-red-400" />
          <BigStat label="Open"         value={String(stats.openTrades)} color="text-yellow-400" />
          <BigStat label="Avg RR"       value={fmt(stats.avgRR) + 'R'} />
        </Grid>
      </Section>

      {/* Percentages */}
      <Section title="Outcomes">
        <div className="space-y-1.5 px-3 py-2">
          <Bar label="TP Hit"  pct={stats.tpPercent} color="bg-emerald-500" />
          <Bar label="SL Hit"  pct={stats.slPercent} color="bg-red-500" />
          <Bar label="Open"    pct={stats.openPercent} color="bg-yellow-500" />
        </div>
      </Section>

      {/* Execution quality */}
      <Section title="Execution">
        <Grid>
          <KV label="Avg Hold" value={`${stats.avgHoldTimeCandles.toFixed(1)} candles`} />
          <KV label="Avg Confidence" value={fmt(stats.avgConfidence)} />
          <KV label="Avg MFE" value={fmt(stats.avgMFE)} />
          <KV label="Avg MAE" value={fmt(stats.avgMAE)} />
        </Grid>
      </Section>

      {/* Confidence buckets */}
      <Section title="Confidence vs Win Rate">
        <div className="px-3 py-2 space-y-1">
          {stats.confidenceBuckets.filter(b => b.count > 0).map(b => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-slate-500 w-10 shrink-0">{b.label}</span>
              <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${b.winRate * 100}%` }}
                />
              </div>
              <span className="text-slate-400 tabular-nums w-10 text-right">
                {pct(b.winRate)}
              </span>
              <span className="text-slate-600 tabular-nums w-8 text-right">
                {b.count}
              </span>
            </div>
          ))}
          {stats.confidenceBuckets.every(b => b.count === 0) && (
            <span className="text-slate-600">No closed trades</span>
          )}
        </div>
      </Section>

      {/* Quality distribution */}
      {Object.keys(stats.qualityDistribution).length > 0 && (
        <Section title="Setup Quality">
          <div className="px-3 py-2 flex flex-wrap gap-2">
            {Object.entries(stats.qualityDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([q, n]) => (
                <div key={q} className="flex items-center gap-1">
                  <span className={clsx('font-semibold', qualityColor(q))}>{q}</span>
                  <span className="text-slate-500">{n}</span>
                </div>
              ))
            }
          </div>
        </Section>
      )}
    </div>
  )
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-medium">{title}</span>
      </div>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-3 pb-2">
      {children}
    </div>
  )
}

function BigStat({ label, value, color = 'text-slate-200' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className={clsx('text-sm font-semibold tabular-nums', color)}>{value}</span>
      <span className="text-[10px] text-slate-600">{label}</span>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-slate-300 font-medium">{value}</span>
      <span className="text-[10px] text-slate-600">{label}</span>
    </div>
  )
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="text-slate-400 tabular-nums w-12 text-right">{(pct * 100).toFixed(1)}%</span>
    </div>
  )
}

function qualityColor(q: string): string {
  if (q === 'A+' || q === 'A') return 'text-emerald-400'
  if (q === 'B')                return 'text-blue-400'
  if (q === 'C')                return 'text-yellow-400'
  return 'text-slate-400'
}
