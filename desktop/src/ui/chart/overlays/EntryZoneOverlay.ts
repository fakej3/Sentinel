import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
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

  private engine:           DrawingEngine | null = null
  private lastData:         PipelineResult | null = null
  private lastHighlightKey: string | null = null
  private visible = true

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null): void {
    this.lastData = data
    this.submit()
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.submit()
  }

  highlight(key: string | null): void {
    this.lastHighlightKey = key
    this.submit()
  }

  dispose(): void {
    this.engine?.clearLayer(this.id)
    this.engine = null
  }

  private submit(): void {
    this.engine?.render(this.id, this.buildInstructions())
  }

  private buildInstructions(): DrawingInstruction[] {
    const plan = this.lastData?.tradePlan
    if (!this.lastData || !plan?.actionable || !plan.entryZone) return []

    const lit     = this.lastHighlightKey === 'entry:zone' || this.lastHighlightKey === 'trade:full'
    const fill    = lit ? FILL_LIT : FILL_DIM
    const { lower, upper } = plan.entryZone
    const mid     = (lower + upper) / 2
    const times   = this.lastData.candles.slice(-80).map(c => Math.floor(c.openTime / 1000))
    const lw: 1 | 2 = lit ? 2 : 1

    return [
      {
        kind: 'zone',
        key:  'fill',
        topPrice:    upper,
        bottomPrice: lower,
        ...fill,
        times,
        visible: this.visible,
      },
      {
        kind:             'hline',
        key:              'lower',
        price:            lower,
        color:            'rgba(59, 130, 246, 0.5)',
        lineWidth:        lw,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: false,
        visible:          this.visible,
      },
      {
        kind:             'hline',
        key:              'upper',
        price:            upper,
        color:            'rgba(59, 130, 246, 0.5)',
        lineWidth:        lw,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: false,
        visible:          this.visible,
      },
      {
        kind:             'hline',
        key:              'mid',
        price:            mid,
        color:            'rgba(0,0,0,0)',
        lineWidth:        1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: true,
        title:            'Entry',
        visible:          this.visible,
      },
    ]
  }
}
