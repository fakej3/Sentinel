import { Activity, RefreshCw, ArrowRight, Clock, BarChart2, TrendingUp, TrendingDown, Minus, Save, Check, ShieldCheck } from 'lucide-react'
import { ConfidenceMeter } from '../components/shared/ConfidenceMeter'
import { TrendBadge } from '../components/shared/Badge'
import { Card } from '../components/shared/Card'
import { SkeletonDashboard } from '../components/shared/Skeleton'
import { formatPrice, formatPercent, formatScore, formatTimeAgo } from '../utils/format'
import { changeColor, gradeColor } from '../utils/colors'
import { trendLabel } from '../utils/tradingLanguage'
import type { PipelineResult, RecentAnalysis, ConfidenceGrade, AppPage, HistoryMeta } from '../types'

interface DashboardPageProps {
  symbol: string
  interval: string
  loading: boolean
  error: string | null
  data: PipelineResult | null
  recentAnalyses: RecentAnalysis[]
  savedEntry: HistoryMeta | null
  saving: boolean
  onAnalyze: () => void
  onSave: () => void
  onSymbolSelect: (sym: string, interval?: string) => void
  onNavigate: (page: AppPage) => void
}

export function DashboardPage({
  symbol, interval, loading, error, data, recentAnalyses,
  savedEntry, saving, onAnalyze, onSave, onSymbolSelect, onNavigate,
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

  const { confidence, analysis, marketStructure, supportResistance, indicators, decision, tradePlan } = data
  const { fullTrend, price, volumeContext, indicatorSummary } = analysis
  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  return (
    <div className="p-4 space-y-4 pb-20 md:pb-4 animate-fade-in max-w-5xl mx-auto">

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

      {/* Trade Decision card */}
      {decision && (
        <Card className={`p-4 border ${
          decision.label.includes('Buy') ? 'border-emerald-500/20 bg-emerald-400/5'
            : decision.label.includes('Sell') ? 'border-red-500/20 bg-red-400/5'
            : 'border-border-subtle'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                decision.label.includes('Buy') ? 'bg-emerald-400/10'
                  : decision.label.includes('Sell') ? 'bg-red-400/10'
                  : 'bg-slate-600/20'
              }`}>
                {decision.label.includes('Buy')
                  ? <TrendingUp size={16} className="text-emerald-400" />
                  : decision.label.includes('Sell')
                    ? <TrendingDown size={16} className="text-red-400" />
                    : <Minus size={16} className="text-slate-400" />
                }
              </div>
              <div>
                <p className="section-label">Decision</p>
                <p className={`text-base font-bold leading-tight ${
                  decision.label.includes('Buy') ? 'text-emerald-400'
                    : decision.label.includes('Sell') ? 'text-red-400'
                    : 'text-slate-300'
                }`}>
                  {decision.label}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                decision.riskLevel === 'Low' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-500/20'
                  : decision.riskLevel === 'High' ? 'bg-red-400/10 text-red-400 border border-red-500/20'
                  : 'bg-amber-400/10 text-amber-400 border border-amber-500/20'
              }`}>
                {decision.riskLevel} Risk
              </span>
            </div>
          </div>
          {decision.reasons.length > 0 && (
            <ul className="mt-3 space-y-1">
              {decision.reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-slate-600 text-[10px] mt-0.5 flex-shrink-0">•</span>
                  <span className="text-xs text-slate-400 leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[9px] text-slate-600 mt-2">Not financial advice.</p>
        </Card>
      )}

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <MetricCard
          label="Trend"
          value={trendLabel(fullTrend.trend)}
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
          label="Setup"
          value={tradePlan.setupQuality.replace(/_/g, ' ')}
          sub={tradePlan.actionable
            ? `Actionable${tradePlan.riskRewardRatio !== null ? ` · ${tradePlan.riskRewardRatio.toFixed(1)}:1 RR` : ''}`
            : 'Not actionable'}
          valueClass={
            tradePlan.setupQuality === 'excellent' || tradePlan.setupQuality === 'good' ? 'text-emerald-400'
              : tradePlan.setupQuality === 'average' ? 'text-amber-400'
              : 'text-slate-500'
          }
          icon={<ShieldCheck size={12} className="text-slate-600" />}
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
            {recentAnalyses.slice(0, 3).map((r) => (
              <div
                key={`${r.symbol}-${r.interval}-${r.timestamp}`}
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
        <button
          onClick={onSave}
          disabled={saving || !!savedEntry}
          title={savedEntry ? 'Analysis saved' : 'Save this analysis'}
          className="h-9 px-3.5 flex items-center justify-center gap-1.5 text-xs font-medium
                     border rounded-lg transition-colors disabled:cursor-not-allowed
                     focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500
                     text-slate-400 hover:text-slate-200 border-border-subtle hover:border-slate-500
                     disabled:opacity-50"
        >
          {saving ? (
            <span aria-hidden="true" className="w-3.5 h-3.5 border border-slate-500 border-t-slate-300 rounded-full animate-spin" />
          ) : savedEntry ? (
            <Check size={13} className="text-emerald-400" />
          ) : (
            <Save size={13} />
          )}
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

function MetricCard({ label, value, sub, valueClass, icon }: {
  label: string; value: string; sub: string; valueClass: string; icon?: React.ReactNode
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <p className="section-label">{label}</p>
      </div>
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
      <h2 className="text-sm font-semibold text-slate-300 mb-1.5">Crypto Analysis</h2>
      {error ? (
        <p className="text-xs text-red-400 max-w-xs leading-relaxed mb-5">{error}</p>
      ) : (
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-5">
          Set a symbol in the header and click Analyze to run the full 11-stage pipeline.
        </p>
      )}
      <button
        onClick={onAnalyze}
        disabled={loading || !symbol.trim()}
        className="h-9 px-6 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg
                   transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {error ? `Retry ${symbol || '…'}` : `Analyze ${symbol || '…'}`}
      </button>

      {recentAnalyses.length > 0 && (
        <div className="mt-10 w-full max-w-xs">
          <p className="section-label mb-2 text-center">Recent</p>
          <div className="space-y-1">
            {recentAnalyses.slice(0, 3).map((r) => (
              <div
                key={`${r.symbol}-${r.interval}-${r.timestamp}`}
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
