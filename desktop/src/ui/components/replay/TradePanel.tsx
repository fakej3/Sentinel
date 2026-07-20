import { memo } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { TrackedTrade } from '../../../modules/replay/types'

interface TradePanelProps {
  trades: TrackedTrade[]
}

export const TradePanel = memo(function TradePanel({ trades }: TradePanelProps) {
  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-600 text-xs">
        No trades detected
      </div>
    )
  }

  return (
    <div className="overflow-y-auto max-h-[320px]">
      {[...trades].reverse().map(trade => (
        <TradeRow key={trade.id} trade={trade} />
      ))}
    </div>
  )
})

function TradeRow({ trade }: { trade: TrackedTrade }) {
  const outcomeColor =
    trade.outcome === 'tp_hit' ? 'text-emerald-400' :
    trade.outcome === 'sl_hit' ? 'text-red-400' :
    'text-yellow-400'

  const outcomeLabel =
    trade.outcome === 'tp_hit' ? 'TP' :
    trade.outcome === 'sl_hit' ? 'SL' :
    'OPEN'

  return (
    <div className={clsx(
      'px-3 py-2 border-b border-border-subtle text-[10px]',
      'hover:bg-surface-800 transition-colors',
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {trade.direction === 'bullish'
            ? <TrendingUp  size={10} className="text-emerald-400" />
            : <TrendingDown size={10} className="text-red-400" />
          }
          <span className="font-medium text-slate-300">
            {trade.direction === 'bullish' ? 'Long' : 'Short'} #{trade.id.replace('trade_', '')}
          </span>
          <span className="text-slate-600">@{formatPrice(trade.entryMid)}</span>
        </div>
        <span className={clsx('font-semibold', outcomeColor)}>{outcomeLabel}</span>
      </div>

      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-slate-500">
        <KV label="SL" value={formatPrice(trade.stopLoss)} />
        <KV label="TP" value={formatPrice(trade.takeProfit)} />
        <KV label="RR" value={trade.riskRewardRatio !== null ? trade.riskRewardRatio.toFixed(2) + 'R' : '—'} />
        <KV label="Conf" value={trade.confidence.toFixed(1)} />
        <KV label="MFE" value={formatPrice(trade.mfe)} />
        <KV label="MAE" value={formatPrice(trade.mae)} />
        {trade.durationCandles !== null && (
          <KV label="Dur" value={`${trade.durationCandles}c`} />
        )}
        <KV label="Quality" value={trade.setupQuality} />
        <KV label="Trend" value={trade.trend} />
      </div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-600">{label} </span>
      <span className="text-slate-400">{value}</span>
    </span>
  )
}

function formatPrice(n: number): string {
  return n >= 1000 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toPrecision(4)
}
