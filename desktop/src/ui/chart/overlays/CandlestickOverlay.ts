import {
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../../../modules/market/types'
import type { IOverlay } from '../types'

export class CandlestickOverlay implements IOverlay {
  readonly id = 'candlestick'
  private chart: IChartApi | null = null
  private series: ISeriesApi<'Candlestick'> | null = null

  mount(chart: IChartApi): void {
    this.chart = chart
    this.series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceLineVisible: false,
    })
  }

  update(candles: Candle[]): void {
    this.series?.setData(candles.map(c => ({
      time: Math.floor(c.openTime / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
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
