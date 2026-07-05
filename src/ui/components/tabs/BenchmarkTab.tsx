import { FlaskConical, Bug, Clock } from 'lucide-react'
import { Card } from '../shared/Card'
import { formatTimestamp, formatMs } from '../../utils/format'
import { scoreColor, trendColor } from '../../utils/colors'
import type { PipelineResult } from '../../types'

interface BenchmarkTabProps {
  result?: PipelineResult
}

// ── Confidence Debug Panel ────────────────────────────────────────────────────
// Shows the raw PipelineResult.confidence object exactly as received from the
// API — no reconstruction, no recomputation. Every value displayed is a direct
// property read from the object the component received as a prop.
// TEMPORARY — Module 28 Production Investigation.

function ConfidenceDebugPanel({ result }: { result: PipelineResult }) {
  const { confidence, analysis, metadata } = result
  const trend = analysis.fullTrend.trend

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug size={13} className="text-amber-400" />
          <p className="text-xs font-semibold text-amber-400">Confidence Debug Panel — Raw Pipeline Object</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={10} className="text-slate-600" />
          <span className="text-[10px] font-mono text-slate-600">{formatTimestamp(metadata.timestamp)}</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed">
        Displays <code className="text-amber-400/70">PipelineResult.confidence</code> exactly as received.
        No reconstruction. No recomputation. Direct property reads only.
      </p>

      {/* Key fields — direct property reads, zero computation */}
      <div className="space-y-0.5">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Key Fields (direct property reads)</p>
        <div className="bg-surface-900 border border-border-subtle rounded-lg px-3 py-2 space-y-1">
          {([
            ['confidence.score',                String(confidence.score),               scoreColor(confidence.score)],
            ['confidence.grade',               confidence.grade,                        'text-slate-300'],
            ['confidence.bullishConfidence',   String(confidence.bullishConfidence),    'text-emerald-400'],
            ['confidence.bearishConfidence',   String(confidence.bearishConfidence),    'text-red-400'],
            ['confidence.neutralContribution', String(confidence.neutralContribution),  'text-slate-400'],
            ['confidence.reasons.length',      String(confidence.reasons.length),       'text-slate-300'],
            ['confidence.penalties.length',    String(confidence.penalties.length),     'text-slate-300'],
            ['confidence.trust.score',         `${confidence.trust.score}%`,            'text-slate-300'],
            ['confidence.trust.level',         confidence.trust.level,                  'text-slate-300'],
            ['analysis.fullTrend.trend',       trend,                                   trendColor(trend)],
            ['analysis.fullTrend.bullishConditionsMet', `${analysis.fullTrend.bullishConditionsMet}/5`, 'text-slate-300'],
            ['analysis.fullTrend.bearishConditionsMet', `${analysis.fullTrend.bearishConditionsMet}/5`, 'text-slate-300'],
            ['analysis.fullTrend.neutralConditionsMet', `${analysis.fullTrend.neutralConditionsMet}/4`, 'text-slate-300'],
          ] as [string, string, string][]).map(([label, value, color]) => (
            <div key={label} className="flex items-start justify-between gap-4 py-0.5 border-b border-border-subtle/30 last:border-0">
              <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">{label}</span>
              <span className={`text-[10px] font-mono font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown sub-scores */}
      <div className="space-y-0.5">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">confidence.breakdown (0–10 sub-scores)</p>
        <div className="bg-surface-900 border border-border-subtle rounded-lg px-3 py-2 space-y-1">
          {(Object.entries(confidence.breakdown) as [string, number][]).map(([key, val]) => (
            <div key={key} className="flex items-start justify-between gap-4 py-0.5 border-b border-border-subtle/30 last:border-0">
              <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">breakdown.{key}</span>
              <span className="text-[10px] font-mono text-slate-300">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reasons */}
      <div className="space-y-0.5">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
          confidence.reasons ({confidence.reasons.length} factors matched in factorWeights)
        </p>
        <div className="bg-surface-900 border border-border-subtle rounded-lg px-3 py-2 space-y-0.5">
          {confidence.reasons.length === 0 ? (
            <p className="text-[10px] text-red-400 py-1">
              NO FACTORS MATCHED — evidence array may be empty or factor names don&apos;t match config.factorWeights.
              This would produce score = 0.
            </p>
          ) : (
            confidence.reasons.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-0.5 border-b border-border-subtle/20 last:border-0">
                <span className={`text-[9px] font-mono flex-shrink-0 w-14 ${r.direction === 'bullish' ? 'text-emerald-400' : r.direction === 'bearish' ? 'text-red-400' : 'text-slate-400'}`}>{r.direction}</span>
                <span className="text-[9px] text-slate-400 flex-1 truncate">{r.factor}</span>
                <span className={`text-[9px] font-mono flex-shrink-0 ${r.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.points > 0 ? '+' : ''}{r.points}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Penalties */}
      {confidence.penalties.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
            confidence.penalties ({confidence.penalties.length})
          </p>
          <div className="bg-surface-900 border border-border-subtle rounded-lg px-3 py-2 space-y-1">
            {confidence.penalties.map((p, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-0.5 border-b border-border-subtle/30 last:border-0">
                <span className="text-[10px] text-slate-500 flex-shrink-0">{p.source}</span>
                <span className="text-[10px] text-red-400 text-right">-{p.scoreReduction.toFixed(4)} — {p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trust reductions */}
      {confidence.trust.reductions.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">trust.reductions</p>
          <div className="bg-surface-900 border border-border-subtle rounded-lg px-3 py-2 space-y-1">
            {confidence.trust.reductions.map((r, i) => (
              <div key={i} className="text-[10px] text-slate-400">{r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Full raw JSON */}
      <div className="space-y-0.5">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
          Full PipelineResult.confidence (raw JSON — what the component received)
        </p>
        <pre className="bg-surface-900 border border-amber-400/20 rounded-lg px-3 py-2 text-[9px] font-mono text-slate-400 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre">
          {JSON.stringify(confidence, null, 2)}
        </pre>
      </div>

      {/* Pipeline timings */}
      <div className="space-y-0.5">
        <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Pipeline Timings / Metadata</p>
        <div className="bg-surface-900 border border-border-subtle rounded-lg px-3 py-2 space-y-1">
          {([
            ['total',          formatMs(metadata.timings.total)],
            ['confidence',     formatMs(metadata.timings.confidence)],
            ['analysis',       formatMs(metadata.timings.analysis)],
            ['version',        metadata.version],
            ['candleCount',    String(metadata.candleCount)],
            ['symbol',         metadata.symbol],
            ['interval',       metadata.interval],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 py-0.5 border-b border-border-subtle/30 last:border-0">
              <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">{label}</span>
              <span className="text-[10px] font-mono text-slate-300">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[9px] text-slate-700 text-center leading-relaxed">
        TEMPORARY DEBUG PANEL — Module 28 Production Investigation
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BenchmarkTab({ result }: BenchmarkTabProps) {
  if (result) {
    return (
      <div className="p-4 max-w-xl mx-auto animate-in space-y-3">
        <ConfidenceDebugPanel result={result} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-in">
      <div className="w-16 h-16 rounded-2xl bg-surface-700 border border-border-subtle flex items-center justify-center mb-5">
        <FlaskConical size={28} className="text-slate-500" />
      </div>

      <h3 className="text-base font-semibold text-slate-200 mb-2">Benchmark Engine</h3>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
        Historical replay benchmarking is reserved for Module 11 datasets.
        This tab will display comparative accuracy reports once reference datasets are available.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Card className="p-3 flex items-start gap-3 text-left opacity-50">
          <p className="text-xs text-slate-400">Run an analysis first, then return to this tab to see the confidence debug panel.</p>
        </Card>
      </div>

      <p className="text-[11px] text-slate-600 mt-8">
        See <code className="text-slate-500">KNOWN_LIMITATIONS.md</code> for the benchmark roadmap.
      </p>
    </div>
  )
}
