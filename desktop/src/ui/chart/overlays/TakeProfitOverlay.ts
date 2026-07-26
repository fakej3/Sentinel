import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TradePlan } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const TP_COLORS: [string, string, string] = ['#22c55e', 'rgba(34, 197, 94, 0.65)', 'rgba(34, 197, 94, 0.40)']

function isBullish(plan: TradePlan): boolean {
  return plan.entryZone !== null &&
    plan.invalidationLevel !== null &&
    plan.invalidationLevel < plan.entryZone.lower
}

export class TakeProfitOverlay implements IAnalysisOverlay {
  readonly id = 'take-profit'

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
    if (!this.lastData || !plan?.actionable || !plan.entryZone ||
        plan.invalidationLevel === null || plan.targetLevel === null) return []

    const bullish  = isBullish(plan)
    const entryMid = (plan.entryZone.lower + plan.entryZone.upper) / 2
    const risk     = Math.abs(entryMid - plan.invalidationLevel)

    const targets: number[] = [plan.targetLevel]
    const zones = bullish
      ? this.lastData.supportResistance.activeResistance
      : this.lastData.supportResistance.activeSupport

    for (const zone of zones) {
      if (targets.length >= 3) break
      const price = bullish ? zone.lower : zone.upper
      if (bullish ? price > plan.targetLevel : price < plan.targetLevel) {
        targets.push(price)
      }
    }

    // Pre-seed collision map with SL and Entry so TP labels avoid them.
    // SL and Entry axis labels are always rendered; TPs must work around them.
    const slCoord    = this.engine?.priceToCoordinate(plan.invalidationLevel) ?? null
    const entryCoord = this.engine?.priceToCoordinate(entryMid) ?? null
    const usedCoords: number[] = [
      ...(slCoord    !== null ? [slCoord]    : []),
      ...(entryCoord !== null ? [entryCoord] : []),
    ]

    const instructions: DrawingInstruction[] = []

    for (let i = 0; i < targets.length; i++) {
      const price    = targets[i]
      const rr       = risk > 0 ? (Math.abs(price - entryMid) / risk).toFixed(1) : '—'
      const coord    = this.engine?.priceToCoordinate(price) ?? null
      const tooClose = coord !== null && usedCoords.some(c => Math.abs(c - coord) < 14)
      const lit      = this.lastHighlightKey === 'trade:full' || this.lastHighlightKey === `tp:${i + 1}`

      instructions.push({
        kind:             'hline',
        key:              `tp${i + 1}`,
        price,
        color:            TP_COLORS[i],
        lineWidth:        lit ? 3 : (i === 0 ? 2 : 1),
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: !tooClose,
        title:            `TP${i + 1} ${rr}R`,
        visible:          this.visible,
      })

      if (!tooClose && coord !== null) usedCoords.push(coord)
    }

    return instructions
  }
}
