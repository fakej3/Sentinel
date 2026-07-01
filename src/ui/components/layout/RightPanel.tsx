import {
  AlertTriangle, CheckCircle, Zap, Shield, Clock,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { ConfidenceMeter, MiniMeter } from '../shared/ConfidenceMeter'
import { TrendBadge } from '../shared/Badge'
import { formatMs } from '../../utils/format'
import { directionColor } from '../../utils/colors'
import type { PipelineResult } from '../../types'
import { clsx } from 'clsx'

interface RightPanelProps {
  result: PipelineResult
}

function DirectionIcon({ dir }: { dir: string }) {
  if (dir === 'bullish') return <TrendingUp size={12} className="text-emerald-400 flex-shrink-0" />
  if (dir === 'bearish') return <TrendingDown size={12} className="text-red-400 flex-shrink-0" />
  return <Minus size={12} className="text-slate-500 flex-shrink-0" />
}

export function RightPanel({ result }: RightPanelProps) {
  const { confidence, validation, analysis, metadata } = result
  const { fullTrend, volumeContext } = analysis
  const topReasons = confidence.reasons.slice(0, 5)
  const warnings = confidence.warnings.slice(0, 3)
  const criticalIssues = validation.issues.filter(i => i.severity === 'critical')

  const adx = result.indicators.adx
  const signalStrength = adx
    ? adx.adx >= 40 ? 'Extreme' : adx.adx >= 25 ? 'Strong' : adx.adx >= 20 ? 'Emerging' : 'Weak'
    : 'N/A'
  const signalColor = adx
    ? adx.adx >= 40 ? 'text-emerald-300' : adx.adx >= 25 ? 'text-emerald-400'
    : adx.adx >= 20 ? 'text-amber-400' : 'text-slate-400'
    : 'text-slate-500'

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-l border-border-subtle bg-surface-900 overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-4">

        {/* Confidence Meter */}
        <div className="card p-4 flex flex-col items-center">
          <ConfidenceMeter score={confidence.score} grade={confidence.grade} size={130} />
          <div className="mt-3 w-full space-y-2">
            <MiniMeter label="Bullish" score={confidence.bullishConfidence} />
            <MiniMeter label="Bearish" score={confidence.bearishConfidence} colorClass="bg-red-400" />
          </div>
        </div>

        {/* Status Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="card p-3">
            <p className="section-label mb-1.5">Trend</p>
            <TrendBadge trend={fullTrend.trend} />
          </div>
          <div className="card p-3">
            <p className="section-label mb-1.5">Signal</p>
            <p className={`text-xs font-semibold ${signalColor}`}>{signalStrength}</p>
            {adx && (
              <p className="text-[10px] text-slate-600 font-mono mt-0.5">ADX {adx.adx.toFixed(1)}</p>
            )}
          </div>
        </div>

        {/* Risk / Validation */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label flex items-center gap-1">
              <Shield size={9} />
              Risk
            </p>
            <span className={clsx(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded',
              validation.passed
                ? 'text-emerald-400 bg-emerald-400/10'
                : 'text-red-400 bg-red-400/10',
            )}>
              {validation.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Critical</span>
              <span className={criticalIssues.length > 0 ? 'text-red-400 font-mono' : 'text-slate-500 font-mono'}>
                {validation.criticalCount}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Warnings</span>
              <span className={validation.warningCount > 0 ? 'text-amber-400 font-mono' : 'text-slate-500 font-mono'}>
                {validation.warningCount}
              </span>
            </div>
          </div>
        </div>

        {/* Volume Summary */}
        <div className="card p-3">
          <p className="section-label mb-2">Volume</p>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-slate-500" />
            <span className="text-xs text-slate-300">
              {volumeContext.volumeClassification.replace(/_/g, ' ')}
            </span>
            {volumeContext.confirmsCurrentMove && (
              <CheckCircle size={11} className="text-emerald-400 ml-auto" />
            )}
          </div>
          <div className="h-1 bg-surface-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-700"
              style={{ width: `${(volumeContext.overallStrength / 10) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">
            Strength {volumeContext.overallStrength.toFixed(1)}/10
          </p>
        </div>

        {/* Key Reasons */}
        {topReasons.length > 0 && (
          <div className="card p-3">
            <p className="section-label mb-2">Key Reasons</p>
            <div className="space-y-1.5">
              {topReasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <DirectionIcon dir={r.direction} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-300 leading-tight truncate">{r.factor}</p>
                    <p className={`text-[10px] font-mono ${directionColor(r.direction)}`}>
                      {r.points > 0 ? '+' : ''}{r.points.toFixed(1)} pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="card border-amber-400/20 p-3">
            <p className="section-label mb-2 flex items-center gap-1">
              <AlertTriangle size={9} className="text-amber-400" />
              <span>Warnings</span>
            </p>
            <div className="space-y-1.5">
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-300/80 leading-snug">{w.message}</p>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="card p-3 space-y-1.5">
          <p className="section-label mb-2">Stats</p>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 flex items-center gap-1"><Clock size={9} />Exec time</span>
            <span className="font-mono text-slate-300">{formatMs(metadata.executionTime)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Evidence</span>
            <span className="font-mono text-slate-300">{analysis.evidence.length}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Bull / Bear</span>
            <span className="font-mono text-slate-300">
              {analysis.fullTrend.bullishConditionsMet} / {analysis.fullTrend.bearishConditionsMet}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Version</span>
            <span className="font-mono text-slate-400">{metadata.version}</span>
          </div>
        </div>

      </div>
    </aside>
  )
}
