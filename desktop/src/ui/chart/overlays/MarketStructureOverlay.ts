import {
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type SeriesMarker,
  type ISeriesMarkersPluginApi,
  type ITextWatermarkPluginApi,
  type Time,
} from 'lightweight-charts'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TrendDirection, TrendStrength } from '../../../modules/market-structure/types'
import type { IAnalysisOverlay } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_BOS_LINES   = 8
const MAX_CHOCH_LINES = 4
const MAX_SWING_NODES = 20   // recent swings for labels + zigzag

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendLabel(trend: TrendDirection, strength: TrendStrength): string {
  if (trend === 'ranging') return 'Ranging'
  const prefix = strength === 'strong' ? 'Strong ' : strength === 'weak' ? 'Weak ' : ''
  return prefix + (trend === 'bullish' ? 'Bullish' : 'Bearish')
}

function trendColor(trend: TrendDirection): string {
  if (trend === 'bullish') return 'rgba(34, 197, 94, 0.50)'
  if (trend === 'bearish') return 'rgba(239, 83, 80, 0.50)'
  return 'rgba(148, 163, 184, 0.45)'
}

type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'EH' | 'EL'

function swingLabelColor(label: SwingLabel | null): string {
  if (label === 'HH' || label === 'HL') return '#22c55e'
  if (label === 'LH' || label === 'LL') return '#ef5350'
  return '#64748b'   // EH / EL / unlabeled
}

// ── Overlay ───────────────────────────────────────────────────────────────────

/**
 * Renders market structure visually on the chart:
 *   - Swing labels (HH / HL / LH / LL) as markers above/below bars
 *   - Zigzag connection line through recent significant swings
 *   - BOS horizontal price lines (green = bullish, red = bearish)
 *   - CHoCH horizontal price lines (purple, dashed)
 *   - Trend badge watermark (top-left, subtle)
 *
 * All data comes from PipelineResult.marketStructure — nothing is computed here.
 * Future overlays (Supply/Demand Zones, Order Blocks, FVGs) can extend this
 * module's data source (marketStructure) or add their own series without
 * touching this overlay.
 */
export class MarketStructureOverlay implements IAnalysisOverlay {
  readonly id = 'market-structure'

  private chart: IChartApi | null = null

  // Invisible host for BOS/CHoCH price lines
  private eventHost: ISeriesApi<'Line'> | null = null
  private eventLines: IPriceLine[] = []

  // Invisible host whose series data anchors the markers plugin
  private markerHost: ISeriesApi<'Line'> | null = null
  private markerPlugin: ISeriesMarkersPluginApi<UTCTimestamp> | null = null

  // Zigzag structure line through recent swings
  private swingLine: ISeriesApi<'Line'> | null = null

  // Trend direction badge (text watermark, top-left)
  private trendBadge: ITextWatermarkPluginApi<Time> | null = null

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  mount(chart: IChartApi): void {
    this.chart = chart

    // Host for event price lines — invisible line series
    this.eventHost = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    this.eventHost.setData([])

    // Host for swing markers — invisible, data populated on each update
    this.markerHost = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    this.markerHost.setData([])
    this.markerPlugin = createSeriesMarkers(this.markerHost) as ISeriesMarkersPluginApi<UTCTimestamp>

    // Zigzag line through swing points — thin muted slate
    this.swingLine = chart.addSeries(LineSeries, {
      color: 'rgba(100, 116, 139, 0.30)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      lineStyle: LineStyle.Dashed,
    })
    this.swingLine.setData([])

    // Trend badge — top-left, small, subtle
    const pane = chart.panes()[0]
    this.trendBadge = createTextWatermark(pane, {
      horzAlign: 'left',
      vertAlign: 'top',
      lines: [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 12, fontStyle: 'bold' }],
    })
  }

  update(data: PipelineResult | null): void {
    this.clearEventLines()

    if (!data) {
      this.markerPlugin?.setMarkers([])
      this.swingLine?.setData([])
      this.markerHost?.setData([])
      this.trendBadge?.applyOptions({
        lines: [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 12 }],
      })
      return
    }

    const { marketStructure, candles } = data

    // ── Marker host: set data across all candle timestamps ──────────────────
    // Required so the markers plugin can position labels at exact candle times.
    const times = candles.map(c => Math.floor(c.openTime / 1000) as UTCTimestamp)
    this.markerHost?.setData(times.map(time => ({ time, value: 0 })))

    // ── Swing labels ─────────────────────────────────────────────────────────
    const recentSwings = marketStructure.swings.slice(-MAX_SWING_NODES)
    const markers: SeriesMarker<UTCTimestamp>[] = recentSwings
      .filter(s => s.label !== null)
      .map(s => ({
        time: Math.floor(s.timestamp / 1000) as UTCTimestamp,
        position: s.type === 'high' ? 'aboveBar' : 'belowBar',
        shape: 'circle',
        color: swingLabelColor(s.label as SwingLabel),
        text: s.label as string,
        size: 0.6,
      } satisfies SeriesMarker<UTCTimestamp>))

    this.markerPlugin?.setMarkers(markers)

    // ── Zigzag line through recent swing nodes ───────────────────────────────
    // Only draw labeled swings so the line shows the structural sequence clearly.
    const zigzag = recentSwings
      .filter(s => s.label !== null)
      .map(s => ({
        time: Math.floor(s.timestamp / 1000) as UTCTimestamp,
        value: s.price,
      }))
    this.swingLine?.setData(zigzag)

    // ── BOS price lines ───────────────────────────────────────────────────────
    const recentBOS = marketStructure.bos.events.slice(-MAX_BOS_LINES)
    for (const e of recentBOS) {
      const isBull  = e.direction === 'bullish'
      const color   = isBull ? '#22c55e' : '#ef5350'
      const arrow   = isBull ? '↑' : '↓'
      this.eventLines.push(this.eventHost!.createPriceLine({
        price: e.level,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${arrow} BOS`,
      }))
    }

    // ── CHoCH price lines ─────────────────────────────────────────────────────
    const recentCHoCH = marketStructure.choch.events.slice(-MAX_CHOCH_LINES)
    for (const e of recentCHoCH) {
      this.eventLines.push(this.eventHost!.createPriceLine({
        price: e.level,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'CHoCH',
      }))
    }

    // ── Trend badge ───────────────────────────────────────────────────────────
    this.trendBadge?.applyOptions({
      lines: [{
        text: trendLabel(marketStructure.trend, marketStructure.strength),
        color: trendColor(marketStructure.trend),
        fontSize: 12,
        fontStyle: 'bold',
      }],
    })
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  private clearEventLines(): void {
    if (!this.eventHost) return
    for (const line of this.eventLines) this.eventHost.removePriceLine(line)
    this.eventLines = []
  }

  dispose(): void {
    this.clearEventLines()
    this.markerPlugin?.detach()
    this.trendBadge?.detach()
    if (this.chart) {
      if (this.eventHost)  this.chart.removeSeries(this.eventHost)
      if (this.markerHost) this.chart.removeSeries(this.markerHost)
      if (this.swingLine)  this.chart.removeSeries(this.swingLine)
    }
    this.markerPlugin = null
    this.trendBadge   = null
    this.eventHost    = null
    this.markerHost   = null
    this.swingLine    = null
    this.chart        = null
  }
}
