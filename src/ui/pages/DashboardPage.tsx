import { Activity, RefreshCw, ArrowRight, Clock, BarChart2 } from 'lucide-react'
import { ConfidenceMeter } from '../components/shared/ConfidenceMeter'
import { TrendBadge } from '../components/shared/Badge'
import { Card } from '../components/shared/Card'
import { SkeletonDashboard } from '../components/shared/Skeleton'
import { formatPrice, formatPercent, formatScore, formatTimeAgo } from '../utils/format'
import { changeColor, gradeColor } from '../utils/colors'
import type { PipelineResult, RecentAnalysis, ConfidenceGrade, AppPage } from '../types'

interface DashboardPageProps {
  symbol: string
  interval: string
  loading: boolean
  error: string | null
  data: PipelineResult | null
  recentAnalyses: RecentAnalysis[]
  onAnalyze: () => void
  onSymbolSelect: (sym: string, interval?: string) => void
  onNavigate: (page: AppPage) => void
}

export function DashboardPage({
  symbol, interval, loading, error, data, recentAnalyses,
  onAnalyze, onSymbolSelect, onNavigate,
}: DashboardPageProps) {
  if (loading) return <SkeletonDashboard />

  if (!data) {
    return (
      <EmptyDashboard
        symbol={symbol}
        loading={loading}
        error={error}
        onAnalyze={onAnalyze}
        recentAnalyses={recentAnalyses}
        onSymbolSelect={onSymbolSelect}
      />
    )
  }

  const { confidence, analysis, marketStructure, validation, supportResistance, indicators } = data
  const { fullTrend, price, volumeContext, indicatorSummary } = analysis
  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  return (
    <div className="p-4 space-y-4 pb-20 lg:pb-4 animate-fade-in max-w-5xl mx-auto">

      {/* Hero: AI Confidence + Price */}
      <div className="flex flex-col sm:flex-row gap-3">

        <Card className="flex-1 p-5 flex flex-col items-center text-center">
          <p className="section-label mb-3">AI Confidence</p>
          <ConfidenceMeter score={confidence.score} grade={confidence.grade} size={140} />
          <div className="mt-3">
            <TrendBadge trend={fullTrend.trend} />
          </div>
        </Card>

        <Card className="flex-1 p-5 flex flex-col justify-between">
          <div>
            <p className="section-label mb-1">Price</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-100">
                {formatPrice(price.current)}
              </span>
              <span className={`text-sm font-mono font-semibold ${changeColor(price.change24hPercent)}`}>
                {formatPercent(price.change24hPercent)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">{symbol} · {interval}</p>
          </div>

          <div className="mt-4 space-y-2">
            <MetaRow label="24h High" value={formatPrice(price.high24h)} />
            <MetaRow label="24h Low"  value={formatPrice(price.low24h)} />
            {nearestSupport    && <MetaRow label="Support"    value={formatPrice(nearestSupport.center)}    valueClass="text-emerald-400" />}
            {nearestResistance && <MetaRow label="Resistance" value={formatPrice(nearestResistance.center)} valueClass="text-red-400" />}
          </div>

          <button
            onClick={() => onNavigate('analysis')}
            className="mt-4 w-full h-8 flex items-center justify-center gap-1.5 text-xs font-medium
                       text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50
                       rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            View Full Analysis
            <ArrowRight size={12} />
          </button>
        </Card>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <MetricCard
          label="Trend"
          value={fullTrend.trend.replace(/_/g, ' ')}
          sub={`${fullTrend.bullishConditionsMet}/5 bull · ${fullTrend.bearishConditionsMet}/5 bear`}
          valueClass={
            fullTrend.trend.includes('bullish') ? 'text-emerald-400'
              : fullTrend.trend.includes('bearish') ? 'text-red-400'
              : 'text-slate-400'
          }
        />
        <MetricCard
          label="Momentum"
          value={indicators.rsi !== null ? `RSI ${indicators.rsi.toFixed(1)}` : 'RSI N/A'}
          sub={indicatorSummary.rsi.classification.replace(/_/g, ' ')}
          valueClass={
            indicators.rsi !== null
              ? indicators.rsi > 70 ? 'text-red-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-300'
              : 'text-slate-500'
          }
        />
        <MetricCard
          label="Volume"
          value={volumeContext.volumeClassification.replace(/_/g, ' ')}
          sub={`${volumeContext.relativeVolume.toFixed(2)}× avg`}
          valueClass="text-blue-400"
        />
        <MetricCard
          label="Structure"
          value={marketStructure.trend}
          sub={marketStructure.strength}
          valueClass="text-slate-300"
        />
        <MetricCard
          label="Validation"
          value={validation.passed ? 'Passed' : 'Failed'}
          sub={`${validation.criticalCount} critical · ${validation.warningCount} warnings`}
          valueClass={validation.passed ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricCard
          label="VWAP"
          value={volumeContext.priceAboveVWAP ? 'Above' : 'Below'}
          sub={`${volumeContext.vwapDistancePercent.toFixed(2)}% distance`}
          valueClass={volumeContext.priceAboveVWAP ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* Recent analyses */}
      {recentAnalyses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-label flex items-center gap-1">
              <Clock size={9} className="text-slate-600" />
              Recent
            </p>
            <button
              onClick={() => onNavigate('history')}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-0.5
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
            >
              View all <ArrowRight size={9} />
            </button>
          </div>
          <div className="space-y-1">
            {recentAnalyses.slice(0, 3).map((r, i) => (
              <div
                key={i}
                onClick={() => { onSymbolSelect(r.symbol, r.interval); onNavigate('analysis') }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSymbolSelect(r.symbol, r.interval); onNavigate('analysis') } }}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                           border border-border-subtle bg-surface-800 hover:bg-surface-700 group
                           transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-medium font-mono text-slate-300 group-hover:text-slate-100 transition-colors">
                    {r.symbol}
                  </span>
                  <span className="text-[10px] text-slate-600">{r.interval}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-semibold ${gradeColor(r.grade as ConfidenceGrade)}`}>
                    {formatScore(r.score)}
                  </span>
                  <span className="text-[10px] text-slate-600 hidden sm:block">{formatTimeAgo(r.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="flex-1 h-9 flex items-center justify-center gap-2 text-xs font-semibold
                     bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed active:scale-95
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw size={13} />
          Re-analyze {symbol}
        </button>
        <button
          onClick={() => onNavigate('chart')}
          className="h-9 px-4 flex items-center justify-center gap-1.5 text-xs font-medium
                     text-slate-400 hover:text-slate-200 border border-border-subtle
                     rounded-lg transition-colors
                     focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        >
          <BarChart2 size={13} />
          Chart
        </button>
      </div>

    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function MetaRow({ label, value, valueClass = 'text-slate-300' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono tabular-nums ${valueClass}`}>{value}</span>
    </div>
  )
}

function MetricCard({ label, value, sub, valueClass }: {
  label: string; value: string; sub: string; valueClass: string
}) {
  return (
    <Card className="p-3">
      <p className="section-label mb-1">{label}</p>
      <p className={`text-sm font-semibold capitalize leading-tight ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 capitalize leading-snug">{sub}</p>
    </Card>
  )
}

function EmptyDashboard({ symbol, loading, error, onAnalyze, recentAnalyses, onSymbolSelect }: {
  symbol: string
  loading: boolean
  error: string | null
  onAnalyze: () => void
  recentAnalyses: RecentAnalysis[]
  onSymbolSelect: (sym: string, interval?: string) => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 py-16 text-center animate-fade-in select-none">
      <div className="mb-4 w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
        <Activity size={28} className="text-blue-400" />
      </div>
      <h2 className="text-sm font-semibold text-slate-300 mb-1.5">AI-First Crypto Analysis</h2>
      {error ? (
        <p className="text-xs text-red-400 max-w-xs leading-relaxed mb-5">{error}</p>
      ) : (
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-5">
          Set a symbol in the header and click Analyze to get AI-powered market insights.
        </p>
      )}
      <button
        onClick={onAnalyze}
        disabled={loading || !symbol.trim()}
        className="h-9 px-6 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg
                   transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Analyze {symbol || '…'}
      </button>

      {recentAnalyses.length > 0 && (
        <div className="mt-10 w-full max-w-xs">
          <p className="section-label mb-2 text-center">Recent</p>
          <div className="space-y-1">
            {recentAnalyses.slice(0, 3).map((r, i) => (
              <div
                key={i}
                onClick={() => onSymbolSelect(r.symbol, r.interval)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSymbolSelect(r.symbol, r.interval) } }}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer
                           border border-border-subtle bg-surface-800 hover:bg-surface-700 group transition-colors
                           focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium font-mono text-slate-300 group-hover:text-slate-100 transition-colors">
                    {r.symbol}
                  </span>
                  <span className="text-[10px] text-slate-600">{r.interval}</span>
                </div>
                <span className={`text-xs font-mono font-semibold ${gradeColor(r.grade as ConfidenceGrade)}`}>
                  {formatScore(r.score)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
