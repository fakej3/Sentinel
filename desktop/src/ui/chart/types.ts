import type { IChartApi } from 'lightweight-charts'
import type { Candle } from '../../modules/market/types'

export interface IOverlay {
  readonly id: string
  mount(chart: IChartApi): void
  update(candles: Candle[]): void
  setVisible(visible: boolean): void
  dispose(): void
}
