import { PriceHeader } from './PriceHeader'
import { formatInterval } from '../../utils/format'
import type { PipelineResult } from '../../types'

interface MarketSummaryBarProps {
  symbol: string
  interval: string
  loading: boolean
  data: PipelineResult | null
}

export function MarketSummaryBar({ symbol, interval, loading, data }: MarketSummaryBarProps) {
  if (data && !loading) {
    return <PriceHeader result={data} />
  }

  const sym = symbol.trim().toUpperCase() || 'BTCUSDT'

  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-5 h-[56px] border-b border-border-subtle bg-surface-900">
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
      ) : (
        <>
          <div className="w-px h-4 bg-border-subtle flex-shrink-0" />
          <span className="text-xs text-slate-600 select-none">Enter a symbol and click Analyze</span>
        </>
      )}
    </div>
  )
}
