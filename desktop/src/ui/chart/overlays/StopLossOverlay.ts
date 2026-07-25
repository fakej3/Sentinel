import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { SeriesHandle, PriceLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

export class StopLossOverlay implements IAnalysisOverlay {
  readonly id = 'stop-loss'
  private engine: DrawingEngine | null = null
  private hostH: SeriesHandle | null = null
  private lineH: PriceLineHandle | null = null
  private lit = false

  mount(engine: DrawingEngine): void {
    this.engine = engine
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
    this.clearLine()
    const plan = data?.tradePlan
    if (!data || !plan?.actionable || plan.invalidationLevel === null || !this.engine || !this.hostH) return

    this.lineH = this.engine.addPriceLine(this.hostH, {
      price:            plan.invalidationLevel,
      color:            '#ef5350',
      lineWidth:        2,
      lineStyle:        LineStyle.Solid,
      axisLabelVisible: true,
      title:            'SL',
    })
  }

  setVisible(visible: boolean): void {
    if (this.engine && this.hostH) this.engine.applySeriesOptions(this.hostH, { visible })
  }

  highlight(key: string | null): void {
    if (!this.lineH || !this.engine) return
    const lit = key === 'stop:loss' || key === 'trade:full'
    if (lit === this.lit) return
    this.lit = lit
    this.engine.updatePriceLine(this.lineH, { lineWidth: lit ? 4 : 2 })
  }

  private clearLine(): void {
    if (this.lineH && this.engine) {
      this.engine.removePriceLine(this.lineH)
      this.lineH = null
    }
    this.lit = false
  }

  dispose(): void {
    this.clearLine()
    if (this.engine && this.hostH) this.engine.removeSeries(this.hostH)
    this.hostH  = null
    this.engine = null
  }
}
