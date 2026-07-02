import {
  TrendingUp, TrendingDown, Target, BarChart2,
  Activity, Zap, ShieldCheck, Layers, AlignCenter,
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

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  return (
    <div className="p-3 space-y-3 animate-in overflow-y-auto h-full scrollbar-none">

      {/* Primary cards — auto-fill responsive grid */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>

        {/* Trend */}
        <Card hover className="p-3.5 transition-shadow duration-150 hover:shadow-card-hover">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              {fullTrend.trend.includes('bullish')
                ? <TrendingUp size={13} className="text-emerald-400" />
                : fullTrend.trend.includes('bearish')
                  ? <TrendingDown size={13} className="text-red-400" />
                  : <Activity size={13} className="text-slate-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Trend</p>
              <TrendBadge trend={fullTrend.trend} />
              <div className="flex gap-2.5 mt-2">
                <div>
                  <p className="text-[9px] text-slate-600 mb-0.5">Bull</p>
                  <p className="text-xs font-mono text-emerald-400">{fullTrend.bullishConditionsMet}/5</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600 mb-0.5">Bear</p>
                  <p className="text-xs font-mono text-red-400">{fullTrend.bearishConditionsMet}/5</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600 mb-0.5">Neut</p>
                  <p className="text-xs font-mono text-slate-400">{fullTrend.neutralConditionsMet}/4</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Confidence */}
        <Card hover className="p-3.5 transition-shadow duration-150 hover:shadow-card-hover">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck size={13} className={scoreColor(confidence.score)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Confidence</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold font-mono tabular-nums ${scoreColor(confidence.score)}`}>
                  {formatScore(confidence.score)}
                </span>
                <span className="text-[10px] text-slate-600">/10</span>
              </div>
              <div className="mt-1">
                <GradeBadge grade={confidence.grade} />
              </div>
              <ProgressBar
                value={confidence.score}
                max={10}
                height="h-0.5"
                className="mt-2"
                colorClass={confidence.score >= 7 ? 'bg-emerald-400' : confidence.score >= 5 ? 'bg-blue-400' : 'bg-amber-400'}
              />
            </div>
          </div>
        </Card>

        {/* Momentum */}
        <Card hover className="p-3.5 transition-shadow duration-150 hover:shadow-card-hover">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap size={13} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Momentum</p>
              <div className="flex items-center gap-3">
                {indicators.rsi !== null && (
                  <div>
                    <p className="text-[9px] text-slate-600 mb-0.5">RSI</p>
                    <p className={`text-sm font-mono font-bold tabular-nums ${
                      indicators.rsi > 70 ? 'text-red-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-200'
                    }`}>
                      {indicators.rsi.toFixed(1)}
                    </p>
                  </div>
                )}
                {indicators.macd && (
                  <div>
                    <p className="text-[9px] text-slate-600 mb-0.5">MACD</p>
                    <p className={`text-xs font-medium ${
                      indicatorSummary.macd.bias === 'bullish' ? 'text-emerald-400'
                        : indicatorSummary.macd.bias === 'bearish' ? 'text-red-400'
                        : 'text-slate-400'
                    }`}>
                      {indicatorSummary.macd.bias}
                    </p>
                  </div>
                )}
              </div>
              <p className={`text-[10px] mt-1.5 font-medium ${
                indicatorSummary.rsi.classification === 'overbought' ? 'text-red-400'
                  : indicatorSummary.rsi.classification === 'oversold' ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}>
                {indicatorSummary.rsi.classification.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </Card>

        {/* Volume */}
        <Card hover className="p-3.5 transition-shadow duration-150 hover:shadow-card-hover">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <BarChart2 size={13} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Volume</p>
              <p className="text-sm font-semibold text-slate-200 capitalize leading-tight">
                {volumeContext.volumeClassification.replace(/_/g, ' ')}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {volumeContext.relativeVolume.toFixed(2)}× avg · {volumeContext.accDistState}
              </p>
              <ProgressBar
                value={volumeContext.overallStrength}
                max={10}
                height="h-0.5"
                colorClass="bg-blue-400"
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        {/* Support */}
        <Card hover className="p-3.5 transition-shadow duration-150 hover:shadow-card-hover">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Target size={13} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Support</p>
              {nearestSupport ? (
                <>
                  <p className="text-sm font-bold font-mono tabular-nums text-slate-100">
                    {formatPrice(nearestSupport.center)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {analysis.srContext.nearestSupportDistance !== null
                      ? `${analysis.srContext.nearestSupportDistance.toFixed(2)}% away`
                      : nearestSupport.state}
                  </p>
                  <ProgressBar value={nearestSupport.strength} max={10} height="h-0.5" colorClass="bg-emerald-400" className="mt-2" />
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-1">None detected</p>
              )}
            </div>
          </div>
        </Card>

        {/* Resistance */}
        <Card hover className="p-3.5 transition-shadow duration-150 hover:shadow-card-hover">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Layers size={13} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-label mb-1.5">Resistance</p>
              {nearestResistance ? (
                <>
                  <p className="text-sm font-bold font-mono tabular-nums text-slate-100">
                    {formatPrice(nearestResistance.center)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {analysis.srContext.nearestResistanceDistance !== null
                      ? `${analysis.srContext.nearestResistanceDistance.toFixed(2)}% away`
                      : nearestResistance.state}
                  </p>
                  <ProgressBar value={nearestResistance.strength} max={10} height="h-0.5" colorClass="bg-red-400" className="mt-2" />
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-1">None detected</p>
              )}
            </div>
          </div>
        </Card>

      </div>

      {/* Secondary row — EMA stack + market snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">

        {/* EMA Stack */}
        <Card className="p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <AlignCenter size={12} className="text-slate-500" />
            <p className="section-label">EMA Stack</p>
          </div>
          <div className="space-y-2">
            {([
              ['EMA 20',  indicators.ema20,  analysis.emaContext.priceVsEMA20],
              ['EMA 50',  indicators.ema50,  analysis.emaContext.priceVsEMA50],
              ['EMA 100', indicators.ema100, analysis.emaContext.priceVsEMA100],
              ['EMA 200', indicators.ema200, analysis.emaContext.priceVsEMA200],
            ] as const).map(([label, val, rel]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{label}</span>
                <div className="flex items-center gap-2">
                  {val !== null && (
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">{formatPrice(val)}</span>
                  )}
                  <span className={`text-[10px] font-medium px-1 py-px rounded ${
                    rel === 'above' ? 'bg-emerald-400/10 text-emerald-400'
                      : rel === 'below' ? 'bg-red-400/10 text-red-400'
                      : 'bg-surface-600 text-slate-500'
                  }`}>
                    {val === null ? '—' : rel}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Alignment</span>
              <span className={`text-[11px] font-medium ${
                analysis.emaContext.emaAlignment === 'bullish_stack' ? 'text-emerald-400'
                  : analysis.emaContext.emaAlignment === 'bearish_stack' ? 'text-red-400'
                  : 'text-slate-400'
              }`}>
                {analysis.emaContext.emaAlignment.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </Card>

        {/* Market snapshot */}
        <Card className="p-3.5">
          <p className="section-label mb-2.5">Market Snapshot</p>
          <div className="space-y-2">
            <Row label="24h Change">
              <span className={`text-[11px] font-mono font-semibold tabular-nums ${changeColor(price.change24hPercent)}`}>
                {formatPercent(price.change24hPercent)}
              </span>
            </Row>
            <Row label="24h Range">
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {formatPrice(price.low24h)} – {formatPrice(price.high24h)}
              </span>
            </Row>
            <Row label="Structure">
              <span className={`text-[11px] font-medium ${trendColor(marketStructure.trend)}`}>
                {marketStructure.trend} · {marketStructure.strength}
              </span>
            </Row>
            <Row label="VWAP">
              <span className={`text-[11px] font-mono ${volumeContext.priceAboveVWAP ? 'text-emerald-400' : 'text-red-400'}`}>
                {volumeContext.priceAboveVWAP ? 'Above' : 'Below'}{' '}
                <span className="text-slate-500">({volumeContext.vwapDistancePercent.toFixed(2)}%)</span>
              </span>
            </Row>
            <Row label="Validation">
              <span className={`text-[11px] font-semibold ${validation.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                {validation.passed ? '✓ Passed' : `✗ ${validation.criticalCount} critical`}
              </span>
            </Row>
            {indicators.atr !== null && (
              <Row label="ATR">
                <span className="text-[11px] font-mono text-slate-300 tabular-nums">{formatPrice(indicators.atr)}</span>
              </Row>
            )}
          </div>
        </Card>

      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      {children}
    </div>
  )
}
