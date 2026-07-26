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
    const allCandles = this.lastData.candles
    const fromTime   = Math.floor(allCandles[0].openTime / 1000)
    const toTime     = Math.floor(allCandles[allCandles.length - 1].openTime / 1000)
    const lw: 1 | 2 = lit ? 2 : 1

    // Suppress Entry axis label if SL lands within 14px — SL takes priority.
    const midCoord         = this.engine?.priceToCoordinate(mid) ?? null
    const slCoord          = plan.invalidationLevel !== null
      ? (this.engine?.priceToCoordinate(plan.invalidationLevel) ?? null)
      : null
    const entryLabelVisible = midCoord === null || slCoord === null
      || Math.abs(midCoord - slCoord) >= 14

    return [
      {
        kind: 'zone',
        key:  'fill',
        topPrice:    upper,
        bottomPrice: lower,
        ...fill,
        fromTime,
        toTime,
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
        axisLabelVisible: entryLabelVisible,
        title:            'Entry',
        visible:          this.visible,
      },
    ]
  }
}
