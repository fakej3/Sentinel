import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { ZoneHandle, HorizontalLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TradePlan } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

function isBullish(plan: TradePlan): boolean {
  return plan.entryZone !== null &&
    plan.invalidationLevel !== null &&
    plan.invalidationLevel < plan.entryZone.lower
}

const RISK_DIM   = 'rgba(239, 83, 80, 0.08)'
const RISK_LIT   = 'rgba(239, 83, 80, 0.22)'
const REWARD_DIM = 'rgba(34, 197, 94, 0.08)'
const REWARD_LIT = 'rgba(34, 197, 94, 0.22)'

export class RiskRewardOverlay implements IAnalysisOverlay {
  readonly id = 'risk-reward'
  private engine:      DrawingEngine | null = null
  private riskZoneH:   ZoneHandle | null = null
  private rewardZoneH: ZoneHandle | null = null
  private rrLineH:     HorizontalLineHandle | null = null
  private lit = false

  mount(engine: DrawingEngine): void {
    this.engine      = engine
    this.riskZoneH   = engine.addZone({ topPrice: 0, bottomPrice: 0, fillColor1: RISK_DIM,   times: [] })
    this.rewardZoneH = engine.addZone({ topPrice: 0, bottomPrice: 0, fillColor1: REWARD_DIM, times: [] })
  }

  update(data: PipelineResult | null): void {
    this.clearLine()
    const plan = data?.tradePlan

    if (!data || !plan?.actionable || !plan.entryZone || plan.invalidationLevel === null || plan.targetLevel === null) {
      if (this.engine) {
        if (this.riskZoneH)   this.engine.updateZone(this.riskZoneH,   { times: [] })
        if (this.rewardZoneH) this.engine.updateZone(this.rewardZoneH, { times: [] })
      }
      return
    }
    if (!this.engine || !this.riskZoneH || !this.rewardZoneH) return

    const bullish = isBullish(plan)
    const { lower: entryLow, upper: entryHigh } = plan.entryZone
    const stop    = plan.invalidationLevel
    const tp      = plan.targetLevel
    const entryMid = (entryLow + entryHigh) / 2
    const risk     = Math.abs(entryMid - stop)
    const reward   = Math.abs(tp - entryMid)
    const rr       = risk > 0 ? (reward / risk).toFixed(2) : '—'

    const times = data.candles.slice(-80).map(c => Math.floor(c.openTime / 1000))

    if (bullish) {
      this.engine.updateZone(this.riskZoneH,   { topPrice: entryLow, bottomPrice: stop,      times })
      this.engine.updateZone(this.rewardZoneH, { topPrice: tp,       bottomPrice: entryHigh, times })
    } else {
      this.engine.updateZone(this.riskZoneH,   { topPrice: stop,     bottomPrice: entryHigh, times })
      this.engine.updateZone(this.rewardZoneH, { topPrice: entryLow, bottomPrice: tp,        times })
    }

    const rewardMid = (tp + (bullish ? entryHigh : entryLow)) / 2
    this.rrLineH = this.engine.addHorizontalLine({
      price:            rewardMid,
      color:            'rgba(0,0,0,0)',
      lineWidth:        1,
      lineStyle:        LineStyle.Dotted,
      axisLabelVisible: false,
      title:            `RR ${rr}`,
    })
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    if (this.riskZoneH)   this.engine.updateZone(this.riskZoneH,   { visible })
    if (this.rewardZoneH) this.engine.updateZone(this.rewardZoneH, { visible })
    if (this.rrLineH)     this.engine.updateHorizontalLine(this.rrLineH, { visible })
  }

  highlight(key: string | null): void {
    if (!this.engine) return
    const lit = key === 'trade:full' || key === 'entry:zone' || key === 'stop:loss' || (key?.startsWith('tp:') ?? false)
    if (lit === this.lit) return
    this.lit = lit
    if (this.riskZoneH)   this.engine.updateZone(this.riskZoneH,   { fillColor1: lit ? RISK_LIT   : RISK_DIM   })
    if (this.rewardZoneH) this.engine.updateZone(this.rewardZoneH, { fillColor1: lit ? REWARD_LIT : REWARD_DIM })
  }

  private clearLine(): void {
    if (this.rrLineH && this.engine) {
      this.engine.removeHorizontalLine(this.rrLineH)
      this.rrLineH = null
    }
    this.lit = false
  }

  dispose(): void {
    this.clearLine()
    if (this.engine) {
      if (this.riskZoneH)   this.engine.removeZone(this.riskZoneH)
      if (this.rewardZoneH) this.engine.removeZone(this.rewardZoneH)
    }
    this.riskZoneH   = null
    this.rewardZoneH = null
    this.engine      = null
  }
}
