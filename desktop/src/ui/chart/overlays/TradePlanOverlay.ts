import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

/** Minimal trade-plan geometry: entry, invalidation, and the first two targets. */
export class TradePlanOverlay implements IAnalysisOverlay {
  readonly id = 'trade-plan'
  private engine: DrawingEngine | null = null
  private data: PipelineResult | null = null
  private range: ChartTimeRange | null = null
  private visible = true
  private highlightKey: string | null = null

  mount(engine: DrawingEngine): void { this.engine = engine }
  update(data: PipelineResult | null, range: ChartTimeRange | null): void { this.data = data; this.range = range; this.submit() }
  setVisible(visible: boolean): void { this.visible = visible; this.submit() }
  highlight(key: string | null): void { this.highlightKey = key; this.submit() }
  dispose(): void { this.engine?.clearLayer(this.id); this.engine = null }
  private submit(): void { this.engine?.render(this.id, this.buildInstructions()) }

  private buildInstructions(): DrawingInstruction[] {
    const plan = this.data?.tradePlan
    const range = this.range
    if (!plan?.actionable || !plan.entryZone || plan.direction === null ||
        plan.invalidationLevel === null || plan.targetLevel === null || !range) return []

    const candles = this.data?.candles ?? []
    const fromIndex = Math.max(0, candles.length - 18)
    const fromTime = Math.floor((candles[fromIndex]?.openTime ?? candles[0]?.openTime ?? 0) / 1000)
    const toTime = range.toSec
    const long = plan.direction === 'long'
    const focus = this.highlightKey === 'plan:all' || this.highlightKey === 'entry:zone'
    const current = candles.at(-1)?.close ?? 0
    const entryMid = (plan.entryZone.lower + plan.entryZone.upper) / 2
    const waiting = long ? current > plan.entryZone.upper : current < plan.entryZone.lower
    const out: DrawingInstruction[] = []

    // One compact entry zone is the visual centre of the plan.
    out.push({
      kind: 'zone',
      key: 'entry-zone',
      topPrice: plan.entryZone.upper,
      bottomPrice: plan.entryZone.lower,
      fillColor1: long ? 'rgba(34,197,94,0.065)' : 'rgba(239,68,68,0.065)',
      fillColor2: long ? 'rgba(34,197,94,0.018)' : 'rgba(239,68,68,0.018)',
      lineColor: long ? (focus ? 'rgba(34,197,94,0.75)' : 'rgba(34,197,94,0.38)') : (focus ? 'rgba(239,68,68,0.75)' : 'rgba(239,68,68,0.38)'),
      fromTime,
      toTime,
      visible: this.visible,
    })

    out.push({
      kind: 'hline',
      key: 'entry-mid',
      price: entryMid,
      color: long ? 'rgba(34,197,94,0.60)' : 'rgba(239,68,68,0.60)',
      lineWidth: focus ? 2 : 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: waiting ? (long ? 'LONG · WAIT' : 'SHORT · WAIT') : (long ? 'LONG ENTRY' : 'SHORT ENTRY'),
      visible: this.visible,
    })

    out.push({
      kind: 'hline',
      key: 'invalidation',
      price: plan.invalidationLevel,
      color: 'rgba(239,68,68,0.72)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'INVALIDATION',
      visible: this.visible,
    })

    // Keep the target story readable: T1 and at most one follow-through target.
    const targets = plan.targets.length ? plan.targets.slice(0, 2) : [plan.targetLevel]
    targets.forEach((target, i) => {
      out.push({
        kind: 'hline',
        key: `target-${i}`,
        price: target,
        color: i === 0 ? 'rgba(34,197,94,0.65)' : 'rgba(34,197,94,0.38)',
        lineWidth: i === 0 ? 1 : 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `T${i + 1}`,
        visible: this.visible,
      })
    })

    return out
  }
}
