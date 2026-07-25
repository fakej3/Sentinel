import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { SeriesHandle, PriceLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const FILL_DIM = { topFillColor1: 'rgba(59, 130, 246, 0.10)', topFillColor2: 'rgba(59, 130, 246, 0.10)', topLineColor: 'rgba(59, 130, 246, 0.4)' } as const
const FILL_LIT = { topFillColor1: 'rgba(59, 130, 246, 0.25)', topFillColor2: 'rgba(59, 130, 246, 0.25)', topLineColor: 'rgba(59, 130, 246, 0.9)' } as const

export class EntryZoneOverlay implements IAnalysisOverlay {
  readonly id = 'entry-zone'
  private engine: DrawingEngine | null = null
  private fillH: SeriesHandle | null = null
  private hostH: SeriesHandle | null = null
  private lines: PriceLineHandle[] = []
  private lit = false

  mount(engine: DrawingEngine): void {
    this.engine = engine

    this.fillH = engine.addBaselineSeries({
      baseValue:            0,
      ...FILL_DIM,
      bottomFillColor1:     'transparent',
      bottomFillColor2:     'transparent',
      bottomLineColor:      'transparent',
      lineWidth:            1,
      priceLineVisible:     false,
      lastValueVisible:     false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale: true,
    })
    engine.setData(this.fillH, [])

    this.hostH = engine.addLineSeries({
      color:                  'rgba(0,0,0,0)',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale:   true,
    })
    engine.setData(this.hostH, [])
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const plan = data?.tradePlan

    if (!data || !plan?.actionable || !plan.entryZone || !this.engine || !this.fillH || !this.hostH) {
      if (this.engine && this.fillH) this.engine.setData(this.fillH, [])
      return
    }

    const { lower, upper } = plan.entryZone
    const mid = (lower + upper) / 2

    // Fill only the most recent 80 candles so it reads as a current zone
    const recentCandles = data.candles.slice(-80)
    this.engine.applySeriesOptions(this.fillH, { baseValue: { type: 'price', price: lower } })
    this.engine.setData(this.fillH, recentCandles.map(c => ({
      time:  Math.floor(c.openTime / 1000),
      value: upper,
    })))

    // Single boundary lines — no axis labels except center label
    this.lines.push(this.engine.addPriceLine(this.hostH, {
      price:            lower,
      color:            'rgba(59, 130, 246, 0.5)',
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      axisLabelVisible: false,
      title:            '',
    }))
    this.lines.push(this.engine.addPriceLine(this.hostH, {
      price:            upper,
      color:            'rgba(59, 130, 246, 0.5)',
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      axisLabelVisible: false,
      title:            '',
    }))
    // Single 'Entry' label at midpoint
    this.lines.push(this.engine.addPriceLine(this.hostH, {
      price:            mid,
      color:            'rgba(0,0,0,0)',
      lineWidth:        1,
      lineStyle:        LineStyle.Solid,
      axisLabelVisible: true,
      title:            'Entry',
    }))
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    if (this.fillH) this.engine.applySeriesOptions(this.fillH, { visible })
    if (this.hostH) this.engine.applySeriesOptions(this.hostH, { visible })
  }

  highlight(key: string | null): void {
    if (!this.engine) return
    const lit = key === 'entry:zone' || key === 'trade:full'
    if (lit === this.lit) return
    this.lit = lit
    if (this.fillH) this.engine.applySeriesOptions(this.fillH, lit ? FILL_LIT : FILL_DIM)
    const w: 1 | 2 = lit ? 2 : 1
    for (const lineH of this.lines) this.engine.updatePriceLine(lineH, { lineWidth: w })
  }

  private clearLines(): void {
    if (!this.engine) return
    for (const lineH of this.lines) this.engine.removePriceLine(lineH)
    this.lines = []
  }

  dispose(): void {
    this.clearLines()
    if (this.engine) {
      if (this.fillH) this.engine.removeSeries(this.fillH)
      if (this.hostH) this.engine.removeSeries(this.hostH)
    }
    this.fillH  = null
    this.hostH  = null
    this.engine = null
  }
}
