import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
} from 'lightweight-charts'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

export class StopLossOverlay implements IAnalysisOverlay {
  readonly id = 'stop-loss'
  private chart: IChartApi | null = null
  private host: ISeriesApi<'Line'> | null = null
  private line: IPriceLine | null = null

  mount(chart: IChartApi): void {
    this.chart = chart
    this.host = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    this.host.setData([])
  }

  update(data: PipelineResult | null): void {
    this.clearLine()
    const plan = data?.tradePlan
    if (!data || !plan?.actionable || plan.invalidationLevel === null) return

    this.line = this.host!.createPriceLine({
      price: plan.invalidationLevel,
      color: '#ef5350',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'Stop Loss',
    })
  }

  private clearLine(): void {
    if (this.line && this.host) {
      this.host.removePriceLine(this.line)
      this.line = null
    }
  }

  dispose(): void {
    this.clearLine()
    if (this.host && this.chart) this.chart.removeSeries(this.host)
    this.host = null
    this.chart = null
  }
}
