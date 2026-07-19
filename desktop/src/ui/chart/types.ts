import type { IChartApi } from 'lightweight-charts'
import type { Candle } from '../../modules/market/types'
import type { PipelineResult } from '../../modules/pipeline/types'

export interface IOverlay {
  readonly id: string
  mount(chart: IChartApi): void
  update(candles: Candle[]): void
  setVisible(visible: boolean): void
  dispose(): void
}

/** Overlay driven by the full pipeline analysis result rather than raw candle data. */
export interface IAnalysisOverlay {
  readonly id: string
  mount(chart: IChartApi): void
  update(data: PipelineResult | null): void
  dispose(): void
}
