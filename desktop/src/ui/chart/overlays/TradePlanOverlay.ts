import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

/**
 * Future trade-plan projection.
 *
 * The pipeline owns the levels and direction. This overlay only renders them.
 * It deliberately renders a projection even when the setup is not actionable
 * yet: that is how the chart communicates "bullish, but wait for the entry"
 * without inventing a second signal.
 */
export class TradePlanOverlay implements IAnalysisOverlay {
  readonly id = 'trade-plan'
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

  private buildInstructions(): DrawingInstruction[] {
    const plan = this.data?.tradePlan
    const range = this.range
    const candles = this.data?.candles ?? []

    if (!plan || !range || candles.length === 0 ||
        plan.direction === null ||
        !plan.entryZone ||
        plan.invalidationLevel === null ||
        plan.targetLevel === null) {
      return []
    }

    const { lower, upper } = plan.entryZone
    const invalidation = plan.invalidationLevel
    const target = plan.targetLevel
    const long = plan.direction === 'long'

    // Never draw geometrically invalid plans. This is a rendering invariant,
    // not a re-derivation of signal logic.
    const geometryValid = long
      ? invalidation < lower && lower < upper && upper < target
      : target < lower && lower < upper && upper < invalidation
    if (!geometryValid) return []

    // Projection begins at the live edge and uses the chart's existing right
    // offset. It therefore points into the future instead of painting a box
    // over the historical candles.
    const last = candles[candles.length - 1]
    const fromTime = Math.floor(last.openTime / 1000)
    const toTime = range.toSec
    if (fromTime >= toTime) return []

    const focused = this.highlightKey === 'plan:all' || this.highlightKey === 'entry:zone'
    const actionable = plan.actionable
    const entryMid = (lower + upper) / 2
    const current = last.close
    const waiting = long ? current > upper : current < lower
    const title = actionable
      ? (long ? 'LONG PLAN' : 'SHORT PLAN')
      : waiting
        ? (long ? 'LONG · WAIT' : 'SHORT · WAIT')
        : (long ? 'LONG · SETUP' : 'SHORT · SETUP')

    const green = focused ? 'rgba(34,197,94,0.16)' : 'rgba(34,197,94,0.105)'
    const greenFade = 'rgba(34,197,94,0.025)'
    const red = focused ? 'rgba(239,68,68,0.16)' : 'rgba(239,68,68,0.105)'
    const redFade = 'rgba(239,68,68,0.025)'
    const entryFill = focused ? 'rgba(59,130,246,0.09)' : 'rgba(59,130,246,0.045)'

    const out: DrawingInstruction[] = []

    // Classic long/short-position geometry: green is the projected reward,
    // red is the projected invalidation risk. The entry band stays neutral so
    // the chart never implies that the current price is the entry price.
    if (long) {
      out.push({
        kind: 'zone',
        key: 'projection-target',
        topPrice: target,
        bottomPrice: upper,
        fillColor1: green,
        fillColor2: greenFade,
        lineColor: focused ? 'rgba(34,197,94,0.55)' : 'rgba(34,197,94,0.28)',
        fromTime,
        toTime,
        visible: this.visible,
      })
      out.push({
        kind: 'zone',
        key: 'projection-stop',
        topPrice: lower,
        bottomPrice: invalidation,
        fillColor1: red,
        fillColor2: redFade,
        lineColor: focused ? 'rgba(239,68,68,0.55)' : 'rgba(239,68,68,0.28)',
        fromTime,
        toTime,
        visible: this.visible,
      })
    } else {
      out.push({
        kind: 'zone',
        key: 'projection-target',
        topPrice: lower,
        bottomPrice: target,
        fillColor1: green,
        fillColor2: greenFade,
        lineColor: focused ? 'rgba(34,197,94,0.55)' : 'rgba(34,197,94,0.28)',
        fromTime,
        toTime,
        visible: this.visible,
      })
      out.push({
        kind: 'zone',
        key: 'projection-stop',
        topPrice: invalidation,
        bottomPrice: upper,
        fillColor1: red,
        fillColor2: redFade,
        lineColor: focused ? 'rgba(239,68,68,0.55)' : 'rgba(239,68,68,0.28)',
        fromTime,
        toTime,
        visible: this.visible,
      })
    }

    // Keep the entry area visually distinct without another large historical
    // rectangle. It occupies only the same future projection window.
    out.push({
      kind: 'zone',
      key: 'projection-entry',
      topPrice: upper,
      bottomPrice: lower,
      fillColor1: entryFill,
      fillColor2: 'rgba(59,130,246,0.01)',
      lineColor: focused ? 'rgba(96,165,250,0.60)' : 'rgba(96,165,250,0.30)',
      fromTime,
      toTime,
      visible: this.visible,
    })

    // Axis labels are the only full-width elements in this layer. Keep the
    // lines faint so the green/red future box remains the primary visual.
    out.push({
      kind: 'hline',
      key: 'projection-entry-mid',
      price: entryMid,
      color: focused ? 'rgba(96,165,250,0.55)' : 'rgba(96,165,250,0.22)',
      lineWidth: focused ? 2 : 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title,
      visible: this.visible,
    })
    out.push({
      kind: 'hline',
      key: 'projection-stop-label',
      price: invalidation,
      color: focused ? 'rgba(239,68,68,0.50)' : 'rgba(239,68,68,0.18)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'SL',
      visible: this.visible,
    })
    out.push({
      kind: 'hline',
      key: 'projection-target-label',
      price: target,
      color: focused ? 'rgba(34,197,94,0.50)' : 'rgba(34,197,94,0.18)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'TP1',
      visible: this.visible,
    })

    return out
  }
}
