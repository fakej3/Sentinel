import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { HorizontalLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

export class StopLossOverlay implements IAnalysisOverlay {
  readonly id = 'stop-loss'
  private engine: DrawingEngine | null = null
  private lineH: HorizontalLineHandle | null = null
  private lit = false

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null): void {
    this.clearLine()
    const plan = data?.tradePlan
    if (!data || !plan?.actionable || plan.invalidationLevel === null || !this.engine) return

    this.lineH = this.engine.addHorizontalLine({
      price:            plan.invalidationLevel,
      color:            '#ef5350',
      lineWidth:        2,
      lineStyle:        LineStyle.Solid,
      axisLabelVisible: true,
      title:            'SL',
    })
  }

  setVisible(visible: boolean): void {
    if (this.lineH && this.engine) this.engine.updateHorizontalLine(this.lineH, { visible })
  }

  highlight(key: string | null): void {
    if (!this.lineH || !this.engine) return
    const lit = key === 'stop:loss' || key === 'trade:full'
    if (lit === this.lit) return
    this.lit = lit
    this.engine.updateHorizontalLine(this.lineH, { lineWidth: lit ? 4 : 2 })
  }

  private clearLine(): void {
    if (this.lineH && this.engine) {
      this.engine.removeHorizontalLine(this.lineH)
      this.lineH = null
    }
    this.lit = false
  }

  dispose(): void {
    this.clearLine()
    this.engine = null
  }
}
