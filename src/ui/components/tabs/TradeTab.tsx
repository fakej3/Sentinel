import { TrendingDown, TrendingUp, Activity, Target, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'
import { formatPrice, formatPercent } from '../../utils/format'
import { changeColor } from '../../utils/colors'
import type { PipelineResult } from '../../types'

interface TradeTabProps {
  result: PipelineResult
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  )
}

function ZoneBlock({ label, zone, color, distPct }: {
  label: string
  zone: { center: number; upper: number; lower: number; strength: number } | null
  color: string
  distPct: number | null
}) {
  if (!zone) {
    return (
      <div className={`p-3 rounded-lg border border-border-subtle bg-surface-800`}>
        <p className="text-[10px] text-slate-600 mb-1">{label}</p>
        <p className="text-xs text-slate-500">None detected</p>
      </div>
    )
  }
  return (
    <div className={`p-3 rounded-lg border ${color}`}>
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-bold font-mono text-slate-100">{formatPrice(zone.center)}</p>
      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
        {formatPrice(zone.lower)} – {formatPrice(zone.upper)}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-slate-600">
          {distPct !== null ? `${Math.abs(distPct).toFixed(1)}% away` : 'Zone'}
        </span>
        <span className="text-[10px] text-slate-500">
          Strength {zone.strength.toFixed(1)}/10
        </span>
      </div>
      <ProgressBar
        value={zone.strength}
        max={10}
        height="h-0.5"
        colorClass={label === 'Support' ? 'bg-emerald-400' : 'bg-red-400'}
        className="mt-1.5"
      />
    </div>
  )
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

export function TradeTab({ result }: TradeTabProps) {
  const { analysis, supportResistance, indicators, marketStructure, confidence, decision, tradePlan } = result
  const { price, volumeContext, srContext } = analysis

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  // Risk/reward estimate: distance to resistance vs distance to support
  const distToRes = srContext.nearestResistanceDistance !== null ? Math.abs(srContext.nearestResistanceDistance) : null
  const distToSup = srContext.nearestSupportDistance    !== null ? Math.abs(srContext.nearestSupportDistance) : null
  const rrRatio   = (distToRes !== null && distToSup !== null && distToSup > 0)
    ? distToRes / distToSup
    : null

  return (
    <div className="p-4 space-y-4 animate-in max-w-3xl mx-auto">

      {/* Sentinel's signal view */}
      <Card className={`p-4 border ${decisionBg(decision.label)}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={12} className="text-slate-400" />
              <p className="section-label">Sentinel's View</p>
            </div>
            <p className={`text-2xl font-bold leading-tight ${decisionColor(decision.label)}`}>
              {decision.label}
            </p>
            {decision.reasons.length > 0 && (
              <ul className="mt-2 space-y-1">
                {decision.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={10} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-400 leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${riskBadgeColor(decision.riskLevel)}`}>
            {decision.riskLevel} Risk
          </span>
        </div>
      </Card>

      {/* Trade plan */}
      {(tradePlan.entryZone || tradePlan.invalidationLevel || tradePlan.targetLevel) && (
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Target size={12} className="text-slate-400" />
            <p className="section-label">Trade Plan</p>
          </div>
          <div className="space-y-0">
            {tradePlan.entryZone && (
              <DataRow label="Entry zone">
                <span className="text-xs font-mono text-slate-300">
                  {formatPrice(tradePlan.entryZone.lower)} – {formatPrice(tradePlan.entryZone.upper)}
                </span>
              </DataRow>
            )}
            {tradePlan.invalidationLevel !== null && (
              <DataRow label="Invalidation">
                <span className="text-xs font-mono text-red-400">{formatPrice(tradePlan.invalidationLevel)}</span>
              </DataRow>
            )}
            {tradePlan.targetLevel !== null && (
              <DataRow label="Target">
                <span className="text-xs font-mono text-emerald-400">{formatPrice(tradePlan.targetLevel)}</span>
              </DataRow>
            )}
            {tradePlan.riskRewardRatio !== null && (
              <DataRow label="Risk / Reward">
                <span className={`text-xs font-mono font-semibold ${tradePlan.riskRewardRatio >= 2 ? 'text-emerald-400' : tradePlan.riskRewardRatio >= 1 ? 'text-slate-300' : 'text-red-400'}`}>
                  {tradePlan.riskRewardRatio.toFixed(2)} : 1
                </span>
              </DataRow>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-start gap-1.5">
            <AlertTriangle size={10} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-relaxed">{tradePlan.patienceMessage}</p>
          </div>
        </Card>
      )}

      {/* Price snapshot */}
      <Card className="p-4">
        <p className="section-label mb-3">Current Price</p>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold font-mono tabular-nums text-slate-100">
            {formatPrice(price.current)}
          </span>
          <span className={`text-sm font-mono font-semibold ${changeColor(price.change24hPercent)}`}>
            {formatPercent(price.change24hPercent)} (24h)
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 mt-3">
          <DataRow label="24h High">
            <span className="text-xs font-mono text-slate-300">{formatPrice(price.high24h)}</span>
          </DataRow>
          <DataRow label="24h Low">
            <span className="text-xs font-mono text-slate-300">{formatPrice(price.low24h)}</span>
          </DataRow>
          {indicators.atr !== null && (
            <DataRow label="ATR (volatility)">
              <span className="text-xs font-mono text-slate-300">{formatPrice(indicators.atr)}</span>
            </DataRow>
          )}
          <DataRow label="VWAP">
            <span className={`text-xs font-mono ${volumeContext.priceAboveVWAP ? 'text-emerald-400' : 'text-red-400'}`}>
              {volumeContext.priceAboveVWAP ? '▲ Above' : '▼ Below'}
              <span className="text-slate-600 ml-1">({volumeContext.vwapDistancePercent.toFixed(2)}%)</span>
            </span>
          </DataRow>
        </div>
      </Card>

      {/* Key levels */}
      <div>
        <p className="section-label mb-2">Key Price Levels</p>
        <div className="grid grid-cols-2 gap-2.5">
          <ZoneBlock
            label="Support"
            zone={nearestSupport}
            color="border-emerald-500/20 bg-emerald-400/5"
            distPct={srContext.nearestSupportDistance}
          />
          <ZoneBlock
            label="Resistance"
            zone={nearestResistance}
            color="border-red-500/20 bg-red-400/5"
            distPct={srContext.nearestResistanceDistance}
          />
        </div>
      </div>

      {/* Risk/Reward */}
      {rrRatio !== null && (
        <Card className="p-4">
          <p className="section-label mb-3">Risk / Reward Context</p>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-600 mb-0.5">To resistance</p>
              <p className="text-sm font-mono font-semibold text-red-400">+{distToRes!.toFixed(2)}%</p>
            </div>
            <div className="flex-1 flex items-center gap-1.5">
              <div className="h-1.5 rounded-full bg-emerald-400/30 flex-1" style={{ flex: distToSup! }}>
                <div className="h-full rounded-full bg-emerald-400" />
              </div>
              <span className="text-[10px] text-slate-600">price</span>
              <div className="h-1.5 rounded-full bg-red-400/30 flex-1" style={{ flex: distToRes! }}>
                <div className="h-full rounded-full bg-red-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-600 mb-0.5">To support</p>
              <p className="text-sm font-mono font-semibold text-emerald-400">-{distToSup!.toFixed(2)}%</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">R/R ratio (up:down)</span>
            <span className={`text-sm font-semibold font-mono ${rrRatio >= 1.5 ? 'text-emerald-400' : rrRatio >= 1 ? 'text-slate-300' : 'text-red-400'}`}>
              {rrRatio.toFixed(2)} : 1
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            {rrRatio >= 2 ? 'Favorable risk/reward — more upside room than downside risk'
              : rrRatio >= 1.5 ? 'Decent risk/reward setup'
              : rrRatio >= 1 ? 'Neutral risk/reward — similar up and down distance'
              : 'Unfavorable risk/reward — more downside risk than upside room'}
          </p>
        </Card>
      )}

      {/* Market structure summary */}
      <Card className="p-4">
        <p className="section-label mb-3">Market Structure</p>
        <div className="space-y-0">
          <DataRow label="Structure">
            <div className="flex items-center gap-1.5">
              {marketStructure.trend === 'bullish'
                ? <TrendingUp size={11} className="text-emerald-400" />
                : marketStructure.trend === 'bearish'
                  ? <TrendingDown size={11} className="text-red-400" />
                  : <Activity size={11} className="text-slate-400" />
              }
              <span className={`text-xs font-semibold ${
                marketStructure.trend === 'bullish' ? 'text-emerald-400'
                  : marketStructure.trend === 'bearish' ? 'text-red-400'
                  : 'text-slate-400'
              }`}>
                {marketStructure.trend}
              </span>
            </div>
          </DataRow>
          <DataRow label="Strength">
            <span className="text-xs text-slate-300 capitalize">{marketStructure.strength}</span>
          </DataRow>
          <DataRow label="Signal confidence">
            <span className="text-xs font-mono text-slate-300">
              {confidence.score.toFixed(1)}/10
            </span>
          </DataRow>
          {indicators.rsi !== null && (
            <DataRow label="RSI">
              <span className={`text-xs font-mono ${
                indicators.rsi > 70 ? 'text-red-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {indicators.rsi.toFixed(1)}
              </span>
            </DataRow>
          )}
        </div>
      </Card>

      <p className="text-[10px] text-slate-600 text-center">
        This is a technical analysis snapshot, not financial advice. Always manage risk independently.
      </p>

    </div>
  )
}
