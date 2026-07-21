import {
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../../../modules/market/types'
import type { IOverlay } from '../types'
import { computeEma } from '../utils/ema'

export interface EmaConfig {
  period: number
  color: string
}

export class EmaOverlay implements IOverlay {
  readonly id: string
  private readonly config: EmaConfig
  private chart: IChartApi | null = null
  private series: ISeriesApi<'Line'> | null = null
  private lit = false
  private lastLength = 0
  private lastClose  = NaN

  constructor(config: EmaConfig) {
    this.config = config
    this.id = `ema-${config.period}`
  }

  mount(chart: IChartApi): void {
    this.chart = chart
    this.series = chart.addSeries(LineSeries, {
      color: this.config.color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
  }

  update(candles: Candle[]): void {
    if (!this.series || candles.length === 0) return
    const last = candles[candles.length - 1]
    if (candles.length === this.lastLength && last.close === this.lastClose) return
    this.lastLength = candles.length
    this.lastClose  = last.close
    const closes = candles.map(c => c.close)
    const emaValues = computeEma(closes, this.config.period)
    if (emaValues.length === 0) {
      this.series.setData([])
      return
    }
    const offset = candles.length - emaValues.length
    this.series.setData(emaValues.map((value, i) => ({
      time: Math.floor(candles[offset + i].openTime / 1000) as UTCTimestamp,
      value,
    })))
  }

  setVisible(visible: boolean): void {
    this.series?.applyOptions({ visible })
  }

  highlight(key: string | null): void {
    if (!this.series) return
    const mine = key === `ema:${this.config.period}` || key === 'ema:all'
    if (mine === this.lit) return
    this.lit = mine
    this.series.applyOptions({ lineWidth: mine ? 3 : 1 })
  }

  dispose(): void {
    if (this.series && this.chart) {
      this.chart.removeSeries(this.series)
    }
    this.series     = null
    this.chart      = null
    this.lastLength = 0
    this.lastClose  = NaN
  }
}
