import { FlaskConical, Bug, Clock } from 'lucide-react'
import { Card } from '../shared/Card'
import { formatTimestamp, formatMs } from '../../utils/format'
import { scoreColor, trendColor, directionColor } from '../../utils/colors'
import type { PipelineResult } from '../../types'

interface BenchmarkTabProps {
  result?: PipelineResult
}

// ── Debug confidence panel ────────────────────────────────────────────────────
// Step 8 of the production debugging investigation plan.
// Shows every number the confidence engine computed so the browser can be used
// to trace whether the UI displays what the engine actually returns.
// TEMPORARY — remove once the root cause is confirmed resolved.

function DebugRow({ label, value, mono = true, dimmed = false }: {
  label: string; value: string | number; mono?: boolean; dimmed?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 border-b border-border-subtle/30 last:border-0">
      <span className={`text-[10px] ${dimmed ? 'text-slate-600' : 'text-slate-500'} flex-shrink-0`}>{label}</span>
      <span className={`text-[10px] text-right break-all ${mono ? 'font-mono' : ''} ${dimmed ? 'text-slate-600' : 'text-slate-300'}`}>
        {typeof value === 'number' ? value.toFixed(4).replace(/\.?0+$/, '') || '0' : value}
      </span>
    </div>
  )
}

function DebugSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{title}</p>
      <div className="bg-surface-900 border border-border-subtle rounded-lg px-3 py-2 space-y-0">
        {children}
      </div>
    </div>
  )
}

function ConfidenceDebugPanel({ result }: { result: PipelineResult }) {
  const { confidence, analysis, metadata } = result
  const { fullTrend } = analysis
  const trend = fullTrend.trend

  // Recover approximate raw points from normalized sub-scores (divisor=10)
  const bullPts  = confidence.bullishConfidence * 10
  const bearPts  = confidence.bearishConfidence * 10
  const neutPts  = confidence.neutralContribution  // exact
  const neutFactor = 0.5  // neutralStrengthFactor default

  // Reconstruct the direction-aware calculation
  let directedPts: number
  let contradictionPts: number
  if (trend.includes('bullish')) {
    directedPts     = bullPts + neutPts * neutFactor
    contradictionPts = bearPts
  } else if (trend.includes('bearish')) {
    directedPts     = bearPts + neutPts * neutFactor
    contradictionPts = bullPts
  } else {
    directedPts     = Math.abs(bullPts - bearPts + neutPts)
    contradictionPts = 0
  }

  const penaltyFactor = 0.3
  const penalizedPts = Math.max(0, directedPts - contradictionPts * penaltyFactor)
  const prePenaltyScore = Math.min(10, penalizedPts / 10)

  // Validation penalties from result
  const totalPenaltyReduction = confidence.penalties.reduce((sum, p) => sum + p.scoreReduction, 0)

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug size={13} className="text-amber-400" />
          <p className="text-xs font-semibold text-amber-400">Confidence Debug Panel</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={10} className="text-slate-600" />
          <span className="text-[10px] font-mono text-slate-600">{formatTimestamp(metadata.timestamp)}</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed">
        Every number below comes directly from the <code className="text-amber-400/70">PipelineResult.confidence</code> object
        returned by the API — no transformations. Use this to verify the UI displays what the engine computed.
      </p>

      {/* Final output */}
      <DebugSection title="Final Output">
        <DebugRow label="score" value={
          <span className={`font-mono text-[10px] font-bold ${scoreColor(confidence.score)}`}>
            {confidence.score.toFixed(4)}
          </span> as any
        } />
        <DebugRow label="grade" value={confidence.grade} />
        <DebugRow label="bullishConfidence (normalized)" value={confidence.bullishConfidence} />
        <DebugRow label="bearishConfidence (normalized)" value={confidence.bearishConfidence} />
        <DebugRow label="neutralContribution (raw pts)" value={confidence.neutralContribution} />
      </DebugSection>

      {/* Trend context */}
      <DebugSection title="Trend Context">
        <DebugRow label="trend" value={
          <span className={`font-mono text-[10px] ${trendColor(trend)}`}>{trend}</span> as any
        } />
        <DebugRow label="bullishConditionsMet" value={`${fullTrend.bullishConditionsMet}/5`} />
        <DebugRow label="bearishConditionsMet" value={`${fullTrend.bearishConditionsMet}/5`} />
        <DebugRow label="neutralConditionsMet" value={`${fullTrend.neutralConditionsMet}/4`} />
      </DebugSection>

      {/* Reconstructed score computation */}
      <DebugSection title="Score Computation (reconstructed from result)">
        <DebugRow label="bullishRawPoints (≈ bullishConf × 10)" value={bullPts.toFixed(2)} />
        <DebugRow label="bearishRawPoints (≈ bearishConf × 10)" value={bearPts.toFixed(2)} />
        <DebugRow label="neutralContribution (exact)" value={neutPts} />
        <DebugRow label="neutralStrengthFactor (default)" value={neutFactor} />
        <DebugRow dimmed label="directedPoints = dom + neutral × factor" value={directedPts.toFixed(4)} />
        <DebugRow dimmed label="contradictionPoints (opposing side)" value={contradictionPts.toFixed(4)} />
        <DebugRow dimmed label="penalizedPoints = max(0, dir - contra × 0.3)" value={penalizedPts.toFixed(4)} />
        <DebugRow dimmed label="prePenaltyScore = min(10, penalized / 10)" value={prePenaltyScore.toFixed(4)} />
        <DebugRow label="penaltyReduction (validation)" value={totalPenaltyReduction.toFixed(4)} />
        <DebugRow label="finalScore (displayed)" value={confidence.score.toFixed(4)} />
      </DebugSection>

      {/* Penalties */}
      {confidence.penalties.length > 0 && (
        <DebugSection title={`Penalties Applied (${confidence.penalties.length})`}>
          {confidence.penalties.map((p, i) => (
            <DebugRow key={i} label={p.source} value={`-${p.scoreReduction.toFixed(4)} — ${p.description}`} mono={false} />
          ))}
        </DebugSection>
      )}

      {/* Evidence reasons */}
      <DebugSection title={`Evidence Matched in factorWeights (${confidence.reasons.length} factors)`}>
        {confidence.reasons.length === 0 ? (
          <p className="text-[10px] text-red-400 py-1">
            NO FACTORS MATCHED — evidence array may be empty or factor names don't match config.factorWeights.
            This would produce score = 0.
          </p>
        ) : (
          confidence.reasons.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-0.5 border-b border-border-subtle/20 last:border-0">
              <span className={`text-[9px] ${directionColor(r.direction)} flex-shrink-0 w-14`}>{r.direction}</span>
              <span className="text-[9px] text-slate-400 flex-1 truncate">{r.factor}</span>
              <span className={`text-[9px] font-mono flex-shrink-0 ${r.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {r.points > 0 ? '+' : ''}{r.points}
              </span>
            </div>
          ))
        )}
      </DebugSection>

      {/* Trust */}
      <DebugSection title="Trust">
        <DebugRow label="trust.score" value={`${confidence.trust.score}%`} />
        <DebugRow label="trust.level" value={confidence.trust.level} />
        {confidence.trust.reductions.map((r, i) => (
          <DebugRow key={i} label={`reduction[${i}]`} value={r} mono={false} dimmed />
        ))}
      </DebugSection>

      {/* Analysis breakdown */}
      <DebugSection title="Confidence Breakdown (0–10 sub-scores)">
        <DebugRow label="trendQuality" value={confidence.breakdown.trendQuality} />
        <DebugRow label="momentum" value={confidence.breakdown.momentum} />
        <DebugRow label="volume" value={confidence.breakdown.volume} />
        <DebugRow label="marketStructure" value={confidence.breakdown.marketStructure} />
        <DebugRow label="srPositioning" value={confidence.breakdown.srPositioning} />
        <DebugRow label="contradictions" value={confidence.breakdown.contradictions} />
      </DebugSection>

      {/* Pipeline timings */}
      <DebugSection title="Pipeline Timings">
        <DebugRow label="total" value={formatMs(metadata.timings.total)} />
        <DebugRow label="confidence" value={formatMs(metadata.timings.confidence)} />
        <DebugRow label="analysis" value={formatMs(metadata.timings.analysis)} />
        <DebugRow label="version" value={metadata.version} />
        <DebugRow label="candleCount" value={metadata.candleCount} />
        <DebugRow label="symbol" value={metadata.symbol} />
        <DebugRow label="interval" value={metadata.interval} />
      </DebugSection>

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
