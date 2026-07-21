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

const MAX_ZONES = 3

// Distinct from candle teal — use a muted cyan for support, muted rose for resistance
const SUPPORT_COLOR    = 'rgba(34, 211, 238, 0.55)'   // cyan-400
const RESISTANCE_COLOR = 'rgba(248, 113, 113, 0.55)'  // red-400
const SUPPORT_NEAR     = 'rgba(34, 211, 238, 0.90)'
const RESISTANCE_NEAR  = 'rgba(248, 113, 113, 0.90)'

interface ZoneLine {
  line: IPriceLine
  zone: PriceZone
  isNearest: boolean
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
      autoscaleInfoProvider: () => null,
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
      const isNearest = zone.id === this.nearestSupportId
      const line = this.host.createPriceLine({
        price: zone.center,
        color: isNearest ? SUPPORT_NEAR : SUPPORT_COLOR,
        lineWidth: isNearest ? 2 : 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: isNearest,
        title: 'S',
      })
      this.zoneLines.push({ line, zone, isNearest })
    }

    for (const zone of resistance) {
      const isNearest = zone.id === this.nearestResistanceId
      const line = this.host.createPriceLine({
        price: zone.center,
        color: isNearest ? RESISTANCE_NEAR : RESISTANCE_COLOR,
        lineWidth: isNearest ? 2 : 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: isNearest,
        title: 'R',
      })
      this.zoneLines.push({ line, zone, isNearest })
    }
  }

  highlight(key: string | null): void {
    for (const { line, zone, isNearest } of this.zoneLines) {
      const isSupport = zone.id === this.nearestSupportId ||
        !this.zoneLines.some(z => z.zone.id === this.nearestResistanceId && z.zone.id === zone.id)
      const lit =
        key === 'sr:all' ||
        key === `sr:zone:${zone.id}` ||
        (key === 'sr:nearest-support'    && zone.id === this.nearestSupportId) ||
        (key === 'sr:nearest-resistance' && zone.id === this.nearestResistanceId)

      const baseWidth = isNearest ? 2 : 1
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
