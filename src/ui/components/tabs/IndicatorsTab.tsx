import { Activity, TrendingUp, BarChart2, Zap, Target, Layers, Droplets, Radio } from 'lucide-react'
import { Card } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'
import { Badge } from '../shared/Badge'
import { formatPrice, formatScore } from '../../utils/format'
import { clsx } from 'clsx'
import type { PipelineResult } from '../../types'

interface IndicatorsTabProps {
  result: PipelineResult
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'bullish' || status === 'above' || status === 'oversold' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
    : status === 'bearish' || status === 'below' || status === 'overbought' ? 'bg-red-400/10 text-red-400 border-red-400/20'
    : status === 'squeeze' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
    : status === 'expansion' ? 'bg-blue-400/10 text-blue-400 border-blue-400/20'
    : 'bg-slate-400/10 text-slate-400 border-slate-400/20'

  return (
    <Badge dot className={`${color} border`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

interface IndicatorCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  unavailable?: boolean
}

function IndicatorCard({ icon, title, children, unavailable }: IndicatorCardProps) {
  return (
    <Card className={clsx('p-4', unavailable && 'opacity-50')}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-500 flex-shrink-0">{icon}</div>
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{title}</p>
        {unavailable && (
          <span className="ml-auto text-[10px] text-slate-600 bg-surface-700 px-1.5 py-0.5 rounded">N/A</span>
        )}
      </div>
      {!unavailable && children}
    </Card>
  )
}

export function IndicatorsTab({ result }: IndicatorsTabProps) {
  const { indicators, analysis } = result
  const { indicatorSummary, emaContext } = analysis
  const { rsi, macd, adx, bollinger, stochRsi } = indicatorSummary

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in">

      {/* EMA */}
      <IndicatorCard icon={<TrendingUp size={14} />} title="EMA">
        <div className="space-y-2">
          {([
            ['EMA 20', indicators.ema20, emaContext.priceVsEMA20],
            ['EMA 50', indicators.ema50, emaContext.priceVsEMA50],
            ['EMA 100', indicators.ema100, emaContext.priceVsEMA100],
            ['EMA 200', indicators.ema200, emaContext.priceVsEMA200],
          ] as const).map(([label, val, rel]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-300">{val !== null ? formatPrice(val) : '—'}</span>
                {val !== null && <StatusBadge status={rel} />}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-border-subtle">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-500">Alignment</span>
            <StatusBadge status={emaContext.emaAlignment} />
          </div>
        </div>
      </IndicatorCard>

      {/* RSI */}
      <IndicatorCard icon={<Activity size={14} />} title="RSI (14)" unavailable={indicators.rsi === null}>
        {indicators.rsi !== null && (
          <>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={clsx('text-2xl font-bold font-mono', {
                'text-emerald-400': rsi.classification === 'oversold',
                'text-red-400': rsi.classification === 'overbought',
                'text-emerald-300': rsi.classification === 'healthy_bullish',
                'text-slate-200': rsi.classification === 'neutral',
                'text-slate-400': rsi.classification === 'weak_bearish',
              })}>
                {indicators.rsi.toFixed(1)}
              </span>
              <StatusBadge status={rsi.classification} />
            </div>
            <div className="relative h-2 bg-surface-600 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="w-[30%] bg-emerald-400/20 border-r border-surface-600" title="Oversold < 30" />
                <div className="flex-1 bg-transparent" />
                <div className="w-[30%] bg-red-400/20 border-l border-surface-600" title="Overbought > 70" />
              </div>
              <div
                className={clsx('absolute top-0 h-full w-1 rounded-full -translate-x-0.5', {
                  'bg-emerald-400': rsi.classification === 'oversold',
                  'bg-red-400': rsi.classification === 'overbought',
                  'bg-blue-400': rsi.classification === 'neutral',
                  'bg-emerald-300': rsi.classification === 'healthy_bullish',
                  'bg-slate-400': rsi.classification === 'weak_bearish',
                })}
                style={{ left: `${indicators.rsi}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
              <span>0</span><span>30</span><span>70</span><span>100</span>
            </div>
          </>
        )}
      </IndicatorCard>

      {/* MACD */}
      <IndicatorCard icon={<BarChart2 size={14} />} title="MACD" unavailable={indicators.macd === null}>
        {indicators.macd !== null && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">MACD Line</span>
              <span className="text-xs font-mono text-slate-200">{indicators.macd.macdLine.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Signal Line</span>
              <span className="text-xs font-mono text-slate-200">{indicators.macd.signalLine.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Histogram</span>
              <span className={clsx('text-xs font-mono font-semibold', {
                'text-emerald-400': indicators.macd.histogram > 0,
                'text-red-400': indicators.macd.histogram < 0,
                'text-slate-400': indicators.macd.histogram === 0,
              })}>
                {indicators.macd.histogram > 0 ? '+' : ''}{indicators.macd.histogram.toFixed(4)}
              </span>
            </div>
            <div className="pt-1 border-t border-border-subtle flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Bias</span>
              <StatusBadge status={macd.bias} />
            </div>
          </div>
        )}
      </IndicatorCard>

      {/* ADX */}
      <IndicatorCard icon={<Zap size={14} />} title="ADX" unavailable={indicators.adx === null}>
        {indicators.adx !== null && (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-100">
                {indicators.adx.adx.toFixed(1)}
              </span>
              <StatusBadge status={adx.trendStrength} />
            </div>
            <ProgressBar
              value={indicators.adx.adx}
              max={60}
              height="h-1.5"
              colorClass={adx.trendStrength === 'very_strong' || adx.trendStrength === 'extreme' ? 'bg-emerald-400' : adx.trendStrength === 'strong' ? 'bg-blue-400' : 'bg-amber-400'}
            />
            <div className="flex justify-between text-[11px]">
              <div>
                <p className="text-slate-500">+DI</p>
                <p className="font-mono text-emerald-400">{indicators.adx.diPlus.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">-DI</p>
                <p className="font-mono text-red-400">{indicators.adx.diMinus.toFixed(1)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-border-subtle">
              <span className="text-[11px] text-slate-500">Direction</span>
              <StatusBadge status={adx.dominantDirection} />
            </div>
          </div>
        )}
      </IndicatorCard>

      {/* ATR */}
      <IndicatorCard icon={<Target size={14} />} title="ATR (14)" unavailable={indicators.atr === null}>
        {indicators.atr !== null && (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-slate-100">{formatPrice(indicators.atr)}</span>
            </div>
            {indicators.atrPercent !== null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">ATR %</span>
                <span className={clsx('text-sm font-mono font-semibold', {
                  'text-red-400': indicators.atrPercent > 5,
                  'text-amber-400': indicators.atrPercent > 2,
                  'text-emerald-400': indicators.atrPercent <= 2,
                })}>
                  {indicators.atrPercent.toFixed(2)}%
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Volatility: {indicators.atrPercent !== null
                ? indicators.atrPercent > 5 ? 'High' : indicators.atrPercent > 2 ? 'Moderate' : 'Low'
                : 'N/A'}
            </p>
          </div>
        )}
      </IndicatorCard>

      {/* Bollinger Bands */}
      <IndicatorCard icon={<Layers size={14} />} title="Bollinger Bands" unavailable={indicators.bollingerBands === null}>
        {indicators.bollingerBands !== null && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Upper</span>
              <span className="font-mono text-red-300">{formatPrice(indicators.bollingerBands.upper)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Middle (SMA)</span>
              <span className="font-mono text-slate-200">{formatPrice(indicators.bollingerBands.middle)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Lower</span>
              <span className="font-mono text-emerald-300">{formatPrice(indicators.bollingerBands.lower)}</span>
            </div>
            <div className="pt-1 border-t border-border-subtle space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Bandwidth</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300">{indicators.bollingerBands.bandwidth.toFixed(2)}%</span>
                  <StatusBadge status={bollinger.bandwidthState} />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Price vs Bands</span>
                <StatusBadge status={bollinger.priceRelativeToBands} />
              </div>
            </div>
          </div>
        )}
      </IndicatorCard>

      {/* VWAP */}
      <IndicatorCard icon={<Droplets size={14} />} title="VWAP">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-100">{formatPrice(indicators.vwap)}</span>
            <StatusBadge status={analysis.volumeContext.priceAboveVWAP ? 'above' : 'below'} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Distance</span>
            <span className={clsx('font-mono font-semibold', {
              'text-emerald-400': analysis.volumeContext.priceAboveVWAP,
              'text-red-400': !analysis.volumeContext.priceAboveVWAP,
            })}>
              {analysis.volumeContext.vwapDistancePercent.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border-subtle">
            <span className="text-[11px] text-slate-500">Respecting</span>
            <span className={`text-xs font-semibold ${analysis.volumeContext.respectingVWAP ? 'text-emerald-400' : 'text-slate-500'}`}>
              {analysis.volumeContext.respectingVWAP ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </IndicatorCard>

      {/* Stoch RSI */}
      <IndicatorCard icon={<Radio size={14} />} title="Stoch RSI" unavailable={indicators.stochRsi === null}>
        {indicators.stochRsi !== null && (
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">K</p>
                <p className="text-lg font-bold font-mono text-slate-100">{indicators.stochRsi.k.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-0.5">D</p>
                <p className="text-lg font-bold font-mono text-slate-100">{indicators.stochRsi.d.toFixed(1)}</p>
              </div>
              <div className="ml-auto">
                <StatusBadge status={stochRsi.zone} />
              </div>
            </div>
            <div className="space-y-1">
              <ProgressBar
                value={indicators.stochRsi.k}
                max={100}
                height="h-1.5"
                label="K"
                colorClass={stochRsi.zone === 'overbought' ? 'bg-red-400' : stochRsi.zone === 'oversold' ? 'bg-emerald-400' : 'bg-blue-400'}
              />
              <ProgressBar
                value={indicators.stochRsi.d}
                max={100}
                height="h-1.5"
                label="D"
                colorClass="bg-violet-400"
              />
            </div>
          </div>
        )}
      </IndicatorCard>

      {/* MFI + CCI + OBV row */}
      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="section-label mb-2">MFI</p>
          {indicators.mfi !== null ? (
            <div>
              <p className={clsx('text-xl font-bold font-mono', {
                'text-red-400': indicators.mfi > 80,
                'text-emerald-400': indicators.mfi < 20,
                'text-slate-200': indicators.mfi >= 20 && indicators.mfi <= 80,
              })}>
                {formatScore(indicators.mfi)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {indicators.mfi > 80 ? 'Overbought' : indicators.mfi < 20 ? 'Oversold' : 'Neutral'}
              </p>
            </div>
          ) : <p className="text-sm text-slate-600">N/A</p>}
        </Card>
        <Card className="p-3">
          <p className="section-label mb-2">CCI</p>
          {indicators.cci !== null ? (
            <div>
              <p className={clsx('text-xl font-bold font-mono', {
                'text-red-400': indicators.cci > 100,
                'text-emerald-400': indicators.cci < -100,
                'text-slate-200': indicators.cci >= -100 && indicators.cci <= 100,
              })}>
                {indicators.cci.toFixed(0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {indicators.cci > 100 ? 'Overbought' : indicators.cci < -100 ? 'Oversold' : 'Normal'}
              </p>
            </div>
          ) : <p className="text-sm text-slate-600">N/A</p>}
        </Card>
        <Card className="p-3">
          <p className="section-label mb-2">OBV</p>
          <div>
            <p className={clsx('text-xl font-bold font-mono', {
              'text-emerald-400': analysis.volumeContext.obvDirection === 'bullish',
              'text-red-400': analysis.volumeContext.obvDirection === 'bearish',
              'text-slate-400': analysis.volumeContext.obvDirection === 'neutral',
            })}>
              {analysis.volumeContext.obvDirection}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {analysis.volumeContext.obvConfirmingPrice ? '✓ Confirming price' : '✗ Diverging'}
            </p>
          </div>
        </Card>
      </div>

    </div>
  )
}
