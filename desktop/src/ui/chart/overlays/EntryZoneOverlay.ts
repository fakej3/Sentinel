import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { ZoneHandle, HorizontalLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const FILL_DIM = {
  fillColor1: 'rgba(59, 130, 246, 0.10)',
  fillColor2: 'rgba(59, 130, 246, 0.10)',
  lineColor:  'rgba(59, 130, 246, 0.40)',
} as const

const FILL_LIT = {
  fillColor1: 'rgba(59, 130, 246, 0.25)',
  fillColor2: 'rgba(59, 130, 246, 0.25)',
  lineColor:  'rgba(59, 130, 246, 0.90)',
} as const

export class EntryZoneOverlay implements IAnalysisOverlay {
  readonly id = 'entry-zone'
  private engine: DrawingEngine | null = null
  private fillH:  ZoneHandle | null = null
  private lines:  HorizontalLineHandle[] = []
  private lit = false

  mount(engine: DrawingEngine): void {
    this.engine = engine
    this.fillH  = engine.addZone({
      topPrice:    0,
      bottomPrice: 0,
      ...FILL_DIM,
      times: [],
    })
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const plan = data?.tradePlan

    if (!data || !plan?.actionable || !plan.entryZone || !this.engine || !this.fillH) {
      if (this.engine && this.fillH) this.engine.updateZone(this.fillH, { times: [] })
      return
    }

    const { lower, upper } = plan.entryZone
    const mid = (lower + upper) / 2

    const recentCandles = data.candles.slice(-80)
    this.engine.updateZone(this.fillH, {
      topPrice:    upper,
      bottomPrice: lower,
      times:       recentCandles.map(c => Math.floor(c.openTime / 1000)),
    })

    this.lines.push(this.engine.addHorizontalLine({
      price:            lower,
      color:            'rgba(59, 130, 246, 0.5)',
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      axisLabelVisible: false,
    }))
    this.lines.push(this.engine.addHorizontalLine({
      price:            upper,
      color:            'rgba(59, 130, 246, 0.5)',
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      axisLabelVisible: false,
    }))
    this.lines.push(this.engine.addHorizontalLine({
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
    if (this.fillH) this.engine.updateZone(this.fillH, { visible })
    for (const lineH of this.lines) this.engine.updateHorizontalLine(lineH, { visible })
  }

  highlight(key: string | null): void {
    if (!this.engine) return
    const lit = key === 'entry:zone' || key === 'trade:full'
    if (lit === this.lit) return
    this.lit = lit
    if (this.fillH) this.engine.updateZone(this.fillH, lit ? FILL_LIT : FILL_DIM)
    const w: 1 | 2 = lit ? 2 : 1
    for (const lineH of this.lines) this.engine.updateHorizontalLine(lineH, { lineWidth: w })
  }

  private clearLines(): void {
    if (!this.engine) return
    for (const lineH of this.lines) this.engine.removeHorizontalLine(lineH)
    this.lines = []
  }

  dispose(): void {
    this.clearLines()
    if (this.engine && this.fillH) this.engine.removeZone(this.fillH)
    this.fillH  = null
    this.engine = null
  }
}
