import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
} from 'lightweight-charts'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { PriceZone } from '../../../modules/support-resistance/types'
import type { IAnalysisOverlay } from '../types'

const MAX_ZONES = 5

interface ZoneLine {
  line: IPriceLine
  zone: PriceZone
  baseWidth: 1 | 2
}

export class SupportResistanceOverlay implements IAnalysisOverlay {
  readonly id = 'sr'
  private chart: IChartApi | null = null
  private host: ISeriesApi<'Line'> | null = null
  private zoneLines: ZoneLine[] = []
  private nearestSupportId: string | null = null
  private nearestResistanceId: string | null = null

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

    this.nearestSupportId    = data.supportResistance.nearestSupport?.id ?? null
    this.nearestResistanceId = data.supportResistance.nearestResistance?.id ?? null

    const support    = data.supportResistance.activeSupport.slice(0, MAX_ZONES)
    const resistance = data.supportResistance.activeResistance.slice(0, MAX_ZONES)

    for (const zone of support) {
      const baseWidth: 1 | 2 = zone.strength >= 7 ? 2 : 1
      const line = this.host.createPriceLine({
        price: zone.center,
        color: '#26a69a',
        lineWidth: baseWidth,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `S  ${zone.strength.toFixed(1)}`,
      })
      this.zoneLines.push({ line, zone, baseWidth })
    }

    for (const zone of resistance) {
      const baseWidth: 1 | 2 = zone.strength >= 7 ? 2 : 1
      const line = this.host.createPriceLine({
        price: zone.center,
        color: '#ef5350',
        lineWidth: baseWidth,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `R  ${zone.strength.toFixed(1)}`,
      })
      this.zoneLines.push({ line, zone, baseWidth })
    }
  }

  highlight(key: string | null): void {
    for (const { line, zone, baseWidth } of this.zoneLines) {
      const lit =
        key === 'sr:all' ||
        key === `sr:zone:${zone.id}` ||
        (key === 'sr:nearest-support'    && zone.id === this.nearestSupportId) ||
        (key === 'sr:nearest-resistance' && zone.id === this.nearestResistanceId)

      const w = lit ? Math.min(baseWidth + 2, 4) as 1 | 2 | 3 | 4 : baseWidth
      line.applyOptions({ lineWidth: w })
    }
  }

  private clearLines(): void {
    if (!this.host) return
    for (const { line } of this.zoneLines) this.host.removePriceLine(line)
    this.zoneLines = []
    this.nearestSupportId    = null
    this.nearestResistanceId = null
  }

  dispose(): void {
    this.clearLines()
    if (this.host && this.chart) this.chart.removeSeries(this.host)
    this.host = null
    this.chart = null
  }
}
