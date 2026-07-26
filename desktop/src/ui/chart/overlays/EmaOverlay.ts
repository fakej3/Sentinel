import type { DrawingEngine } from '../drawing/DrawingEngine'
import type { SeriesHandle } from '../drawing/types'
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
  private engine: DrawingEngine | null = null
  private seriesH: SeriesHandle | null = null
  private lit = false
  private lastLength    = 0
  private lastClose     = NaN
  private lastFirstTime = 0
  private valueMap: Map<number, number> = new Map()

  constructor(config: EmaConfig) {
    this.config = config
    this.id = `ema-${config.period}`
  }

  mount(engine: DrawingEngine): void {
    this.engine = engine
    this.seriesH = engine.addLineSeries({
      color:                  this.config.color,
      lineWidth:              1,
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
    })
  }

  update(candles: Candle[]): void {
    if (!this.engine || !this.seriesH || candles.length === 0) return
    const last      = candles[candles.length - 1]
    const firstTime = candles[0].openTime
    if (candles.length === this.lastLength && last.close === this.lastClose && firstTime === this.lastFirstTime) return
    this.lastLength    = candles.length
    this.lastClose     = last.close
    this.lastFirstTime = firstTime
    const closes = candles.map(c => c.close)
    const emaValues = computeEma(closes, this.config.period)
    if (emaValues.length === 0) {
      this.engine.setData(this.seriesH, [])
      this.valueMap.clear()
      return
    }
    const offset = candles.length - emaValues.length
    const data = emaValues.map((value, i) => ({
      time:  Math.floor(candles[offset + i].openTime / 1000),
      value,
    }))
    this.engine.setData(this.seriesH, data)
    this.valueMap = new Map(data.map(d => [d.time, d.value]))
  }

  setVisible(visible: boolean): void {
    if (this.engine && this.seriesH) this.engine.applySeriesOptions(this.seriesH, { visible })
  }

  highlight(key: string | null): void {
    if (!this.engine || !this.seriesH) return
    const mine = key === `ema:${this.config.period}` || key === 'ema:all'
    if (mine === this.lit) return
    this.lit = mine
    this.engine.applySeriesOptions(this.seriesH, { lineWidth: mine ? 3 : 1 })
  }

  getValueAt(time: number): number | undefined {
    return this.valueMap.get(time)
  }

  dispose(): void {
    if (this.engine && this.seriesH) this.engine.removeSeries(this.seriesH)
    this.seriesH    = null
    this.engine     = null
    this.lastLength    = 0
    this.lastClose     = NaN
    this.lastFirstTime = 0
    this.valueMap.clear()
  }
}
