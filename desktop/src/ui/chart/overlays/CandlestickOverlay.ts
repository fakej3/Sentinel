import type { DrawingEngine } from '../drawing/DrawingEngine'
import type { SeriesHandle } from '../drawing/types'
import type { Candle } from '../../../modules/market/types'
import type { IOverlay } from '../types'

export class CandlestickOverlay implements IOverlay {
  readonly id = 'candlestick'
  private engine: DrawingEngine | null = null
  private seriesH: SeriesHandle | null = null

  mount(engine: DrawingEngine): void {
    this.engine = engine
    this.seriesH = engine.addCandlestickSeries({
      upColor:          '#26a69a',
      downColor:        '#ef5350',
      wickUpColor:      '#26a69a',
      wickDownColor:    '#ef5350',
      priceLineVisible: false,
      lastValueVisible: true,
    })
  }

  update(candles: Candle[]): void {
    if (!this.engine || !this.seriesH) return
    this.engine.setCandlestickData(this.seriesH, candles.map(c => ({
      time:  Math.floor(c.openTime / 1000),
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })))
  }

  tick(candle: Candle): void {
    if (!this.engine || !this.seriesH) return
    this.engine.updateCandlestick(this.seriesH, {
      time:  Math.floor(candle.openTime / 1000),
      open:  candle.open,
      high:  candle.high,
      low:   candle.low,
      close: candle.close,
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
