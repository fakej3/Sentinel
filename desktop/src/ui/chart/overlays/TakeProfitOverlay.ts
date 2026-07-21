import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
} from 'lightweight-charts'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TradePlan } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const TP_COLORS: [string, string, string] = ['#22c55e', '#16a34a', '#15803d']

function isBullish(plan: TradePlan): boolean {
  return plan.entryZone !== null &&
    plan.invalidationLevel !== null &&
    plan.invalidationLevel < plan.entryZone.lower
}

interface TpLine {
  line: IPriceLine
  index: number  // 0-based
}

export class TakeProfitOverlay implements IAnalysisOverlay {
  readonly id = 'take-profit'
  private chart: IChartApi | null = null
  private host: ISeriesApi<'Line'> | null = null
  private tpLines: TpLine[] = []

  mount(chart: IChartApi): void {
    this.chart = chart
    this.host = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    })
    this.host.setData([])
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const plan = data?.tradePlan
    if (!data || !plan?.actionable || !plan.entryZone || plan.invalidationLevel === null || plan.targetLevel === null) return

    const bullish = isBullish(plan)
    const entryMid = (plan.entryZone.lower + plan.entryZone.upper) / 2
    const risk = Math.abs(entryMid - plan.invalidationLevel)

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

    for (let i = 0; i < targets.length; i++) {
      const price = targets[i]
      const rr = risk > 0 ? (Math.abs(price - entryMid) / risk).toFixed(1) : '—'
      const line = this.host!.createPriceLine({
        price,
        color: TP_COLORS[i],
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `TP${i + 1} ${rr}R`,
      })
      this.tpLines.push({ line, index: i })
    }
  }

  highlight(key: string | null): void {
    for (const { line, index } of this.tpLines) {
      const lit =
        key === 'trade:full' ||
        key === `tp:${index + 1}`
      line.applyOptions({ lineWidth: lit ? 3 : 1 })
    }
  }

  private clearLines(): void {
    if (!this.host) return
    for (const { line } of this.tpLines) this.host.removePriceLine(line)
    this.tpLines = []
  }

  dispose(): void {
    this.clearLines()
    if (this.host && this.chart) this.chart.removeSeries(this.host)
    this.host = null
    this.chart = null
  }
}
