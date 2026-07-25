import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { SeriesHandle, PriceLineHandle } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TradePlan } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

function isBullish(plan: TradePlan): boolean {
  return plan.entryZone !== null &&
    plan.invalidationLevel !== null &&
    plan.invalidationLevel < plan.entryZone.lower
}

const RISK_DIM   = { topFillColor1: 'rgba(239, 83, 80, 0.08)',  topFillColor2: 'rgba(239, 83, 80, 0.08)'  } as const
const RISK_LIT   = { topFillColor1: 'rgba(239, 83, 80, 0.22)',  topFillColor2: 'rgba(239, 83, 80, 0.22)'  } as const
const REWARD_DIM = { topFillColor1: 'rgba(34, 197, 94, 0.08)',  topFillColor2: 'rgba(34, 197, 94, 0.08)'  } as const
const REWARD_LIT = { topFillColor1: 'rgba(34, 197, 94, 0.22)',  topFillColor2: 'rgba(34, 197, 94, 0.22)'  } as const

const FILL_BASE_CFG = {
  topLineColor:         'transparent' as const,
  bottomFillColor1:     'transparent' as const,
  bottomFillColor2:     'transparent' as const,
  bottomLineColor:      'transparent' as const,
  lineWidth:            1 as const,
  priceLineVisible:     false,
  lastValueVisible:     false,
  crosshairMarkerVisible: false,
  excludeFromAutoscale: true,
}

export class RiskRewardOverlay implements IAnalysisOverlay {
  readonly id = 'risk-reward'
  private engine: DrawingEngine | null = null
  private riskFillH: SeriesHandle | null = null
  private rewardFillH: SeriesHandle | null = null
  private hostH: SeriesHandle | null = null
  private lines: PriceLineHandle[] = []
  private lit = false

  mount(engine: DrawingEngine): void {
    this.engine = engine

    this.riskFillH = engine.addBaselineSeries({ baseValue: 0, ...FILL_BASE_CFG, ...RISK_DIM })
    engine.setData(this.riskFillH, [])

    this.rewardFillH = engine.addBaselineSeries({ baseValue: 0, ...FILL_BASE_CFG, ...REWARD_DIM })
    engine.setData(this.rewardFillH, [])

    this.hostH = engine.addLineSeries({
      color:                  'rgba(0,0,0,0)',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale:   true,
    })
    engine.setData(this.hostH, [])
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const plan = data?.tradePlan

    if (!data || !plan?.actionable || !plan.entryZone || plan.invalidationLevel === null || plan.targetLevel === null) {
      if (this.engine) {
        if (this.riskFillH)   this.engine.setData(this.riskFillH, [])
        if (this.rewardFillH) this.engine.setData(this.rewardFillH, [])
      }
      return
    }
    if (!this.engine || !this.riskFillH || !this.rewardFillH || !this.hostH) return

    const bullish = isBullish(plan)
    const { lower: entryLow, upper: entryHigh } = plan.entryZone
    const stop = plan.invalidationLevel
    const tp   = plan.targetLevel
    const entryMid = (entryLow + entryHigh) / 2
    const risk   = Math.abs(entryMid - stop)
    const reward = Math.abs(tp - entryMid)
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '—'

    // Fills only over the most recent 80 candles so they don't colour all history
    const recentCandles = data.candles.slice(-80)
    const times = recentCandles.map(c => Math.floor(c.openTime / 1000))

    if (bullish) {
      this.engine.applySeriesOptions(this.riskFillH, { ...RISK_DIM, baseValue: { type: 'price', price: stop } })
      this.engine.setData(this.riskFillH, times.map(time => ({ time, value: entryLow })))
      this.engine.applySeriesOptions(this.rewardFillH, { ...REWARD_DIM, baseValue: { type: 'price', price: entryHigh } })
      this.engine.setData(this.rewardFillH, times.map(time => ({ time, value: tp })))
    } else {
      this.engine.applySeriesOptions(this.riskFillH, { ...RISK_DIM, baseValue: { type: 'price', price: entryHigh } })
      this.engine.setData(this.riskFillH, times.map(time => ({ time, value: stop })))
      this.engine.applySeriesOptions(this.rewardFillH, { ...REWARD_DIM, baseValue: { type: 'price', price: tp } })
      this.engine.setData(this.rewardFillH, times.map(time => ({ time, value: entryLow })))
    }

    // Single RR label — no mid-zone dotted lines (clutter)
    const rewardMid = (tp + (bullish ? entryHigh : entryLow)) / 2
    this.lines.push(this.engine.addPriceLine(this.hostH, {
      price:            rewardMid,
      color:            'rgba(0,0,0,0)',
      lineWidth:        1,
      lineStyle:        LineStyle.Dotted,
      axisLabelVisible: false,
      title:            `RR ${rr}`,
    }))
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    if (this.riskFillH)   this.engine.applySeriesOptions(this.riskFillH, { visible })
    if (this.rewardFillH) this.engine.applySeriesOptions(this.rewardFillH, { visible })
    if (this.hostH)       this.engine.applySeriesOptions(this.hostH, { visible })
  }

  highlight(key: string | null): void {
    if (!this.engine) return
    const lit = key === 'trade:full' || key === 'entry:zone' || key === 'stop:loss' || (key?.startsWith('tp:') ?? false)
    if (lit === this.lit) return
    this.lit = lit
    if (this.riskFillH)   this.engine.applySeriesOptions(this.riskFillH, lit ? RISK_LIT : RISK_DIM)
    if (this.rewardFillH) this.engine.applySeriesOptions(this.rewardFillH, lit ? REWARD_LIT : REWARD_DIM)
  }

  private clearLines(): void {
    if (!this.engine) return
    for (const lineH of this.lines) this.engine.removePriceLine(lineH)
    this.lines = []
    this.lit = false
  }

  dispose(): void {
    this.clearLines()
    if (this.engine) {
      if (this.riskFillH)   this.engine.removeSeries(this.riskFillH)
      if (this.rewardFillH) this.engine.removeSeries(this.rewardFillH)
      if (this.hostH)       this.engine.removeSeries(this.hostH)
    }
    this.riskFillH   = null
    this.rewardFillH = null
    this.hostH       = null
    this.engine      = null
  }
}
