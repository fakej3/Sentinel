import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const MAX_ZONES = 3

const SUPPORT_COLOR    = 'rgba(34, 211, 238, 0.55)'
const RESISTANCE_COLOR = 'rgba(248, 113, 113, 0.55)'
const SUPPORT_NEAR     = 'rgba(34, 211, 238, 0.90)'
const RESISTANCE_NEAR  = 'rgba(248, 113, 113, 0.90)'

export class SupportResistanceOverlay implements IAnalysisOverlay {
  readonly id = 'sr'

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
    if (!this.lastData) return []

    const nearestSupportId    = this.lastData.supportResistance.nearestSupport?.id    ?? null
    const nearestResistanceId = this.lastData.supportResistance.nearestResistance?.id ?? null
    const key                 = this.lastHighlightKey

    const support    = this.lastData.supportResistance.activeSupport.slice(0, MAX_ZONES)
    const resistance = this.lastData.supportResistance.activeResistance.slice(0, MAX_ZONES)

    const instructions: DrawingInstruction[] = []

    for (const zone of support) {
      const isNearest = zone.id === nearestSupportId
      const lit = key === 'sr:all' || key === `sr:zone:${zone.id}` || (key === 'sr:nearest-support' && isNearest)
      const baseWidth: 1 | 2 = isNearest ? 2 : 1
      const lineWidth = (lit ? Math.min(baseWidth + 2, 4) : baseWidth) as 1 | 2 | 3 | 4
      instructions.push({
        kind:             'hline',
        key:              `s_${zone.id}`,
        price:            zone.center,
        color:            isNearest ? SUPPORT_NEAR : SUPPORT_COLOR,
        lineWidth,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: isNearest,
        title:            'S',
        visible:          this.visible,
      })
    }

    for (const zone of resistance) {
      const isNearest = zone.id === nearestResistanceId
      const lit = key === 'sr:all' || key === `sr:zone:${zone.id}` || (key === 'sr:nearest-resistance' && isNearest)
      const baseWidth: 1 | 2 = isNearest ? 2 : 1
      const lineWidth = (lit ? Math.min(baseWidth + 2, 4) : baseWidth) as 1 | 2 | 3 | 4
      instructions.push({
        kind:             'hline',
        key:              `r_${zone.id}`,
        price:            zone.center,
        color:            isNearest ? RESISTANCE_NEAR : RESISTANCE_COLOR,
        lineWidth,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: isNearest,
        title:            'R',
        visible:          this.visible,
      })
    }

    return instructions
  }
}
