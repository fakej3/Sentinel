import type { IChartApi } from 'lightweight-charts'
import type { Candle } from '../../modules/market/types'
import type { PipelineResult } from '../../modules/pipeline/types'

export interface IOverlay {
  readonly id: string
  mount(chart: IChartApi): void
  update(candles: Candle[]): void
  setVisible(visible: boolean): void
  /**
   * Highlight the overlay element matching `key`, or restore all elements when `key` is null.
   * Key format: `'<overlay>:<qualifier>'`  e.g. `'ema:20'`, `'sr:zone:sr-001'`, `'ms:bos:1714000000000'`
   * Group keys like `'ema:all'` highlight every element in the overlay.
   */
  highlight?(key: string | null): void
  dispose(): void
}

/** Overlay driven by the full pipeline analysis result rather than raw candle data. */
export interface IAnalysisOverlay {
  readonly id: string
  mount(chart: IChartApi): void
  update(data: PipelineResult | null): void
  /** Same contract as IOverlay.highlight. */
  highlight?(key: string | null): void
  dispose(): void
}
