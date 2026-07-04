import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle, Target, Zap, HelpCircle, Lightbulb, Activity, ChevronDown, ChevronUp, CheckCircle2, XCircle, Lock } from 'lucide-react'
import { Card } from '../shared/Card'
import { ConfidenceMeter } from '../shared/ConfidenceMeter'
import { GradeBadge } from '../shared/Badge'
import { formatPrice } from '../../utils/format'
import { trendLabel, rsiLabel, vwapLabel, biasLabel, gradeLabel } from '../../utils/tradingLanguage'
import type { PipelineResult, ConfidenceBreakdown, TrustResult } from '../../types'

interface SummaryTabProps {
  result: PipelineResult
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend.includes('bullish')) return <TrendingUp size={18} className="text-emerald-400" />
  if (trend.includes('bearish')) return <TrendingDown size={18} className="text-red-400" />
  return <Minus size={18} className="text-slate-400" />
}

function trendTextColor(trend: string) {
  if (trend.includes('bullish')) return 'text-emerald-400'
  if (trend.includes('bearish')) return 'text-red-400'
  return 'text-slate-400'
}

function decisionColor(label: string) {
  if (label === 'Strong Buy' || label === 'Buy') return 'text-emerald-400'
  if (label === 'Cautious Buy') return 'text-emerald-300'
  if (label === 'Strong Sell' || label === 'Sell') return 'text-red-400'
  if (label === 'Cautious Sell') return 'text-red-300'
  return 'text-slate-300'
}

function decisionBg(label: string) {
  if (label === 'Strong Buy' || label === 'Buy') return 'bg-emerald-400/10 border-emerald-500/20'
  if (label === 'Cautious Buy') return 'bg-emerald-400/5 border-emerald-500/15'
  if (label === 'Strong Sell' || label === 'Sell') return 'bg-red-400/10 border-red-500/20'
  if (label === 'Cautious Sell') return 'bg-red-400/5 border-red-500/15'
  return 'bg-slate-600/10 border-border-subtle'
}

function riskBadgeColor(level: string) {
  if (level === 'Low') return 'bg-emerald-400/10 text-emerald-400 border border-emerald-500/20'
  if (level === 'High') return 'bg-red-400/10 text-red-400 border border-red-500/20'
  return 'bg-amber-400/10 text-amber-400 border border-amber-500/20'
}

// ── Trust panel ──────────────────────────────────────────────────────────────

function TrustLevelBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  if (level === 'high')   return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-500/20">High Trust</span>
  if (level === 'medium') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-500/20">Medium Trust</span>
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 border border-red-500/20">Low Trust</span>
}

function TrustPanel({ trust }: { trust: TrustResult }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Lock size={12} className="text-slate-400" />
          <p className="section-label">Analysis Trust</p>
        </div>
        <TrustLevelBadge level={trust.level} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
        {trust.factors.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {f.passed
              ? <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
              : <XCircle      size={11} className="text-red-400 flex-shrink-0" />
            }
            <span className={`text-[11px] leading-tight ${f.passed ? 'text-slate-400' : 'text-red-300/80'}`}>
              {f.label}
            </span>
          </div>
        ))}
      </div>
      {trust.reductions.length > 0 && (
        <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
          {trust.reductions.join(' · ')}
        </p>
      )}
    </Card>
  )
}

// ── Confidence Breakdown panel ────────────────────────────────────────────────

const BREAKDOWN_LABELS: Record<keyof ConfidenceBreakdown, string> = {
  trendQuality:    'Trend / EMAs',
  marketStructure: 'Market Structure',
  momentum:        'Momentum (RSI/MACD)',
  volume:          'Volume / OBV',
  srPositioning:   'Support & Resistance',
  contradictions:  'Contradictions ↓',
}

function BreakdownBar({ label, value, isContradiction }: { label: string; value: number; isContradiction: boolean }) {
  const pct = Math.round((value / 10) * 100)
  const barColor = isContradiction ? 'bg-red-500/50' : 'bg-blue-500/60'
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] w-36 flex-shrink-0 ${isContradiction ? 'text-red-400/70' : 'text-slate-400'}`}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-800 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono w-8 text-right flex-shrink-0 ${isContradiction ? 'text-red-400/70' : 'text-slate-500'}`}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}

function BreakdownPanel({ breakdown, penalties }: { breakdown: ConfidenceBreakdown; penalties: PipelineResult['confidence']['penalties'] }) {
  const [open, setOpen] = useState(true)

  const reductionLines: string[] = penalties.map(p => p.description)

  return (
    <Card className="p-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full focus-visible:outline-none"
      >
        <p className="section-label">Confidence Breakdown</p>
        {open ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {(Object.keys(BREAKDOWN_LABELS) as Array<keyof ConfidenceBreakdown>).map(key => (
            <BreakdownBar
              key={key}
              label={BREAKDOWN_LABELS[key]}
              value={breakdown[key]}
              isContradiction={key === 'contradictions'}
            />
          ))}

          {reductionLines.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border-subtle space-y-1">
              <p className="text-[10px] text-slate-500 font-medium mb-1">Why not maximum confidence?</p>
              {reductionLines.map((line, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500/60 text-[10px] mt-0.5 flex-shrink-0">↓</span>
                  <span className="text-[10px] text-slate-500 leading-relaxed">{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Evidence bullet ───────────────────────────────────────────────────────────

function EvidenceBullet({ item }: { item: { description: string; direction: string; impact: string } }) {
  const color = item.direction === 'bullish' ? 'text-emerald-400'
    : item.direction === 'bearish' ? 'text-red-400'
    : 'text-slate-400'
  const dot = item.direction === 'bullish' ? 'bg-emerald-400'
    : item.direction === 'bearish' ? 'bg-red-400'
    : 'bg-slate-500'
  return (
    <div className="flex items-start gap-2">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
      <p className={`text-xs leading-relaxed ${color}`}>{item.description}</p>
    </div>
  )
}

export function SummaryTab({ result }: SummaryTabProps) {
  const { analysis, confidence, supportResistance, validation, generatedAnalysis, decision } = result
  const { fullTrend, volumeContext, indicatorSummary } = analysis

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  const bias = biasLabel(fullTrend.trend, confidence.score)

  // Top evidence bullets: pick the 5 most impactful items
  const topEvidence = analysis.evidence
    .filter(e => e.direction !== 'neutral' || e.impact === 'high')
    .slice(0, 5)

  // Invalidation scenarios: validation issues + opposing structure signals
  const invalidationPoints: string[] = []
  if (validation.issues.filter(i => i.severity === 'critical').length > 0) {
    invalidationPoints.push(`${validation.criticalCount} critical data quality issue${validation.criticalCount > 1 ? 's' : ''} flagged`)
  }
  if (fullTrend.trend.includes('bullish') && fullTrend.bearishConditionsMet >= 2) {
    invalidationPoints.push(`${fullTrend.bearishConditionsMet} bearish conditions still active — momentum could reverse`)
  }
  if (fullTrend.trend.includes('bearish') && fullTrend.bullishConditionsMet >= 2) {
    invalidationPoints.push(`${fullTrend.bullishConditionsMet} bullish conditions still active — watch for reversal`)
  }
  if (nearestResistance && fullTrend.trend.includes('bullish') && analysis.srContext.nearestResistanceDistance !== null && analysis.srContext.nearestResistanceDistance < 3) {
    invalidationPoints.push(`Resistance ${analysis.srContext.nearestResistanceDistance.toFixed(1)}% above — rejection here would invalidate bullish case`)
  }
  if (nearestSupport && fullTrend.trend.includes('bearish') && analysis.srContext.nearestSupportDistance !== null && Math.abs(analysis.srContext.nearestSupportDistance) < 3) {
    invalidationPoints.push(`Support ${Math.abs(analysis.srContext.nearestSupportDistance).toFixed(1)}% below — hold here would invalidate bearish case`)
  }
  validation.issues.filter(i => i.severity === 'warning').slice(0, 2).forEach(i => invalidationPoints.push(i.message))

  return (
    <div className="p-4 space-y-4 animate-in max-w-3xl mx-auto">

      {/* Q1: Overall Market View */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Card className="flex-1 p-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              fullTrend.trend.includes('bullish') ? 'bg-emerald-400/10'
                : fullTrend.trend.includes('bearish') ? 'bg-red-400/10'
                : 'bg-slate-600/30'
            }`}>
              <TrendIcon trend={fullTrend.trend} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1">Market Bias</p>
              <p className={`text-lg font-bold leading-tight ${trendTextColor(fullTrend.trend)}`}>
                {bias}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {trendLabel(fullTrend.trend)} · {fullTrend.bullishConditionsMet}/5 bull, {fullTrend.bearishConditionsMet}/5 bear
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 flex flex-col items-center text-center sm:w-44 flex-shrink-0">
          <p className="section-label mb-2">Signal Strength</p>
          <ConfidenceMeter score={confidence.score} grade={confidence.grade} size={80} />
          <div className="mt-2">
            <GradeBadge grade={confidence.grade} />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{gradeLabel(confidence.grade)}</p>
        </Card>
      </div>

      {/* Trust + Breakdown */}
      <TrustPanel trust={confidence.trust} />
      <BreakdownPanel breakdown={confidence.breakdown} penalties={confidence.penalties} />

      {/* Q4: Suggested Approach (decision card — most actionable, shown early) */}
      {decision && (
        <Card className={`p-4 border ${decisionBg(decision.label)}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={12} className="text-slate-400" />
                <p className="section-label">Suggested Approach</p>
              </div>
              <p className={`text-xl font-bold leading-tight ${decisionColor(decision.label)}`}>
                {decision.label}
              </p>
              {decision.reasons.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {decision.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-slate-600 text-[10px] mt-0.5 flex-shrink-0">•</span>
                      <span className="text-xs text-slate-400 leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${riskBadgeColor(decision.riskLevel)}`}>
                {decision.riskLevel} Risk
              </span>
            </div>
          </div>
          <p className="text-[9px] text-slate-600 mt-3">Not financial advice — conduct your own due diligence.</p>
        </Card>
      )}

      {/* Q2: Why? — top evidence */}
      {topEvidence.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Lightbulb size={12} className="text-yellow-400" />
            <p className="section-label">Why This View?</p>
          </div>
          <div className="space-y-2">
            {topEvidence.map((e, i) => <EvidenceBullet key={i} item={e} />)}
          </div>
        </Card>
      )}

      {/* Plain-English summary from Writer (when available) */}
      {generatedAnalysis?.summary && (
        <Card className="p-4">
          <p className="section-label mb-2">What the Market Is Saying</p>
          <p className="text-sm text-slate-300 leading-relaxed">{generatedAnalysis.summary}</p>
          {generatedAnalysis.aiEnhanced && (
            <p className="text-[10px] text-blue-400/60 mt-2">Enhanced by AI</p>
          )}
        </Card>
      )}

      {/* Key S/R levels */}
      {(nearestSupport || nearestResistance) && (
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Target size={12} className="text-slate-400" />
            <p className="section-label">Key Price Levels</p>
          </div>
          <div className="space-y-2">
            {nearestResistance && (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 bg-red-400" />
                <p className="text-xs text-red-300 leading-relaxed">
                  Resistance at {formatPrice(nearestResistance.center)}
                  {analysis.srContext.nearestResistanceDistance !== null
                    ? ` (${analysis.srContext.nearestResistanceDistance.toFixed(1)}% away)`
                    : ''}
                  {' '}— strength {nearestResistance.strength.toFixed(1)}/10
                </p>
              </div>
            )}
            {nearestSupport && (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 bg-emerald-400" />
                <p className="text-xs text-emerald-300 leading-relaxed">
                  Support at {formatPrice(nearestSupport.center)}
                  {analysis.srContext.nearestSupportDistance !== null
                    ? ` (${analysis.srContext.nearestSupportDistance.toFixed(1)}% away)`
                    : ''}
                  {' '}— strength {nearestSupport.strength.toFixed(1)}/10
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Q3: What would invalidate this view */}
      {invalidationPoints.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <HelpCircle size={12} className="text-amber-400" />
            <p className="section-label">What Would Change This View?</p>
          </div>
          <div className="space-y-1.5">
            {invalidationPoints.slice(0, 4).map((point, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5 bg-amber-400/60" />
                <p className="text-xs text-slate-400 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Conclusion from writer */}
      {generatedAnalysis?.conclusion && (
        <Card className="p-4 border-blue-500/20 bg-blue-600/5">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck size={12} className="text-blue-400" />
            <p className="section-label text-blue-400">Strategy Outlook</p>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{generatedAnalysis.conclusion}</p>
        </Card>
      )}

      {/* RSI / VWAP quick signals */}
      <Card className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Zap size={12} className="text-violet-400" />
          <p className="section-label">Momentum Signals</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 bg-violet-400" />
            <p className="text-xs text-slate-300 leading-relaxed">
              {rsiLabel(indicatorSummary.rsi.classification, result.indicators.rsi)}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${volumeContext.priceAboveVWAP ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <p className="text-xs text-slate-300 leading-relaxed">
              {vwapLabel(volumeContext.priceAboveVWAP, volumeContext.vwapDistancePercent)}
            </p>
          </div>
        </div>
      </Card>

      {/* Validation warning banner */}
      {!validation.passed && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-400/8 border border-amber-400/20">
          <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            Validation flagged {validation.criticalCount} critical and {validation.warningCount} warning issues.
            Treat this analysis with caution and check the Validation tab.
          </p>
        </div>
      )}

    </div>
  )
}
