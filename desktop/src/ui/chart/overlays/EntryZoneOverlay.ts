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
import type { IAnalysisOverlay } from '../types'

export class EntryZoneOverlay implements IAnalysisOverlay {
  readonly id = 'entry-zone'
  private chart: IChartApi | null = null
  private fill: ISeriesApi<'Baseline'> | null = null
  private host: ISeriesApi<'Line'> | null = null
  private lines: IPriceLine[] = []

  mount(chart: IChartApi): void {
    this.chart = chart

    this.fill = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topFillColor1: 'rgba(59, 130, 246, 0.12)',
      topFillColor2: 'rgba(59, 130, 246, 0.12)',
      topLineColor: 'rgba(59, 130, 246, 0.5)',
      bottomFillColor1: 'transparent',
      bottomFillColor2: 'transparent',
      bottomLineColor: 'transparent',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    this.fill.setData([])

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

    if (!data || !plan?.actionable || !plan.entryZone) {
      this.fill?.setData([])
      return
    }

    const { lower, upper } = plan.entryZone

    this.fill!.applyOptions({ baseValue: { type: 'price', price: lower } })
    this.fill!.setData(data.candles.map(c => ({
      time: Math.floor(c.openTime / 1000) as UTCTimestamp,
      value: upper,
    })))

    this.lines.push(this.host!.createPriceLine({
      price: lower,
      color: '#3b82f6',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Entry Low',
    }))
    this.lines.push(this.host!.createPriceLine({
      price: upper,
      color: '#3b82f6',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Entry High',
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
      if (this.fill) this.chart.removeSeries(this.fill)
      if (this.host) this.chart.removeSeries(this.host)
    }
    this.fill = null
    this.host = null
    this.chart = null
  }
}
