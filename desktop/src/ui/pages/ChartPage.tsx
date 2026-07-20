import { useState } from 'react'
import { Crosshair } from 'lucide-react'
import { TradingViewChart } from '../components/layout/TradingViewChart'
import { PriceHeader } from '../components/layout/PriceHeader'
import { AnalysisInspector } from '../components/inspector/AnalysisInspector'
import type { PipelineResult } from '../types'

const DEFAULT_SYMBOL = 'BTCUSDT'

interface ChartPageProps {
  symbol: string
  interval: string
  data: PipelineResult | null
}

export function ChartPage({ symbol, interval, data }: ChartPageProps) {
  const [inspectorOpen, setInspectorOpen] = useState(false)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {data && <PriceHeader result={data} />}
      <div className="flex-1 min-h-0 flex">
        {/* Chart area */}
        <div className="flex-1 min-w-0 relative">
          <TradingViewChart symbol={symbol || DEFAULT_SYMBOL} interval={interval} data={data} />

          {/* Inspector toggle — only visible when analysis data is available */}
          {data && (
            <button
              onClick={() => setInspectorOpen(o => !o)}
              title="Toggle Analysis Inspector"
              className={`
                absolute right-2 top-2 z-10 p-1.5 rounded
                border transition-all duration-150 focus-visible:outline-none
                ${inspectorOpen
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'bg-surface-900/80 border-border-subtle text-slate-500 hover:text-slate-300 hover:border-border-strong'
                }
              `}
              aria-label="Toggle analysis inspector"
            >
              <Crosshair size={13} />
            </button>
          )}
        </div>

        {/* Inspector panel */}
        {inspectorOpen && data && (
          <div className="w-[280px] flex-shrink-0 border-l border-border-subtle overflow-hidden">
            <AnalysisInspector data={data} onClose={() => setInspectorOpen(false)} />
          </div>
        )}
      </div>
    </div>
  )
}
