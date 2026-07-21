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

// Zone center lines (solid, labeled on axis)
const SUPPORT_CENTER    = '#22c55e'
const RESISTANCE_CENTER = '#ef5350'
// Zone boundary lines (dotted, dim, no axis label)
const SUPPORT_EDGE    = 'rgba(34, 197, 94, 0.28)'
const RESISTANCE_EDGE = 'rgba(239, 83, 80, 0.28)'
// Brightened boundary on highlight
const SUPPORT_EDGE_LIT    = 'rgba(34, 197, 94, 0.55)'
const RESISTANCE_EDGE_LIT = 'rgba(239, 83, 80, 0.55)'

interface ZoneEntry {
  centerLine: IPriceLine
  upperLine:  IPriceLine
  lowerLine:  IPriceLine
  zone:       PriceZone
  baseWidth:  1 | 2
}

export class SupportResistanceOverlay implements IAnalysisOverlay {
  readonly id = 'sr'
  private chart: IChartApi | null = null
  private host: ISeriesApi<'Line'> | null = null
  private zoneEntries: ZoneEntry[] = []
  private nearestSupportId: string | null = null
  private nearestResistanceId: string | null = null

  mount(chart: IChartApi): void {
    this.chart = chart
    // autoscaleInfoProvider: () => null prevents price lines from forcing the
    // chart to fit far-away S/R levels into view, which would compress candles.
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
      this.zoneEntries.push(this.drawZone(zone, 'support'))
    }
    for (const zone of resistance) {
      this.zoneEntries.push(this.drawZone(zone, 'resistance'))
    }
  }

  private drawZone(zone: PriceZone, side: 'support' | 'resistance'): ZoneEntry {
    const isSup = side === 'support'
    const centerColor = isSup ? SUPPORT_CENTER : RESISTANCE_CENTER
    const edgeColor   = isSup ? SUPPORT_EDGE   : RESISTANCE_EDGE
    const baseWidth: 1 | 2 = zone.strength >= 7 ? 2 : 1
    const touches = zone.touchCount > 1 ? ` ×${zone.touchCount}` : ''

    const centerLine = this.host!.createPriceLine({
      price: zone.center,
      color: centerColor,
      lineWidth: baseWidth,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `${isSup ? 'S' : 'R'}${touches}`,
    })
    // Dotted boundary lines show the zone as a range, not a hairline.
    // axisLabelVisible: false keeps the axis clean — only the center is labeled.
    const upperLine = this.host!.createPriceLine({
      price: zone.upper,
      color: edgeColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: '',
    })
    const lowerLine = this.host!.createPriceLine({
      price: zone.lower,
      color: edgeColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: '',
    })

    return { centerLine, upperLine, lowerLine, zone, baseWidth }
  }

  highlight(key: string | null): void {
    for (const entry of this.zoneEntries) {
      const { centerLine, upperLine, lowerLine, zone, baseWidth } = entry
      const lit =
        key === 'sr:all' ||
        key === `sr:zone:${zone.id}` ||
        (key === 'sr:nearest-support'    && zone.id === this.nearestSupportId) ||
        (key === 'sr:nearest-resistance' && zone.id === this.nearestResistanceId)

      const w = lit ? Math.min(baseWidth + 2, 4) as 1 | 2 | 3 | 4 : baseWidth
      centerLine.applyOptions({ lineWidth: w })

      const isSup = zone.type === 'support'
      const edgeLit = lit ? (isSup ? SUPPORT_EDGE_LIT : RESISTANCE_EDGE_LIT) : (isSup ? SUPPORT_EDGE : RESISTANCE_EDGE)
      upperLine.applyOptions({ color: edgeLit })
      lowerLine.applyOptions({ color: edgeLit })
    }
  }

  private clearLines(): void {
    if (!this.host) return
    for (const { centerLine, upperLine, lowerLine } of this.zoneEntries) {
      this.host.removePriceLine(centerLine)
      this.host.removePriceLine(upperLine)
      this.host.removePriceLine(lowerLine)
    }
    this.zoneEntries = []
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
