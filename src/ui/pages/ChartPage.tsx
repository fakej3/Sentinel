import { TradingViewChart } from '../components/layout/TradingViewChart'
import { PriceHeader } from '../components/layout/PriceHeader'
import type { PipelineResult } from '../types'

const DEFAULT_SYMBOL = 'BTCUSDT'

interface ChartPageProps {
  symbol: string
  interval: string
  data: PipelineResult | null
}

export function ChartPage({ symbol, interval, data }: ChartPageProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {data && <PriceHeader result={data} />}
      <div className="flex-1 min-h-0">
        <TradingViewChart symbol={symbol || DEFAULT_SYMBOL} interval={interval} />
      </div>
    </div>
  )
}
