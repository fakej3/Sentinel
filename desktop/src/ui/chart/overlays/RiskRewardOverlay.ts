import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TradePlan } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

function isBullish(plan: TradePlan): boolean {
  return plan.entryZone !== null &&
    plan.invalidationLevel !== null &&
    plan.invalidationLevel < plan.entryZone.lower
}

const RISK_DIM        = 'rgba(239, 83, 80, 0.15)'
const RISK_LIT        = 'rgba(239, 83, 80, 0.28)'
const RISK_EDGE_DIM   = 'rgba(239, 83, 80, 0.35)'
const RISK_EDGE_LIT   = 'rgba(239, 83, 80, 0.70)'
const REWARD_DIM      = 'rgba(34, 197, 94, 0.15)'
const REWARD_LIT      = 'rgba(34, 197, 94, 0.28)'
const REWARD_EDGE_DIM = 'rgba(34, 197, 94, 0.35)'
const REWARD_EDGE_LIT = 'rgba(34, 197, 94, 0.70)'

export class RiskRewardOverlay implements IAnalysisOverlay {
  readonly id = 'risk-reward'

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

    const lit = this.lastHighlightKey === 'trade:full' ||
                this.lastHighlightKey === 'entry:zone' ||
                this.lastHighlightKey === 'stop:loss'  ||
                (this.lastHighlightKey?.startsWith('tp:') ?? false)

    const bullish  = isBullish(plan)
    const { lower: entryLow, upper: entryHigh } = plan.entryZone
    const stop     = plan.invalidationLevel
    const tp       = plan.targetLevel
    const entryMid = (entryLow + entryHigh) / 2
    const risk     = Math.abs(entryMid - stop)
    const reward   = Math.abs(tp - entryMid)
    const rr       = risk > 0 ? (reward / risk).toFixed(2) : '—'

    const allCandles   = this.lastData.candles
    const fromTime     = Math.floor(allCandles[0].openTime / 1000)
    const toTime       = Math.floor(allCandles[allCandles.length - 1].openTime / 1000)
    const rewardMid    = (tp + (bullish ? entryHigh : entryLow)) / 2
    const riskColor    = lit ? RISK_LIT        : RISK_DIM
    const riskEdge     = lit ? RISK_EDGE_LIT   : RISK_EDGE_DIM
    const rewardColor  = lit ? REWARD_LIT      : REWARD_DIM
    const rewardEdge   = lit ? REWARD_EDGE_LIT : REWARD_EDGE_DIM

    return [
      {
        kind: 'zone',
        key:  'risk',
        topPrice:    bullish ? entryLow : stop,
        bottomPrice: bullish ? stop     : entryHigh,
        fillColor1:  riskColor,
        lineColor:   riskEdge,
        fromTime,
        toTime,
        visible: this.visible,
      },
      {
        kind: 'zone',
        key:  'reward',
        topPrice:    bullish ? tp       : entryLow,
        bottomPrice: bullish ? entryHigh : tp,
        fillColor1:  rewardColor,
        lineColor:   rewardEdge,
        fromTime,
        toTime,
        visible: this.visible,
      },
      {
        kind:             'hline',
        key:              'rr-label',
        price:            rewardMid,
        color:            'rgba(0,0,0,0)',
        lineWidth:        1,
        lineStyle:        LineStyle.Dotted,
        axisLabelVisible: false,
        title:            `RR ${rr}`,
        visible:          this.visible,
      },
    ]
  }
}
