import { BarChart2, TrendingUp, TrendingDown, Minus, Zap, Activity } from 'lucide-react'
import { Card } from '../shared/Card'
import { DualBar, ProgressBar } from '../shared/ProgressBar'
import { Badge } from '../shared/Badge'
import { formatVolume } from '../../utils/format'
import { clsx } from 'clsx'
import type { PipelineResult } from '../../types'

interface VolumeTabProps {
  result: PipelineResult
}

function VolumeGauge({ strength }: { strength: number }) {
  const pct = (strength / 10) * 100
  const color = strength >= 7 ? '#34d399' : strength >= 4 ? '#60a5fa' : '#f87171'
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dashLength = (pct / 100) * circumference * 0.75

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-[135deg]">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#1e2740" strokeWidth={7}
            strokeDasharray={`${circumference * 0.75} ${circumference}`} strokeLinecap="round" />
          <circle cx="64" cy="64" r={radius} fill="none" stroke={color} strokeWidth={7}
            strokeDasharray={`${dashLength} ${circumference}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono text-slate-100">{strength.toFixed(1)}</span>
          <span className="text-[10px] text-slate-500">/ 10</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-1">Volume Strength</p>
    </div>
  )
}

export function VolumeTab({ result }: VolumeTabProps) {
  const { volumeAnalysis, analysis } = result
  const { buySellPressure, relativeVolume, volumeConfirmation, climax, accumulationDistribution, obvAnalysis, vwapAnalysis, volumeTrend } = volumeAnalysis
  const { volumeContext } = analysis

  const isBuyingClimaxActive = climax.buyingClimax
  const isSellingClimaxActive = climax.sellingClimax
  const isExhaustion = climax.exhaustion

  return (
    <div className="p-4 space-y-4 animate-in">
      {/* Gauge + Confirmation row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 flex items-center justify-center col-span-1">
          <VolumeGauge strength={volumeAnalysis.overallStrength} />
        </Card>

        <Card className="p-4 col-span-2">
          <p className="section-label mb-3">Buy / Sell Pressure</p>
          <DualBar
            buyPct={buySellPressure.buyVolume}
            sellPct={buySellPressure.sellVolume}
          />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="section-label mb-0.5">Buy Vol</p>
              <p className="text-xs font-mono text-emerald-400">{formatVolume(buySellPressure.buyVolume)}</p>
            </div>
            <div>
              <p className="section-label mb-0.5">Sell Vol</p>
              <p className="text-xs font-mono text-red-400">{formatVolume(buySellPressure.sellVolume)}</p>
            </div>
            <div>
              <p className="section-label mb-0.5">Delta</p>
              <p className={clsx('text-xs font-mono font-semibold', {
                'text-emerald-400': buySellPressure.delta > 0,
                'text-red-400': buySellPressure.delta < 0,
                'text-slate-400': buySellPressure.delta === 0,
              })}>
                {buySellPressure.delta > 0 ? '+' : ''}{formatVolume(buySellPressure.delta)}
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border-subtle flex justify-between items-center">
            <span className="text-[11px] text-slate-500">Dominant side</span>
            <Badge dot className={clsx('border', {
              'bg-emerald-400/10 text-emerald-400 border-emerald-400/20': buySellPressure.dominantSide === 'buyers',
              'bg-red-400/10 text-red-400 border-red-400/20': buySellPressure.dominantSide === 'sellers',
              'bg-slate-400/10 text-slate-400 border-slate-400/20': buySellPressure.dominantSide === 'balanced',
            })}>
              {buySellPressure.dominantSide}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Relative Volume + Trend */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="section-label mb-3">Relative Volume</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={clsx('text-2xl font-bold font-mono', {
              'text-emerald-300': volumeContext.volumeClassification === 'very_high',
              'text-emerald-400': volumeContext.volumeClassification === 'high',
              'text-slate-200': volumeContext.volumeClassification === 'normal',
              'text-amber-400': volumeContext.volumeClassification === 'low',
              'text-red-400': volumeContext.volumeClassification === 'very_low',
            })}>
              {relativeVolume.ratio.toFixed(2)}×
            </span>
            <Badge dot className={clsx('border', {
              'bg-emerald-400/10 text-emerald-400 border-emerald-400/20': ['high', 'very_high'].includes(volumeContext.volumeClassification),
              'bg-slate-400/10 text-slate-400 border-slate-400/20': volumeContext.volumeClassification === 'normal',
              'bg-red-400/10 text-red-400 border-red-400/20': ['low', 'very_low'].includes(volumeContext.volumeClassification),
            })}>
              {volumeContext.volumeClassification.replace(/_/g, ' ')}
            </Badge>
          </div>
          <ProgressBar
            value={Math.min(relativeVolume.ratio * 40, 100)}
            height="h-1.5"
            colorClass={relativeVolume.ratio >= 1.5 ? 'bg-emerald-400' : relativeVolume.ratio >= 0.7 ? 'bg-blue-400' : 'bg-red-400'}
          />
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>Current: {formatVolume(relativeVolume.current)}</span>
            <span>Avg: {formatVolume(relativeVolume.average)}</span>
          </div>
        </Card>

        <Card className="p-4">
          <p className="section-label mb-3">Volume Trend</p>
          <div className="flex items-center gap-2 mb-2">
            {volumeTrend.direction === 'increasing'
              ? <TrendingUp size={16} className="text-emerald-400" />
              : volumeTrend.direction === 'decreasing'
                ? <TrendingDown size={16} className="text-red-400" />
                : <Minus size={16} className="text-slate-400" />
            }
            <span className={clsx('text-sm font-semibold capitalize', {
              'text-emerald-400': volumeTrend.direction === 'increasing',
              'text-red-400': volumeTrend.direction === 'decreasing',
              'text-slate-400': volumeTrend.direction === 'flat',
            })}>
              {volumeTrend.direction}
            </span>
          </div>
          <ProgressBar
            value={volumeTrend.confidence}
            max={10}
            height="h-1.5"
            label="Confidence"
            colorClass="bg-blue-400"
          />
          {volumeTrend.evidence.slice(0, 2).map((e, i) => (
            <p key={i} className="text-[11px] text-slate-500 mt-1.5 leading-snug">{e}</p>
          ))}
        </Card>
      </div>

      {/* Confirmation + Acc/Dist + OBV + VWAP */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="section-label mb-3">Confirmation</p>
          <div className="space-y-2">
            {([
              ['Move', volumeConfirmation.confirmed],
              ['Trend', volumeConfirmation.supportsTrend],
              ['Breakout', volumeConfirmation.supportsBreakout],
              ['BOS', volumeConfirmation.supportsBOS],
              ['CHoCH', volumeConfirmation.supportsCHOCH],
            ] as const).map(([label, val]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{label}</span>
                <span className={`text-xs font-semibold ${val ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {val ? '✓ Yes' : '— No'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-border-subtle leading-snug">
            {volumeConfirmation.reason}
          </p>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <p className="section-label mb-2">Accumulation / Distribution</p>
            <div className="flex items-center gap-3">
              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center', {
                'bg-emerald-400/15': accumulationDistribution.state === 'accumulation',
                'bg-red-400/15': accumulationDistribution.state === 'distribution',
                'bg-slate-600': accumulationDistribution.state === 'neutral',
              })}>
                <Activity size={14} className={clsx({
                  'text-emerald-400': accumulationDistribution.state === 'accumulation',
                  'text-red-400': accumulationDistribution.state === 'distribution',
                  'text-slate-400': accumulationDistribution.state === 'neutral',
                })} />
              </div>
              <div>
                <p className={clsx('text-sm font-semibold capitalize', {
                  'text-emerald-400': accumulationDistribution.state === 'accumulation',
                  'text-red-400': accumulationDistribution.state === 'distribution',
                  'text-slate-400': accumulationDistribution.state === 'neutral',
                })}>
                  {accumulationDistribution.state}
                </p>
                <p className="text-[11px] text-slate-500">
                  Score: {accumulationDistribution.score > 0 ? '+' : ''}{accumulationDistribution.score}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <p className="section-label mb-2">OBV</p>
            <div className="flex items-center gap-2">
              {obvAnalysis.direction === 'bullish'
                ? <TrendingUp size={14} className="text-emerald-400" />
                : obvAnalysis.direction === 'bearish'
                  ? <TrendingDown size={14} className="text-red-400" />
                  : <Minus size={14} className="text-slate-400" />
              }
              <span className={clsx('text-sm font-semibold', {
                'text-emerald-400': obvAnalysis.direction === 'bullish',
                'text-red-400': obvAnalysis.direction === 'bearish',
                'text-slate-400': obvAnalysis.direction === 'neutral',
              })}>
                {obvAnalysis.direction}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {obvAnalysis.confirmingPrice ? '✓ Confirming price' : obvAnalysis.diverging ? '⚠ Diverging' : 'Neutral'}
            </p>
          </Card>
        </div>
      </div>

      {/* Climax Signals */}
      {(isBuyingClimaxActive || isSellingClimaxActive || isExhaustion) && (
        <Card className="p-4 border-amber-400/20">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-amber-400" />
            <p className="section-label text-amber-400">Climax Signal</p>
          </div>
          <div className="flex gap-3">
            {isBuyingClimaxActive && (
              <Badge dot className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                Buying Climax
              </Badge>
            )}
            {isSellingClimaxActive && (
              <Badge dot className="bg-red-400/10 text-red-400 border border-red-400/20">
                Selling Climax
              </Badge>
            )}
            {isExhaustion && (
              <Badge dot className="bg-amber-400/10 text-amber-400 border border-amber-400/20">
                Exhaustion
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-amber-300/70 mt-2 leading-snug">
            High-volume event detected. Potential trend pause or reversal.
          </p>
        </Card>
      )}

      {/* VWAP */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-slate-500" />
          <p className="section-label">VWAP Analysis</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">Position</p>
            <p className={`text-sm font-semibold ${vwapAnalysis.above ? 'text-emerald-400' : 'text-red-400'}`}>
              {vwapAnalysis.above ? 'Above' : 'Below'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">Distance</p>
            <p className={`text-sm font-mono font-semibold ${vwapAnalysis.above ? 'text-emerald-400' : 'text-red-400'}`}>
              {vwapAnalysis.distancePercent.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-0.5">Respecting</p>
            <p className={`text-sm font-semibold ${vwapAnalysis.respectingVWAP ? 'text-emerald-400' : 'text-slate-400'}`}>
              {vwapAnalysis.respectingVWAP ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
