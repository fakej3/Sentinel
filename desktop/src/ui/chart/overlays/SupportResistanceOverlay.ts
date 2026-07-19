import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
} from 'lightweight-charts'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay } from '../types'

const MAX_ZONES = 8

export class SupportResistanceOverlay implements IAnalysisOverlay {
  readonly id = 'sr'
  private chart: IChartApi | null = null
  private host: ISeriesApi<'Line'> | null = null
  private lines: IPriceLine[] = []

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
    this.clearLines()
    if (!data || !this.host) return

    const support    = data.supportResistance.activeSupport.slice(0, MAX_ZONES)
    const resistance = data.supportResistance.activeResistance.slice(0, MAX_ZONES)

    for (const zone of support) {
      this.lines.push(this.host.createPriceLine({
        price: zone.center,
        color: '#26a69a',
        lineWidth: zone.strength >= 7 ? 2 : 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `S  ${zone.strength.toFixed(1)}`,
      }))
    }

    for (const zone of resistance) {
      this.lines.push(this.host.createPriceLine({
        price: zone.center,
        color: '#ef5350',
        lineWidth: zone.strength >= 7 ? 2 : 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `R  ${zone.strength.toFixed(1)}`,
      }))
    }
  }

  private clearLines(): void {
    if (!this.host) return
    for (const line of this.lines) this.host.removePriceLine(line)
    this.lines = []
  }

  dispose(): void {
    this.clearLines()
    if (this.host && this.chart) this.chart.removeSeries(this.host)
    this.host = null
    this.chart = null
  }
}
