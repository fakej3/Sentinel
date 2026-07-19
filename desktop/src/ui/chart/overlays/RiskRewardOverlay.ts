import {
  BaselineSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TradePlan } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

function isBullish(plan: TradePlan): boolean {
  return plan.entryZone !== null &&
    plan.invalidationLevel !== null &&
    plan.invalidationLevel < plan.entryZone.lower
}

const FILL_BASE = {
  lineWidth: 1 as const,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
  topLineColor: 'transparent',
  bottomFillColor1: 'transparent',
  bottomFillColor2: 'transparent',
  bottomLineColor: 'transparent',
  baseValue: { type: 'price' as const, price: 0 },
}

export class RiskRewardOverlay implements IAnalysisOverlay {
  readonly id = 'risk-reward'
  private chart: IChartApi | null = null
  private riskFill: ISeriesApi<'Baseline'> | null = null
  private rewardFill: ISeriesApi<'Baseline'> | null = null
  private host: ISeriesApi<'Line'> | null = null
  private lines: IPriceLine[] = []

  mount(chart: IChartApi): void {
    this.chart = chart

    this.riskFill = chart.addSeries(BaselineSeries, {
      ...FILL_BASE,
      topFillColor1: 'rgba(239, 83, 80, 0.10)',
      topFillColor2: 'rgba(239, 83, 80, 0.10)',
    })
    this.riskFill.setData([])

    this.rewardFill = chart.addSeries(BaselineSeries, {
      ...FILL_BASE,
      topFillColor1: 'rgba(34, 197, 94, 0.10)',
      topFillColor2: 'rgba(34, 197, 94, 0.10)',
    })
    this.rewardFill.setData([])

    this.host = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    this.host.setData([])
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const plan = data?.tradePlan

    if (!data || !plan?.actionable || !plan.entryZone || plan.invalidationLevel === null || plan.targetLevel === null) {
      this.riskFill?.setData([])
      this.rewardFill?.setData([])
      return
    }

    const bullish = isBullish(plan)
    const { lower: entryLow, upper: entryHigh } = plan.entryZone
    const stop = plan.invalidationLevel
    const tp   = plan.targetLevel
    const entryMid = (entryLow + entryHigh) / 2
    const risk   = Math.abs(entryMid - stop)
    const reward = Math.abs(tp - entryMid)
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '—'

    const times = data.candles.map(c => Math.floor(c.openTime / 1000) as UTCTimestamp)

    if (bullish) {
      // Risk: from entryLow down to stop (top area, red fill)
      this.riskFill!.applyOptions({ baseValue: { type: 'price', price: stop } })
      this.riskFill!.setData(times.map(time => ({ time, value: entryLow })))
      // Reward: from tp down to entryHigh (top area, green fill)
      this.rewardFill!.applyOptions({ baseValue: { type: 'price', price: entryHigh } })
      this.rewardFill!.setData(times.map(time => ({ time, value: tp })))
    } else {
      // Risk: from stop down to entryHigh (top area, red fill)
      this.riskFill!.applyOptions({ baseValue: { type: 'price', price: entryHigh } })
      this.riskFill!.setData(times.map(time => ({ time, value: stop })))
      // Reward: from entryLow down to tp (top area, green fill)
      this.rewardFill!.applyOptions({ baseValue: { type: 'price', price: tp } })
      this.rewardFill!.setData(times.map(time => ({ time, value: entryLow })))
    }

    // Label lines — shown at box midpoints on the right axis
    const riskMid   = (stop + (bullish ? entryLow : entryHigh)) / 2
    const rewardMid = (tp   + (bullish ? entryHigh : entryLow)) / 2

    this.lines.push(this.host!.createPriceLine({
      price: riskMid,
      color: 'rgba(239, 83, 80, 0.6)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: 'Risk',
    }))
    this.lines.push(this.host!.createPriceLine({
      price: rewardMid,
      color: 'rgba(34, 197, 94, 0.6)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: `RR  ${rr}`,
    }))
  }

  private clearLines(): void {
    if (!this.host) return
    for (const line of this.lines) this.host.removePriceLine(line)
    this.lines = []
  }

  dispose(): void {
    this.clearLines()
    if (this.chart) {
      if (this.riskFill)   this.chart.removeSeries(this.riskFill)
      if (this.rewardFill) this.chart.removeSeries(this.rewardFill)
      if (this.host)       this.chart.removeSeries(this.host)
    }
    this.riskFill   = null
    this.rewardFill = null
    this.host       = null
    this.chart      = null
  }
}
