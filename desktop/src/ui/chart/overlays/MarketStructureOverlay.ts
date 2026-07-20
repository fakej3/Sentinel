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
import type { StructureEvent } from '../../../modules/market-structure/types'
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

// ── Typed event-line record ───────────────────────────────────────────────────

interface EventLine {
  line: IPriceLine
  event: StructureEvent
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export class MarketStructureOverlay implements IAnalysisOverlay {
  readonly id = 'market-structure'

  private chart: IChartApi | null = null

  // Invisible host for BOS/CHoCH price lines
  private eventHost: ISeriesApi<'Line'> | null = null
  private bosLines:   EventLine[] = []
  private chochLines: EventLine[] = []

  // Invisible host whose series data anchors the markers plugin
  private markerHost: ISeriesApi<'Line'> | null = null
  private markerPlugin: ISeriesMarkersPluginApi<UTCTimestamp> | null = null

  // Zigzag structure line through recent swings
  private swingLine: ISeriesApi<'Line'> | null = null

  // Trend direction badge (text watermark, top-left)
  private trendBadge: ITextWatermarkPluginApi<Time> | null = null

  // Canonical (un-highlighted) marker set — kept for fast highlight mutation
  private lastMarkers: SeriesMarker<UTCTimestamp>[] = []

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  mount(chart: IChartApi): void {
    this.chart = chart

    this.eventHost = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    this.eventHost.setData([])

    this.markerHost = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    this.markerHost.setData([])
    this.markerPlugin = createSeriesMarkers(this.markerHost) as ISeriesMarkersPluginApi<UTCTimestamp>

    this.swingLine = chart.addSeries(LineSeries, {
      color: 'rgba(100, 116, 139, 0.30)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      lineStyle: LineStyle.Dashed,
    })
    this.swingLine.setData([])

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
      this.lastMarkers = []
      this.trendBadge?.applyOptions({
        lines: [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 12 }],
      })
      return
    }

    const { marketStructure, candles } = data

    // Anchor marker host to all candle timestamps
    const times = candles.map(c => Math.floor(c.openTime / 1000) as UTCTimestamp)
    this.markerHost?.setData(times.map(time => ({ time, value: 0 })))

    // ── Swing markers ─────────────────────────────────────────────────────────
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

    this.lastMarkers = markers
    this.markerPlugin?.setMarkers(markers)

    // ── Zigzag ───────────────────────────────────────────────────────────────
    const zigzag = recentSwings
      .filter(s => s.label !== null)
      .map(s => ({
        time: Math.floor(s.timestamp / 1000) as UTCTimestamp,
        value: s.price,
      }))
    this.swingLine?.setData(zigzag)

    // ── BOS price lines ───────────────────────────────────────────────────────
    for (const e of marketStructure.bos.events.slice(-MAX_BOS_LINES)) {
      const isBull = e.direction === 'bullish'
      const line = this.eventHost!.createPriceLine({
        price: e.level,
        color: isBull ? '#22c55e' : '#ef5350',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${isBull ? '↑' : '↓'} BOS`,
      })
      this.bosLines.push({ line, event: e })
    }

    // ── CHoCH price lines ─────────────────────────────────────────────────────
    for (const e of marketStructure.choch.events.slice(-MAX_CHOCH_LINES)) {
      const line = this.eventHost!.createPriceLine({
        price: e.level,
        color: '#a855f7',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'CHoCH',
      })
      this.chochLines.push({ line, event: e })
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

  // ── Highlight ────────────────────────────────────────────────────────────────

  highlight(key: string | null): void {
    this.applyEventHighlight(key)
    this.applySwingHighlight(key)
  }

  private applyEventHighlight(key: string | null): void {
    if (!this.eventHost) return
    for (const { line, event } of this.bosLines) {
      const lit = key === 'ms:all' || key === `ms:bos:${event.timestamp}`
      line.applyOptions({ lineWidth: lit ? 3 : 1 })
    }
    for (const { line, event } of this.chochLines) {
      const lit = key === 'ms:all' || key === `ms:choch:${event.timestamp}`
      line.applyOptions({ lineWidth: lit ? 3 : 1 })
    }
  }

  private applySwingHighlight(key: string | null): void {
    if (!this.markerPlugin || this.lastMarkers.length === 0) return

    let litTs: number | null = null
    if (key?.startsWith('ms:swing:')) {
      litTs = Number(key.slice('ms:swing:'.length))
    }
    const litAll = key === 'ms:all'

    const updated = this.lastMarkers.map(m => {
      const tsMs = (m.time as number) * 1000
      const shouldLit = litAll || (litTs !== null && tsMs === litTs)
      return shouldLit ? { ...m, size: 2.5 } : { ...m, size: 0.6 }
    })

    // Skip re-render if highlight state hasn't changed
    const curLit = updated.some(m => m.size !== 0.6)
    const prevLit = this.lastMarkers.some(m => m.size !== 0.6)
    if (!curLit && !prevLit) return

    this.markerPlugin.setMarkers(updated)
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  private clearEventLines(): void {
    if (!this.eventHost) return
    for (const { line } of [...this.bosLines, ...this.chochLines]) {
      this.eventHost.removePriceLine(line)
    }
    this.bosLines   = []
    this.chochLines = []
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
    this.lastMarkers  = []
    this.chart        = null
  }
}
