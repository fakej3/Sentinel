import {
  TrendingUp, TrendingDown, Target, BarChart2,
  Activity, Zap, ShieldCheck, Layers,
} from 'lucide-react'
import { Card } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'
import { TrendBadge, GradeBadge } from '../shared/Badge'
import { formatPrice, formatPercent, formatScore } from '../../utils/format'
import { trendColor, changeColor, scoreColor } from '../../utils/colors'
import type { PipelineResult } from '../../types'

interface OverviewTabProps {
  result: PipelineResult
}

export function OverviewTab({ result }: OverviewTabProps) {
  const { analysis, confidence, indicators, marketStructure, supportResistance, validation } = result
  const { price, fullTrend, volumeContext, indicatorSummary } = analysis

  const nearestSupport = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  return (
    <div className="p-4 space-y-4 animate-in">
      {/* Primary cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">

        {/* Trend */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0">
              {fullTrend.trend.includes('bullish')
                ? <TrendingUp size={15} className="text-emerald-400" />
                : fullTrend.trend.includes('bearish')
                  ? <TrendingDown size={15} className="text-red-400" />
                  : <Activity size={15} className="text-slate-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Trend</p>
              <TrendBadge trend={fullTrend.trend} />
              <div className="flex gap-2 mt-2">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">Bull</p>
                  <p className="text-xs font-mono text-emerald-400">{fullTrend.bullishConditionsMet}/5</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">Bear</p>
                  <p className="text-xs font-mono text-red-400">{fullTrend.bearishConditionsMet}/5</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">Neut</p>
                  <p className="text-xs font-mono text-slate-400">{fullTrend.neutralConditionsMet}/4</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Confidence */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={15} className={scoreColor(confidence.score)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Confidence</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xl font-bold font-mono ${scoreColor(confidence.score)}`}>
                  {formatScore(confidence.score)}
                </span>
                <span className="text-xs text-slate-500">/10</span>
              </div>
              <div className="mt-1.5">
                <GradeBadge grade={confidence.grade} />
              </div>
              <ProgressBar
                value={confidence.score}
                max={10}
                height="h-1"
                className="mt-2"
                colorClass={confidence.score >= 7 ? 'bg-emerald-400' : confidence.score >= 5 ? 'bg-blue-400' : 'bg-amber-400'}
              />
            </div>
          </div>
        </Card>

        {/* Support */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0">
              <Target size={15} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Support</p>
              {nearestSupport ? (
                <>
                  <p className="text-base font-bold font-mono text-slate-100">
                    {formatPrice(nearestSupport.center)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {analysis.srContext.nearestSupportDistance !== null
                      ? `${analysis.srContext.nearestSupportDistance.toFixed(2)}% away`
                      : nearestSupport.state}
                  </p>
                  <ProgressBar
                    value={nearestSupport.strength}
                    max={10}
                    height="h-1"
                    colorClass="bg-emerald-400"
                    className="mt-2"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">None detected</p>
              )}
            </div>
          </div>
        </Card>

        {/* Resistance */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0">
              <Layers size={15} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Resistance</p>
              {nearestResistance ? (
                <>
                  <p className="text-base font-bold font-mono text-slate-100">
                    {formatPrice(nearestResistance.center)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {analysis.srContext.nearestResistanceDistance !== null
                      ? `${analysis.srContext.nearestResistanceDistance.toFixed(2)}% away`
                      : nearestResistance.state}
                  </p>
                  <ProgressBar
                    value={nearestResistance.strength}
                    max={10}
                    height="h-1"
                    colorClass="bg-red-400"
                    className="mt-2"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">None detected</p>
              )}
            </div>
          </div>
        </Card>

        {/* Volume */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0">
              <BarChart2 size={15} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Volume</p>
              <p className="text-sm font-semibold text-slate-200 capitalize">
                {volumeContext.volumeClassification.replace(/_/g, ' ')}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {volumeContext.relativeVolume.toFixed(2)}× avg ·{' '}
                {volumeContext.accDistState}
              </p>
              <ProgressBar
                value={volumeContext.overallStrength}
                max={10}
                height="h-1"
                colorClass="bg-blue-400"
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        {/* Momentum */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0">
              <Zap size={15} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Momentum</p>
              <div className="flex items-center gap-3">
                {indicators.rsi !== null && (
                  <div>
                    <p className="text-[10px] text-slate-500">RSI</p>
                    <p className={`text-sm font-mono font-semibold ${
                      indicators.rsi > 70 ? 'text-red-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-200'
                    }`}>
                      {indicators.rsi.toFixed(1)}
                    </p>
                  </div>
                )}
                {indicators.macd && (
                  <div>
                    <p className="text-[10px] text-slate-500">MACD</p>
                    <p className={`text-sm font-mono font-semibold ${
                      indicatorSummary.macd.bias === 'bullish' ? 'text-emerald-400'
                        : indicatorSummary.macd.bias === 'bearish' ? 'text-red-400'
                        : 'text-slate-400'
                    }`}>
                      {indicatorSummary.macd.bias}
                    </p>
                  </div>
                )}
              </div>
              <p className={`text-[11px] mt-1.5 font-medium ${
                indicatorSummary.rsi.classification === 'overbought' ? 'text-red-400'
                  : indicatorSummary.rsi.classification === 'oversold' ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}>
                RSI: {indicatorSummary.rsi.classification.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </Card>

      </div>

      {/* Market conditions summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="section-label mb-3">EMA Stack</p>
          <div className="space-y-2">
            {([
              ['EMA 20', indicators.ema20, analysis.emaContext.priceVsEMA20],
              ['EMA 50', indicators.ema50, analysis.emaContext.priceVsEMA50],
              ['EMA 100', indicators.ema100, analysis.emaContext.priceVsEMA100],
              ['EMA 200', indicators.ema200, analysis.emaContext.priceVsEMA200],
            ] as const).map(([label, val, rel]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{label}</span>
                <div className="flex items-center gap-2">
                  {val !== null && (
                    <span className="text-xs font-mono text-slate-400">{formatPrice(val)}</span>
                  )}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    rel === 'above' ? 'bg-emerald-400/10 text-emerald-400'
                      : rel === 'below' ? 'bg-red-400/10 text-red-400'
                      : 'bg-surface-600 text-slate-500'
                  }`}>
                    {val === null ? 'N/A' : rel}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <p className="text-xs text-slate-400">
              Alignment: <span className={`font-medium ${
                analysis.emaContext.emaAlignment === 'bullish_stack' ? 'text-emerald-400'
                  : analysis.emaContext.emaAlignment === 'bearish_stack' ? 'text-red-400'
                  : 'text-slate-400'
              }`}>
                {analysis.emaContext.emaAlignment.replace(/_/g, ' ')}
              </span>
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <p className="section-label mb-3">Market Snapshot</p>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">24h Change</span>
              <span className={`text-xs font-mono font-semibold ${changeColor(price.change24hPercent)}`}>
                {formatPercent(price.change24hPercent)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Structure</span>
              <span className={`text-xs font-medium ${trendColor(marketStructure.trend)}`}>
                {marketStructure.trend} · {marketStructure.strength}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">VWAP</span>
              <span className={`text-xs font-mono ${
                volumeContext.priceAboveVWAP ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {volumeContext.priceAboveVWAP ? 'Above' : 'Below'} ({volumeContext.vwapDistancePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Validation</span>
              <span className={`text-xs font-semibold ${validation.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                {validation.passed ? '✓ Passed' : `✗ ${validation.criticalCount} critical`}
              </span>
            </div>
            {indicators.atr !== null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">ATR</span>
                <span className="text-xs font-mono text-slate-300">{formatPrice(indicators.atr)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
