import type { DrawingEngine } from '../drawing/DrawingEngine'
import type { SeriesHandle } from '../drawing/types'
import type { Candle } from '../../../modules/market/types'
import type { IOverlay } from '../types'

export class VolumeOverlay implements IOverlay {
  readonly id = 'volume'
  private engine: DrawingEngine | null = null
  private seriesH: SeriesHandle | null = null

  mount(engine: DrawingEngine): void {
    this.engine = engine
    this.seriesH = engine.addHistogramSeries({
      priceFormat:      'volume',
      priceScaleId:     'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    engine.configurePriceScale('volume', { scaleMargins: { top: 0.8, bottom: 0 } })
  }

  update(candles: Candle[]): void {
    if (!this.engine || !this.seriesH) return
    this.engine.setHistogramData(this.seriesH, candles.map(c => ({
      time:  Math.floor(c.openTime / 1000),
      value: c.volume,
      color: c.close >= c.open ? '#26a69a40' : '#ef535040',
    })))
  }

  tick(candle: Candle): void {
    if (!this.engine || !this.seriesH) return
    this.engine.updateHistogram(this.seriesH, {
      time:  Math.floor(candle.openTime / 1000),
      value: candle.volume,
      color: candle.close >= candle.open ? '#26a69a40' : '#ef535040',
    })
  }

  setVisible(visible: boolean): void {
    if (this.engine && this.seriesH) this.engine.applySeriesOptions(this.seriesH, { visible })
  }

  dispose(): void {
    if (this.engine && this.seriesH) this.engine.removeSeries(this.seriesH)
    this.seriesH = null
    this.engine  = null
  }
}
