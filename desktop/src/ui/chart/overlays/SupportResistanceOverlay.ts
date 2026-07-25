import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { HorizontalLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { PriceZone } from '../../../modules/support-resistance/types'
import type { IAnalysisOverlay } from '../types'

const MAX_ZONES = 3

const SUPPORT_COLOR    = 'rgba(34, 211, 238, 0.55)'
const RESISTANCE_COLOR = 'rgba(248, 113, 113, 0.55)'
const SUPPORT_NEAR     = 'rgba(34, 211, 238, 0.90)'
const RESISTANCE_NEAR  = 'rgba(248, 113, 113, 0.90)'

interface ZoneLine {
  line: HorizontalLineHandle
  zone: PriceZone
  isNearest: boolean
}

export class SupportResistanceOverlay implements IAnalysisOverlay {
  readonly id = 'sr'
  private engine: DrawingEngine | null = null
  private zoneLines: ZoneLine[] = []
  private nearestSupportId: string | null = null
  private nearestResistanceId: string | null = null

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    if (!data || !this.engine) return

    this.nearestSupportId    = data.supportResistance.nearestSupport?.id ?? null
    this.nearestResistanceId = data.supportResistance.nearestResistance?.id ?? null

    const support    = data.supportResistance.activeSupport.slice(0, MAX_ZONES)
    const resistance = data.supportResistance.activeResistance.slice(0, MAX_ZONES)

    for (const zone of support) {
      const isNearest = zone.id === this.nearestSupportId
      const line = this.engine.addHorizontalLine({
        price:            zone.center,
        color:            isNearest ? SUPPORT_NEAR : SUPPORT_COLOR,
        lineWidth:        isNearest ? 2 : 1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: isNearest,
        title:            'S',
      })
      this.zoneLines.push({ line, zone, isNearest })
    }

    for (const zone of resistance) {
      const isNearest = zone.id === this.nearestResistanceId
      const line = this.engine.addHorizontalLine({
        price:            zone.center,
        color:            isNearest ? RESISTANCE_NEAR : RESISTANCE_COLOR,
        lineWidth:        isNearest ? 2 : 1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: isNearest,
        title:            'R',
      })
      this.zoneLines.push({ line, zone, isNearest })
    }
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    for (const { line } of this.zoneLines) this.engine.updateHorizontalLine(line, { visible })
  }

  highlight(key: string | null): void {
    if (!this.engine) return
    for (const { line, zone, isNearest } of this.zoneLines) {
      const lit =
        key === 'sr:all' ||
        key === `sr:zone:${zone.id}` ||
        (key === 'sr:nearest-support'    && zone.id === this.nearestSupportId) ||
        (key === 'sr:nearest-resistance' && zone.id === this.nearestResistanceId)

      const baseWidth = isNearest ? 2 : 1
      const w = (lit ? Math.min(baseWidth + 2, 4) : baseWidth) as 1 | 2 | 3 | 4
      this.engine.updateHorizontalLine(line, { lineWidth: w })
    }
  }

  private clearLines(): void {
    if (!this.engine) return
    for (const { line } of this.zoneLines) this.engine.removeHorizontalLine(line)
    this.zoneLines = []
    this.nearestSupportId    = null
    this.nearestResistanceId = null
  }

  dispose(): void {
    this.clearLines()
    this.engine = null
  }
}
