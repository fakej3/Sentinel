import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { HorizontalLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TradePlan } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const TP_COLORS: [string, string, string] = ['#22c55e', 'rgba(34, 197, 94, 0.65)', 'rgba(34, 197, 94, 0.40)']

function isBullish(plan: TradePlan): boolean {
  return plan.entryZone !== null &&
    plan.invalidationLevel !== null &&
    plan.invalidationLevel < plan.entryZone.lower
}

interface TpLine {
  line: HorizontalLineHandle
  index: number
}

export class TakeProfitOverlay implements IAnalysisOverlay {
  readonly id = 'take-profit'
  private engine: DrawingEngine | null = null
  private tpLines: TpLine[] = []

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const plan = data?.tradePlan
    if (!data || !plan?.actionable || !plan.entryZone || plan.invalidationLevel === null || plan.targetLevel === null) return
    if (!this.engine) return

    const bullish  = isBullish(plan)
    const entryMid = (plan.entryZone.lower + plan.entryZone.upper) / 2
    const risk     = Math.abs(entryMid - plan.invalidationLevel)

    const targets: number[] = [plan.targetLevel]

    const zones = bullish
      ? data.supportResistance.activeResistance
      : data.supportResistance.activeSupport

    for (const zone of zones) {
      if (targets.length >= 3) break
      const price = bullish ? zone.lower : zone.upper
      if (bullish ? price > plan.targetLevel : price < plan.targetLevel) {
        targets.push(price)
      }
    }

    const usedCoords: number[] = []
    for (let i = 0; i < targets.length; i++) {
      const price    = targets[i]
      const rr       = risk > 0 ? (Math.abs(price - entryMid) / risk).toFixed(1) : '—'
      const coord    = this.engine.priceToCoordinate(price)
      const tooClose = coord !== null && usedCoords.some(c => Math.abs(c - coord) < 14)
      const line     = this.engine.addHorizontalLine({
        price,
        color:            TP_COLORS[i],
        lineWidth:        1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: !tooClose,
        title:            `TP${i + 1} ${rr}R`,
      })
      if (!tooClose && coord !== null) usedCoords.push(coord)
      this.tpLines.push({ line, index: i })
    }
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    for (const { line } of this.tpLines) this.engine.updateHorizontalLine(line, { visible })
  }

  highlight(key: string | null): void {
    if (!this.engine) return
    for (const { line, index } of this.tpLines) {
      const lit = key === 'trade:full' || key === `tp:${index + 1}`
      this.engine.updateHorizontalLine(line, { lineWidth: lit ? 3 : 1 })
    }
  }

  private clearLines(): void {
    if (!this.engine) return
    for (const { line } of this.tpLines) this.engine.removeHorizontalLine(line)
    this.tpLines = []
  }

  dispose(): void {
    this.clearLines()
    this.engine = null
  }
}
