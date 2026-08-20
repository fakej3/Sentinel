import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { PriceZone } from '../../../modules/support-resistance/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

/** Signal-first S/R: one nearest support + one nearest resistance. Everything else stays in Analysis. */
export class SupportResistanceOverlay implements IAnalysisOverlay {
  readonly id = 'sr'
  private engine: DrawingEngine | null = null
  private data: PipelineResult | null = null
  private range: ChartTimeRange | null = null
  private visible = true
  private highlightKey: string | null = null

  mount(engine: DrawingEngine): void { this.engine = engine }
  update(data: PipelineResult | null, range: ChartTimeRange | null): void {
    this.data = data
    this.range = range
    this.submit()
  }
  setVisible(visible: boolean): void { this.visible = visible; this.submit() }
  highlight(key: string | null): void { this.highlightKey = key; this.submit() }
  dispose(): void { this.engine?.clearLayer(this.id); this.engine = null }
  private submit(): void { this.engine?.render(this.id, this.buildInstructions()) }

  private zoneInstruction(zone: PriceZone, fromTime: number, toTime: number, highlighted: boolean): DrawingInstruction[] {
    const support = zone.type === 'support'
    const weakening = zone.state === 'weakening'
    const color = weakening ? '#f59e0b' : support ? '#22c55e' : '#ef4444'
    const fill = weakening ? 'rgba(245,158,11,0.035)' : support ? 'rgba(34,197,94,0.045)' : 'rgba(239,68,68,0.045)'
    return [
      {
        kind: 'zone',
        key: `zone-${zone.id}`,
        topPrice: zone.upper,
        bottomPrice: zone.lower,
        fillColor1: highlighted ? fill.replace('0.035', '0.08').replace('0.045', '0.08') : fill,
        fillColor2: weakening ? 'rgba(245,158,11,0.012)' : support ? 'rgba(34,197,94,0.012)' : 'rgba(239,68,68,0.012)',
        lineColor: highlighted ? color : weakening ? 'rgba(245,158,11,0.38)' : support ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)',
        fromTime,
        toTime,
        visible: this.visible,
      },
      {
        kind: 'hline',
        key: `zone-mid-${zone.id}`,
        price: zone.center,
        color: highlighted ? color : weakening ? 'rgba(245,158,11,0.52)' : support ? 'rgba(34,197,94,0.38)' : 'rgba(239,68,68,0.38)',
        lineWidth: highlighted ? 2 : 1,
        lineStyle: weakening ? LineStyle.Dashed : LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${support ? 'S' : 'R'}${weakening ? ' · weakening' : ''}`,
        visible: this.visible,
      },
    ]
  }

  private buildInstructions(): DrawingInstruction[] {
    const sr = this.data?.supportResistance
    if (!sr || !this.range) return []

    const candles = this.data?.candles ?? []
    const fromIndex = Math.max(0, candles.length - 30)
    const fromTime = Math.floor((candles[fromIndex]?.openTime ?? candles[0]?.openTime ?? 0) / 1000)
    const toTime = this.range.toSec
    const out: DrawingInstruction[] = []

    if (sr.nearestSupport) {
      out.push(...this.zoneInstruction(
        sr.nearestSupport,
        fromTime,
        toTime,
        this.highlightKey === 'sr:all' || this.highlightKey === 'sr:nearest-support' || this.highlightKey === `sr:zone:${sr.nearestSupport.id}`,
      ))
    }
    if (sr.nearestResistance) {
      out.push(...this.zoneInstruction(
        sr.nearestResistance,
        fromTime,
        toTime,
        this.highlightKey === 'sr:all' || this.highlightKey === 'sr:nearest-resistance' || this.highlightKey === `sr:zone:${sr.nearestResistance.id}`,
      ))
    }

    // When price is already inside a zone, make that single zone the focus.
    if (sr.currentZone) {
      out.push({
        kind: 'hline',
        key: `current-zone-${sr.currentZone.id}`,
        price: sr.currentZone.center,
        color: 'rgba(250,204,21,0.65)',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'CURRENT ZONE',
        visible: this.visible,
      })
    }

    return out
  }
}
