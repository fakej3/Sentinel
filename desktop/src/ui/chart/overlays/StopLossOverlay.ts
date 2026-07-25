import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

export class StopLossOverlay implements IAnalysisOverlay {
  readonly id = 'stop-loss'

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
    if (!this.lastData || !plan?.actionable || plan.invalidationLevel === null) return []

    const lit = this.lastHighlightKey === 'stop:loss' || this.lastHighlightKey === 'trade:full'

    return [{
      kind:             'hline',
      key:              'sl',
      price:            plan.invalidationLevel,
      color:            '#ef5350',
      lineWidth:        lit ? 4 : 2,
      lineStyle:        LineStyle.Solid,
      axisLabelVisible: true,
      title:            'SL',
      visible:          this.visible,
    }]
  }
}
