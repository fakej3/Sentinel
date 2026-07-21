import { Activity } from 'lucide-react'
import { formatPrice, formatPercent, formatInterval, formatTimestamp } from '../../utils/format'
import { changeColor, scoreColor } from '../../utils/colors'
import { GradeBadge, TrendBadge } from '../shared/Badge'
import { NumberTicker } from '../shared/NumberTicker'
import type { PipelineResult } from '../../types'

interface PriceHeaderProps {
  result: PipelineResult
}

export function PriceHeader({ result }: PriceHeaderProps) {
  const { analysis, confidence, metadata } = result
  const { price } = analysis
  const change = price.change24hPercent

  return (
    <div className="flex-shrink-0 border-b border-border-subtle bg-surface-900 px-5 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Symbol + Price */}
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                {metadata.symbol}
              </h1>
              <span className="text-xs text-slate-500 bg-surface-700 px-1.5 py-0.5 rounded font-mono">
                {formatInterval(metadata.interval)}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <NumberTicker
                value={price.current}
                decimals={price.current >= 100 ? 2 : 4}
                className="text-2xl font-bold font-mono tabular-nums text-slate-50"
              />
              <span className={`text-sm font-semibold font-mono ${changeColor(change)}`}>
                {formatPercent(change)}
              </span>
            </div>
          </div>

          {/* 24h stats */}
          <div className="hidden lg:flex items-center gap-5 pl-5 border-l border-border-subtle">
            <div>
              <p className="section-label mb-0.5">24h High</p>
              <p className="text-sm font-mono text-slate-200">{formatPrice(price.high24h)}</p>
            </div>
            <div>
              <p className="section-label mb-0.5">24h Low</p>
              <p className="text-sm font-mono text-slate-200">{formatPrice(price.low24h)}</p>
            </div>
            {price.atrPercent !== null && (
              <div>
                <p className="section-label mb-0.5">ATR%</p>
                <p className="text-sm font-mono text-slate-200">{price.atrPercent.toFixed(2)}%</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Confidence + Trend */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="section-label mb-1">Confidence</p>
            <div className="flex items-center gap-2 justify-end">
              <span className={`text-xl font-bold font-mono ${scoreColor(confidence.score)}`}>
                {confidence.score.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500">/10</span>
            </div>
            <div className="flex items-center gap-2 mt-1 justify-end">
              <GradeBadge grade={confidence.grade} />
            </div>
          </div>

          <div className="w-px h-10 bg-border-subtle" />

          <div className="text-right">
            <p className="section-label mb-1">Trend</p>
            <TrendBadge trend={analysis.fullTrend.trend} />
          </div>

          <div className="w-px h-10 bg-border-subtle" />

          <div className="text-right hidden xl:block">
            <p className="section-label mb-1">Updated</p>
            <p className="text-xs font-mono text-slate-300">
              {formatTimestamp(metadata.timestamp)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-end gap-1">
              <Activity size={9} />
              {metadata.executionTime}ms
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
