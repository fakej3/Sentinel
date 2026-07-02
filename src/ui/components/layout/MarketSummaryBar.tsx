import { clsx } from 'clsx'
import { Activity, Wifi, WifiOff } from 'lucide-react'
import { TrendBadge } from '../shared/Badge'
import { NumberTicker } from '../shared/NumberTicker'
import { useApiStatus } from '../../hooks/useApiStatus'
import { formatPercent, formatTimestamp, formatInterval } from '../../utils/format'
import { changeColor, scoreColor } from '../../utils/colors'
import type { PipelineResult } from '../../types'

interface MarketSummaryBarProps {
  symbol: string
  interval: string
  loading: boolean
  data: PipelineResult | null
}

function ApiDot() {
  const status = useApiStatus()
  return (
    <div
      className={clsx(
        'flex items-center gap-1 text-[10px] font-medium',
        status === 'connected' && 'text-emerald-400',
        status === 'offline'   && 'text-red-400',
        status === 'checking'  && 'text-slate-500',
      )}
      title={status === 'connected' ? 'API connected' : status === 'offline' ? 'API offline' : 'Checking API…'}
    >
      {status === 'offline'
        ? <WifiOff size={11} />
        : <Wifi size={11} className={status === 'checking' ? 'opacity-40' : ''} />
      }
      <span className="hidden xl:inline">
        {status === 'connected' ? 'Connected' : status === 'offline' ? 'Offline' : 'Checking…'}
      </span>
    </div>
  )
}

export function MarketSummaryBar({ symbol, interval, loading, data }: MarketSummaryBarProps) {
  const sym = symbol.trim().toUpperCase() || 'BTCUSDT'

  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 h-[56px] border-b border-border-subtle bg-surface-900">
      {/* Symbol + interval */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold text-slate-100 tracking-tight font-mono">{sym}</span>
        <span className="text-[10px] text-slate-500 bg-surface-700 px-1.5 py-0.5 rounded font-mono border border-border-subtle">
          {formatInterval(interval)}
        </span>
      </div>

      {loading ? (
        <>
          <div className="w-px h-4 bg-border-subtle flex-shrink-0" />
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-3.5 h-3.5 border border-slate-600 border-t-slate-400 rounded-full animate-spin" aria-hidden="true" />
            <span className="text-xs">Analyzing…</span>
          </div>
        </>
      ) : data ? (
        <>
          <div className="w-px h-4 bg-border-subtle flex-shrink-0" />

          {/* Price */}
          <div className="flex items-baseline gap-2 flex-shrink-0">
            <NumberTicker
              value={data.analysis.price.current}
              decimals={data.analysis.price.current >= 100 ? 2 : 4}
              className="text-sm font-bold font-mono tabular-nums text-slate-50"
            />
            <span className={clsx('text-xs font-mono font-semibold', changeColor(data.analysis.price.change24hPercent))}>
              {formatPercent(data.analysis.price.change24hPercent)}
            </span>
          </div>

          <div className="w-px h-4 bg-border-subtle flex-shrink-0 hidden sm:block" />

          {/* Trend badge */}
          <div className="flex-shrink-0 hidden sm:block">
            <TrendBadge trend={data.analysis.fullTrend.trend} />
          </div>

          <div className="w-px h-4 bg-border-subtle flex-shrink-0 hidden md:block" />

          {/* Confidence */}
          <div className="flex items-baseline gap-1 flex-shrink-0 hidden md:flex">
            <span className={clsx('text-sm font-bold font-mono tabular-nums', scoreColor(data.confidence.score))}>
              {data.confidence.score.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-600">/10</span>
          </div>

          <div className="w-px h-4 bg-border-subtle flex-shrink-0 hidden lg:block" />

          {/* Timestamp */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-600 font-mono flex-shrink-0">
            <Activity size={10} className="text-slate-700 flex-shrink-0" />
            <span>{formatTimestamp(data.metadata.timestamp)}</span>
            <span className="text-slate-700">·</span>
            <span>{data.metadata.executionTime}ms</span>
          </div>
        </>
      ) : (
        <>
          <div className="w-px h-4 bg-border-subtle flex-shrink-0" />
          <span className="text-xs text-slate-600 select-none">Enter a symbol and click Analyze</span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* API status — always visible */}
      <ApiDot />
    </div>
  )
}
