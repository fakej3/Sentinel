import {
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../../../modules/market/types'
import type { IOverlay } from '../types'

export class VolumeOverlay implements IOverlay {
  readonly id = 'volume'
  private chart: IChartApi | null = null
  private series: ISeriesApi<'Histogram'> | null = null

  mount(chart: IChartApi): void {
    this.chart = chart
    this.series = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
  }

  update(candles: Candle[]): void {
    this.series?.setData(candles.map(c => ({
      time: Math.floor(c.openTime / 1000) as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? '#26a69a28' : '#ef535028',
    })))
  }

  setVisible(visible: boolean): void {
    this.series?.applyOptions({ visible })
  }

  dispose(): void {
    if (this.series && this.chart) {
      this.chart.removeSeries(this.series)
    }
    this.series = null
    this.chart = null
  }
}
