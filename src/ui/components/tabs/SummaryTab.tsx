import { TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle, Target, Zap } from 'lucide-react'
import { Card } from '../shared/Card'
import { ConfidenceMeter } from '../shared/ConfidenceMeter'
import { GradeBadge } from '../shared/Badge'
import { formatPrice } from '../../utils/format'
import { trendLabel, rsiLabel, vwapLabel, biasLabel, gradeLabel } from '../../utils/tradingLanguage'
import type { PipelineResult } from '../../types'

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

function KeyPoint({ icon, text, color = 'text-slate-300' }: {
  icon: React.ReactNode
  text: string
  color?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <p className={`text-xs leading-relaxed ${color}`}>{text}</p>
    </div>
  )
}

export function SummaryTab({ result }: SummaryTabProps) {
  const { analysis, confidence, supportResistance, validation, generatedAnalysis } = result
  const { fullTrend, volumeContext, indicatorSummary, emaContext } = analysis

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  const bias = biasLabel(fullTrend.trend, confidence.score)
  const hasRisks = validation.issues.filter(i => i.severity === 'warning' || i.severity === 'critical').length > 0

  return (
    <div className="p-4 space-y-4 animate-in max-w-3xl mx-auto">

      {/* Layer 1a: Bias + Confidence hero */}
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

      {/* Layer 1b: Plain-English summary from Writer */}
      {generatedAnalysis?.summary && (
        <Card className="p-4">
          <p className="section-label mb-2">What the Market Is Saying</p>
          <p className="text-sm text-slate-300 leading-relaxed">{generatedAnalysis.summary}</p>
          {generatedAnalysis.aiEnhanced && (
            <p className="text-[10px] text-blue-400/60 mt-2">Enhanced by AI</p>
          )}
        </Card>
      )}

      {/* Layer 1c: Key signals */}
      <Card className="p-4">
        <p className="section-label mb-3">Key Signals</p>
        <div className="space-y-3">
          <KeyPoint
            icon={<Zap size={13} className="text-violet-400" />}
            text={rsiLabel(indicatorSummary.rsi.classification, result.indicators.rsi)}
          />
          <KeyPoint
            icon={<TrendingUp size={13} className="text-blue-400" />}
            text={vwapLabel(volumeContext.priceAboveVWAP, volumeContext.vwapDistancePercent)}
          />
          {emaContext.emaAlignment === 'bullish_stack' && (
            <KeyPoint
              icon={<TrendingUp size={13} className="text-emerald-400" />}
              text="EMAs are stacked bullishly — trend structure supports upside"
              color="text-emerald-300"
            />
          )}
          {emaContext.emaAlignment === 'bearish_stack' && (
            <KeyPoint
              icon={<TrendingDown size={13} className="text-red-400" />}
              text="EMAs are stacked bearishly — trend structure supports downside"
              color="text-red-300"
            />
          )}
          {nearestSupport && (
            <KeyPoint
              icon={<Target size={13} className="text-emerald-400" />}
              text={`Nearest support at ${formatPrice(nearestSupport.center)}${
                analysis.srContext.nearestSupportDistance !== null
                  ? ` (${analysis.srContext.nearestSupportDistance.toFixed(1)}% away)`
                  : ''
              } — strength ${nearestSupport.strength.toFixed(1)}/10`}
              color="text-emerald-300"
            />
          )}
          {nearestResistance && (
            <KeyPoint
              icon={<Target size={13} className="text-red-400" />}
              text={`Nearest resistance at ${formatPrice(nearestResistance.center)}${
                analysis.srContext.nearestResistanceDistance !== null
                  ? ` (${analysis.srContext.nearestResistanceDistance.toFixed(1)}% away)`
                  : ''
              } — strength ${nearestResistance.strength.toFixed(1)}/10`}
              color="text-red-300"
            />
          )}
        </div>
      </Card>

      {/* Layer 1d: Risks */}
      {(hasRisks || generatedAnalysis?.riskSection) && (
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle size={12} className="text-amber-400" />
            <p className="section-label">Risks to Watch</p>
          </div>
          {generatedAnalysis?.riskSection ? (
            <p className="text-xs text-slate-400 leading-relaxed">{generatedAnalysis.riskSection}</p>
          ) : (
            <div className="space-y-1">
              {validation.issues.filter(i => i.severity !== 'info').slice(0, 4).map((issue, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`w-1 h-1 rounded-full flex-shrink-0 mt-1.5 ${
                    issue.severity === 'critical' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />
                  <p className="text-xs text-slate-400 leading-relaxed">{issue.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Layer 1e: Conclusion / strategy */}
      {generatedAnalysis?.conclusion && (
        <Card className="p-4 border-blue-500/20 bg-blue-600/5">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck size={12} className="text-blue-400" />
            <p className="section-label text-blue-400">Strategy Outlook</p>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{generatedAnalysis.conclusion}</p>
        </Card>
      )}

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
