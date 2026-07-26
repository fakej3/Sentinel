import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const MAX_ZONES = 3

const SUPPORT_COLOR    = 'rgba(34, 197, 94, 0.22)'
const RESISTANCE_COLOR = 'rgba(239, 83, 80, 0.22)'
const SUPPORT_NEAR     = 'rgba(34, 197, 94, 0.60)'
const RESISTANCE_NEAR  = 'rgba(239, 83, 80, 0.60)'

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

    // Collect trade-plan price coords — S/R axis labels defer to these.
    // SL, Entry midpoint, and primary TP are all higher-priority labels.
    const tradePlanCoords: number[] = []
    const plan = this.lastData.tradePlan
    if (plan?.actionable) {
      if (plan.invalidationLevel !== null) {
        const c = this.engine?.priceToCoordinate(plan.invalidationLevel) ?? null
        if (c !== null) tradePlanCoords.push(c)
      }
      if (plan.entryZone) {
        const mid = (plan.entryZone.lower + plan.entryZone.upper) / 2
        const c = this.engine?.priceToCoordinate(mid) ?? null
        if (c !== null) tradePlanCoords.push(c)
      }
      if (plan.targetLevel !== null) {
        const c = this.engine?.priceToCoordinate(plan.targetLevel) ?? null
        if (c !== null) tradePlanCoords.push(c)
      }
    }

    const instructions: DrawingInstruction[] = []

    // Pixel-dedup within each side: skip lines that are within 6px of a
    // higher-strength zone already rendered. Zones arrive sorted nearest-first
    // (highest priority), so first-seen wins.
    const supportUsedCoords:    number[] = []
    const resistanceUsedCoords: number[] = []

    for (const zone of support) {
      const isNearest = zone.id === nearestSupportId
      const coord     = this.engine?.priceToCoordinate(zone.center) ?? null
      const pixelDup  = coord !== null && supportUsedCoords.some(c => Math.abs(c - coord) < 6)

      if (pixelDup) continue
      if (coord !== null) supportUsedCoords.push(coord)

      const lit = key === 'sr:all' || key === `sr:zone:${zone.id}` || (key === 'sr:nearest-support' && isNearest)
      const baseWidth: 1 | 2 = isNearest ? 2 : 1
      const lineWidth = (lit ? Math.min(baseWidth + 2, 4) : baseWidth) as 1 | 2 | 3 | 4
      const nearPlan  = isNearest && coord !== null && tradePlanCoords.some(c => Math.abs(c - coord) < 14)

      instructions.push({
        kind:             'hline',
        key:              `s_${zone.id}`,
        price:            zone.center,
        color:            isNearest ? SUPPORT_NEAR : SUPPORT_COLOR,
        lineWidth,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: isNearest && !nearPlan,
        title:            'S',
        visible:          this.visible,
      })
    }

    for (const zone of resistance) {
      const isNearest = zone.id === nearestResistanceId
      const coord     = this.engine?.priceToCoordinate(zone.center) ?? null
      const pixelDup  = coord !== null && resistanceUsedCoords.some(c => Math.abs(c - coord) < 6)

      if (pixelDup) continue
      if (coord !== null) resistanceUsedCoords.push(coord)

      const lit = key === 'sr:all' || key === `sr:zone:${zone.id}` || (key === 'sr:nearest-resistance' && isNearest)
      const baseWidth: 1 | 2 = isNearest ? 2 : 1
      const lineWidth = (lit ? Math.min(baseWidth + 2, 4) : baseWidth) as 1 | 2 | 3 | 4
      const nearPlan  = isNearest && coord !== null && tradePlanCoords.some(c => Math.abs(c - coord) < 14)

      instructions.push({
        kind:             'hline',
        key:              `r_${zone.id}`,
        price:            zone.center,
        color:            isNearest ? RESISTANCE_NEAR : RESISTANCE_COLOR,
        lineWidth,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: isNearest && !nearPlan,
        title:            'R',
        visible:          this.visible,
      })
    }

    return instructions
  }
}
