/**
 * DrawingEngine — THE ONLY FILE allowed to import from 'lightweight-charts'.
 *
 * Public API:
 *   Data-layer overlays (Candlestick, Volume, EMA):
 *     addLineSeries / addCandlestickSeries / addHistogramSeries / removeSeries
 *     setData / setHistogramData / setCandlestickData / updateLine / updateHistogram / updateCandlestick
 *     applySeriesOptions / configurePriceScale
 *
 *   Analysis overlays (all analysis overlays):
 *     render(layerId, instructions[])  — declarative: describe WHAT exists
 *     clearLayer(layerId)              — remove all objects for a layer
 *     priceToCoordinate(price)         — coordinate math for label collision
 *
 *   Chart-level:
 *     subscribeCrosshairMove / fitContent / dispose
 */

import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  BaselineSeries,
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
  type MouseEventParams,
} from 'lightweight-charts'

import type {
  DrawingCandle,
  TimeSeriesPoint,
  HistogramPoint,
  LineSeriesConfig,
  CandlestickSeriesConfig,
  HistogramSeriesConfig,
  SeriesOptions,
  DrawingMarker,
  WatermarkLine,
  CrosshairEvent,
  PriceScaleConfig,
  SeriesHandle,
  DrawingInstruction,
  HorizontalLineInstruction,
  ZoneInstruction,
  PolylineInstruction,
  MarkerSetInstruction,
  WatermarkInstruction,
} from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySeries = ISeriesApi<any>

// ── Utility ───────────────────────────────────────────────────────────────────

function t(time: number): UTCTimestamp { return time as UTCTimestamp }

function hiddenLineSeries(chart: IChartApi): ISeriesApi<'Line'> {
  return chart.addSeries(LineSeries, {
    color:                  'rgba(0,0,0,0)',
    priceLineVisible:       false,
    lastValueVisible:       false,
    crosshairMarkerVisible: false,
    autoscaleInfoProvider:  () => null,
  })
}

function toSeriesMarkers(markers: DrawingMarker[]): SeriesMarker<UTCTimestamp>[] {
  return markers.map(m => ({
    time:     t(m.time),
    position: m.position,
    shape:    m.shape,
    color:    m.color,
    text:     m.text,
    size:     m.size,
  }))
}

// ── HorizontalLineRenderer ────────────────────────────────────────────────────
// Uses a SINGLE shared LineSeries host for the entire renderer instance.
// Each price line uses IPriceLine on that host (LW v5 supports many price lines
// per series). Individual visibility is controlled via PriceLineOptions.lineVisible
// rather than toggling the host series, reducing total series count significantly.

interface HLineEntry {
  pline:            IPriceLine
  price:            number
  color:            string
  lineWidth:        number
  lineStyle:        number
  axisLabelVisible: boolean
  title:            string
  visible:          boolean
}

class HorizontalLineRenderer {
  private readonly chart: IChartApi
  private host:           ISeriesApi<'Line'> | null = null
  private readonly pool = new Map<string, HLineEntry>()

  constructor(chart: IChartApi) { this.chart = chart }

  private getHost(): ISeriesApi<'Line'> {
    if (!this.host) this.host = hiddenLineSeries(this.chart)
    return this.host
  }

  render(instructions: HorizontalLineInstruction[]): void {
    const nextKeys = new Set<string>()

    for (const inst of instructions) {
      nextKeys.add(inst.key)
      const price            = inst.price
      const color            = inst.color
      const lineWidth        = inst.lineWidth        ?? 1
      const lineStyle        = inst.lineStyle        ?? 0
      const axisLabelVisible = inst.axisLabelVisible ?? false
      const title            = inst.title            ?? ''
      const visible          = inst.visible          ?? true

      const existing = this.pool.get(inst.key)
      if (existing) {
        const o: Record<string, unknown> = {}
        if (price     !== existing.price)     o.price     = price
        if (color     !== existing.color)     o.color     = color
        if (lineWidth !== existing.lineWidth) o.lineWidth = lineWidth
        if (lineStyle !== existing.lineStyle) o.lineStyle = lineStyle
        if (title     !== existing.title)     o.title     = title

        // lineVisible controls whether the price line renders
        if (visible !== existing.visible) o.lineVisible = visible

        // axisLabelVisible is only meaningful when the line is visible
        const effectiveLabel  = visible ? axisLabelVisible : false
        const existingEffectiveLabel = existing.visible ? existing.axisLabelVisible : false
        if (effectiveLabel !== existingEffectiveLabel) o.axisLabelVisible = effectiveLabel

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Object.keys(o).length > 0) existing.pline.applyOptions(o as any)

        existing.price = price; existing.color = color; existing.lineWidth = lineWidth
        existing.lineStyle = lineStyle; existing.axisLabelVisible = axisLabelVisible
        existing.title = title; existing.visible = visible
      } else {
        const pline = this.getHost().createPriceLine({
          price,
          color,
          lineWidth: lineWidth as 1 | 2 | 3 | 4,
          lineStyle,
          axisLabelVisible: visible ? axisLabelVisible : false,
          title,
          lineVisible: visible,
        })
        this.pool.set(inst.key, { pline, price, color, lineWidth, lineStyle, axisLabelVisible, title, visible })
      }
    }

    for (const [k, entry] of this.pool) {
      if (!nextKeys.has(k)) {
        this.getHost().removePriceLine(entry.pline)
        this.pool.delete(k)
      }
    }
  }

  dispose(): void {
    if (this.host) {
      for (const entry of this.pool.values()) {
        this.host.removePriceLine(entry.pline)
      }
      this.chart.removeSeries(this.host)
      this.host = null
    }
    this.pool.clear()
  }
}

// ── ZoneRenderer ──────────────────────────────────────────────────────────────
// Uses BaselineSeries with exactly TWO data points (fromTime, toTime).
// Two points suffice to draw the fill across the full horizontal span without
// polluting CrosshairMode with 80 competing data values at fixed price levels.

interface ZoneEntry {
  series:      AnySeries
  topPrice:    number
  bottomPrice: number
  fillColor1:  string
  fillColor2:  string
  lineColor:   string
  fromTime:    number
  toTime:      number
  visible:     boolean
}

class ZoneRenderer {
  private readonly chart: IChartApi
  private readonly pool = new Map<string, ZoneEntry>()

  constructor(chart: IChartApi) { this.chart = chart }

  render(instructions: ZoneInstruction[]): void {
    const nextKeys = new Set<string>()

    for (const inst of instructions) {
      nextKeys.add(inst.key)
      const topPrice    = inst.topPrice
      const bottomPrice = inst.bottomPrice
      const fillColor1  = inst.fillColor1
      const fillColor2  = inst.fillColor2  ?? inst.fillColor1
      const lineColor   = inst.lineColor   ?? 'transparent'
      const fromTime    = inst.fromTime
      const toTime      = inst.toTime
      const visible     = inst.visible     ?? true

      const existing = this.pool.get(inst.key)
      if (existing) {
        const styleOpts: Record<string, unknown> = {}
        if (fillColor1  !== existing.fillColor1)  styleOpts.topFillColor1 = fillColor1
        if (fillColor2  !== existing.fillColor2)  styleOpts.topFillColor2 = fillColor2
        if (lineColor   !== existing.lineColor)   styleOpts.topLineColor  = lineColor
        if (visible     !== existing.visible)     styleOpts.visible        = visible
        if (bottomPrice !== existing.bottomPrice) {
          styleOpts.baseValue = { type: 'price' as const, price: bottomPrice }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Object.keys(styleOpts).length > 0) (existing.series as any).applyOptions(styleOpts)

        if (topPrice !== existing.topPrice || bottomPrice !== existing.bottomPrice ||
            fromTime !== existing.fromTime  || toTime     !== existing.toTime) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(existing.series as any).setData([
            { time: t(fromTime), value: topPrice },
            { time: t(toTime),   value: topPrice },
          ])
        }

        existing.topPrice = topPrice; existing.bottomPrice = bottomPrice
        existing.fillColor1 = fillColor1; existing.fillColor2 = fillColor2
        existing.lineColor = lineColor
        existing.fromTime = fromTime; existing.toTime = toTime
        existing.visible = visible
      } else {
        const s = this.chart.addSeries(BaselineSeries, {
          baseValue:              { type: 'price', price: bottomPrice },
          topFillColor1:          fillColor1,
          topFillColor2:          fillColor2,
          topLineColor:           lineColor,
          bottomFillColor1:       'transparent',
          bottomFillColor2:       'transparent',
          bottomLineColor:        'transparent',
          lineWidth:              1,
          priceLineVisible:       false,
          lastValueVisible:       false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider:  () => null,
          ...(visible ? {} : { visible: false }),
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(s as any).setData([
          { time: t(fromTime), value: topPrice },
          { time: t(toTime),   value: topPrice },
        ])
        this.pool.set(inst.key, { series: s, topPrice, bottomPrice, fillColor1, fillColor2, lineColor, fromTime, toTime, visible })
      }
    }

    for (const [k, entry] of this.pool) {
      if (!nextKeys.has(k)) {
        this.chart.removeSeries(entry.series)
        this.pool.delete(k)
      }
    }
  }

  dispose(): void {
    for (const entry of this.pool.values()) this.chart.removeSeries(entry.series)
    this.pool.clear()
  }
}

// ── PolylineRenderer ──────────────────────────────────────────────────────────

interface PolylineEntry {
  series:    AnySeries
  color:     string
  lineWidth: number
  lineStyle: number
  visible:   boolean
  data:      TimeSeriesPoint[]
}

class PolylineRenderer {
  private readonly chart: IChartApi
  private readonly pool = new Map<string, PolylineEntry>()

  constructor(chart: IChartApi) { this.chart = chart }

  render(instructions: PolylineInstruction[]): void {
    const nextKeys = new Set<string>()

    for (const inst of instructions) {
      nextKeys.add(inst.key)
      const color     = inst.color
      const lineWidth = inst.lineWidth ?? 1
      const lineStyle = inst.lineStyle ?? 0
      const visible   = inst.visible   ?? true

      const existing = this.pool.get(inst.key)
      if (existing) {
        const o: Record<string, unknown> = {}
        if (color     !== existing.color)     o.color     = color
        if (lineWidth !== existing.lineWidth) o.lineWidth = lineWidth
        if (lineStyle !== existing.lineStyle) o.lineStyle = lineStyle
        if (visible   !== existing.visible)   o.visible   = visible
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Object.keys(o).length > 0) (existing.series as any).applyOptions(o)
        if (!polylineDataEqual(inst.data, existing.data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(existing.series as any).setData(inst.data.map((d: TimeSeriesPoint) => ({ time: t(d.time), value: d.value })))
          existing.data = inst.data
        }
        existing.color = color; existing.lineWidth = lineWidth; existing.lineStyle = lineStyle; existing.visible = visible
      } else {
        const s = this.chart.addSeries(LineSeries, {
          color, lineWidth, lineStyle,
          priceLineVisible:       false,
          lastValueVisible:       false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider:  () => null,
          ...(visible ? {} : { visible: false }),
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(s as any).setData(inst.data.map((d: TimeSeriesPoint) => ({ time: t(d.time), value: d.value })))
        this.pool.set(inst.key, { series: s, color, lineWidth, lineStyle, visible, data: inst.data })
      }
    }

    for (const [k, entry] of this.pool) {
      if (!nextKeys.has(k)) {
        this.chart.removeSeries(entry.series)
        this.pool.delete(k)
      }
    }
  }

  dispose(): void {
    for (const entry of this.pool.values()) this.chart.removeSeries(entry.series)
    this.pool.clear()
  }
}

// ── MarkerSetRenderer ─────────────────────────────────────────────────────────

interface MarkerSetEntry {
  host:    ISeriesApi<'Line'>
  plugin:  ISeriesMarkersPluginApi<UTCTimestamp>
  anchor:  TimeSeriesPoint[]
  markers: DrawingMarker[]
  visible: boolean
}

class MarkerSetRenderer {
  private readonly chart: IChartApi
  private readonly pool = new Map<string, MarkerSetEntry>()

  constructor(chart: IChartApi) { this.chart = chart }

  render(instructions: MarkerSetInstruction[]): void {
    const nextKeys = new Set<string>()

    for (const inst of instructions) {
      nextKeys.add(inst.key)
      const visible = inst.visible ?? true

      const existing = this.pool.get(inst.key)
      if (existing) {
        if (!anchorEqual(inst.anchor, existing.anchor)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(existing.host as any).setData(inst.anchor.map((d: TimeSeriesPoint) => ({ time: t(d.time), value: d.value })))
          existing.anchor = inst.anchor
        }
        if (!markersEqual(inst.markers, existing.markers)) {
          existing.plugin.setMarkers(toSeriesMarkers(inst.markers))
          existing.markers = inst.markers
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (visible !== existing.visible) (existing.host as any).applyOptions({ visible })
        existing.visible = visible
      } else {
        const host   = hiddenLineSeries(this.chart)
        const plugin = createSeriesMarkers(host) as ISeriesMarkersPluginApi<UTCTimestamp>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(host as any).setData(inst.anchor.map((d: TimeSeriesPoint) => ({ time: t(d.time), value: d.value })))
        plugin.setMarkers(toSeriesMarkers(inst.markers))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!visible) (host as any).applyOptions({ visible: false })
        this.pool.set(inst.key, { host, plugin, anchor: inst.anchor, markers: inst.markers, visible })
      }
    }

    for (const [k, entry] of this.pool) {
      if (!nextKeys.has(k)) {
        entry.plugin.detach()
        this.chart.removeSeries(entry.host)
        this.pool.delete(k)
      }
    }
  }

  dispose(): void {
    for (const entry of this.pool.values()) {
      entry.plugin.detach()
      this.chart.removeSeries(entry.host)
    }
    this.pool.clear()
  }
}

// ── WatermarkRenderer ─────────────────────────────────────────────────────────

interface WatermarkEntry {
  plugin:  ITextWatermarkPluginApi<Time>
  lines:   WatermarkLine[]
  visible: boolean
}

const BLANK_LINES: WatermarkLine[] = [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 11 }]

class WatermarkRenderer {
  private readonly chart: IChartApi
  private readonly pool = new Map<string, WatermarkEntry>()

  constructor(chart: IChartApi) { this.chart = chart }

  render(instructions: WatermarkInstruction[]): void {
    const nextKeys = new Set<string>()

    for (const inst of instructions) {
      nextKeys.add(inst.key)
      const visible     = inst.visible ?? true
      const effectLines = visible ? inst.lines : BLANK_LINES

      const existing = this.pool.get(inst.key)
      if (existing) {
        const shouldUpdate = visible !== existing.visible || !watermarkLinesEqual(inst.lines, existing.lines)
        if (shouldUpdate) {
          existing.plugin.applyOptions({ lines: effectLines.map(l => ({ text: l.text, color: l.color, fontSize: l.fontSize, fontStyle: l.fontStyle })) })
          existing.lines   = inst.lines
          existing.visible = visible
        }
      } else {
        const pane   = this.chart.panes()[0]
        const plugin = createTextWatermark(pane, {
          horzAlign: inst.horzAlign,
          vertAlign: inst.vertAlign,
          lines:     effectLines.map(l => ({ text: l.text, color: l.color, fontSize: l.fontSize, fontStyle: l.fontStyle })),
        }) as ITextWatermarkPluginApi<Time>
        this.pool.set(inst.key, { plugin, lines: inst.lines, visible })
      }
    }

    for (const [k, entry] of this.pool) {
      if (!nextKeys.has(k)) {
        entry.plugin.detach()
        this.pool.delete(k)
      }
    }
  }

  dispose(): void {
    for (const entry of this.pool.values()) entry.plugin.detach()
    this.pool.clear()
  }
}

// ── Diffing helpers ───────────────────────────────────────────────────────────

function anchorEqual(a: TimeSeriesPoint[], b: TimeSeriesPoint[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  if (a.length === 0) return true
  const last = a.length - 1
  return a[0].time === b[0].time && a[last].time === b[last].time && a[last].value === b[last].value
}

function markersEqual(a: DrawingMarker[], b: DrawingMarker[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].time !== b[i].time || a[i].size !== b[i].size || a[i].color !== b[i].color ||
        a[i].text !== b[i].text || a[i].position !== b[i].position || a[i].shape !== b[i].shape) return false
  }
  return true
}

/**
 * Cheap polyline data equality: length + endpoint sample.
 * Interior-only changes with identical endpoints are not representable by any
 * current overlay (zigzag/segment data always moves its last point), so the
 * endpoint sample is sufficient and avoids O(n) compares per render.
 */
function polylineDataEqual(a: TimeSeriesPoint[], b: TimeSeriesPoint[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  if (a.length === 0) return true
  const last = a.length - 1
  return a[0].time === b[0].time && a[0].value === b[0].value &&
         a[last].time === b[last].time && a[last].value === b[last].value
}

function watermarkLinesEqual(a: WatermarkLine[], b: WatermarkLine[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].text !== b[i].text || a[i].color !== b[i].color) return false
  }
  return true
}

// ── Layer ─────────────────────────────────────────────────────────────────────

interface Layer {
  hlines:     HorizontalLineRenderer
  zones:      ZoneRenderer
  polylines:  PolylineRenderer
  markerSets: MarkerSetRenderer
  watermarks: WatermarkRenderer
}

// ── DrawingEngine ─────────────────────────────────────────────────────────────

export class DrawingEngine {
  private readonly chart: IChartApi
  private nextId = 0

  // Data-layer overlays: raw series (candlestick, histogram, EMA line)
  private readonly seriesReg = new Map<number, AnySeries>()

  // Analysis overlays: one layer per overlay id
  private readonly layers = new Map<string, Layer>()

  // Invisible series used only for priceToCoordinate lookups
  private readonly ruler: ISeriesApi<'Line'>

  constructor(el: HTMLElement) {
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: '#0c0f18' },
        textColor:  '#94a3b8',
        fontSize:   11,
      },
      grid: {
        vertLines: { color: '#1a2234' },
        horzLines: { color: '#1a2234' },
      },
      crosshair: {
        // Normal mode: crosshair follows cursor precisely without snapping to
        // series values. This prevents zone series data from pulling the
        // horizontal line away from the actual cursor position. The OHLCV HUD
        // reads from candleMapRef by time (unaffected by crosshair mode).
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(148,163,184,0.40)', width: 1, style: 0, labelBackgroundColor: '#1e293b' },
        horzLine: { color: 'rgba(148,163,184,0.40)', width: 1, style: 0, labelBackgroundColor: '#1e293b' },
      },
      timeScale: {
        borderColor:    '#1e2d42',
        timeVisible:    true,
        secondsVisible: false,
        rightOffset:    10,
        barSpacing:     8,
        minBarSpacing:  1,
      },
      rightPriceScale: {
        borderColor:  '#1e2d42',
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
    })

    this.ruler = hiddenLineSeries(this.chart)
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private mk() {
    return { _id: this.nextId++, _kind: 'series' as const }
  }

  private getOrCreateLayer(layerId: string): Layer {
    let layer = this.layers.get(layerId)
    if (!layer) {
      layer = {
        hlines:     new HorizontalLineRenderer(this.chart),
        zones:      new ZoneRenderer(this.chart),
        polylines:  new PolylineRenderer(this.chart),
        markerSets: new MarkerSetRenderer(this.chart),
        watermarks: new WatermarkRenderer(this.chart),
      }
      this.layers.set(layerId, layer)
    }
    return layer
  }

  // ── Declarative render API (analysis overlays) ─────────────────────────────

  /**
   * Render a set of drawing instructions for one overlay layer.
   * The engine diffs the new instructions against the previous render and
   * updates, creates, or removes LW Charts objects as needed.
   */
  render(layerId: string, instructions: DrawingInstruction[]): void {
    const layer = this.getOrCreateLayer(layerId)
    layer.hlines.render(    instructions.filter((i): i is HorizontalLineInstruction => i.kind === 'hline'))
    layer.zones.render(     instructions.filter((i): i is ZoneInstruction           => i.kind === 'zone'))
    layer.polylines.render( instructions.filter((i): i is PolylineInstruction       => i.kind === 'polyline'))
    layer.markerSets.render(instructions.filter((i): i is MarkerSetInstruction      => i.kind === 'markerset'))
    layer.watermarks.render(instructions.filter((i): i is WatermarkInstruction      => i.kind === 'watermark'))
  }

  /** Remove all LW Charts objects belonging to this layer. */
  clearLayer(layerId: string): void {
    const layer = this.layers.get(layerId)
    if (!layer) return
    layer.hlines.dispose()
    layer.zones.dispose()
    layer.polylines.dispose()
    layer.markerSets.dispose()
    layer.watermarks.dispose()
    this.layers.delete(layerId)
  }

  // ── Coordinate conversion ──────────────────────────────────────────────────

  /** Convert a price to a y-pixel coordinate on the chart's main price scale. */
  priceToCoordinate(price: number): number | null {
    const coord = this.ruler.priceToCoordinate(price)
    return coord !== undefined && coord !== null ? Number(coord) : null
  }

  // ── Data-layer series (CandlestickOverlay, VolumeOverlay, EmaOverlay) ─────

  addLineSeries(cfg: LineSeriesConfig = {}): SeriesHandle {
    const h = this.mk()
    const s = this.chart.addSeries(LineSeries, {
      color:                  cfg.color                 ?? 'rgba(0,0,0,0)',
      lineWidth:              cfg.lineWidth              ?? 1,
      lineStyle:              cfg.lineStyle              ?? 0,
      priceLineVisible:       cfg.priceLineVisible       ?? false,
      lastValueVisible:       cfg.lastValueVisible       ?? false,
      crosshairMarkerVisible: cfg.crosshairMarkerVisible ?? false,
      ...(cfg.excludeFromAutoscale ? { autoscaleInfoProvider: () => null } : {}),
      ...(cfg.visible === false     ? { visible: false }                    : {}),
    })
    this.seriesReg.set(h._id, s)
    return h
  }

  addCandlestickSeries(cfg: CandlestickSeriesConfig = {}): SeriesHandle {
    const h = this.mk()
    const s = this.chart.addSeries(CandlestickSeries, {
      upColor:          cfg.upColor          ?? '#26a69a',
      downColor:        cfg.downColor        ?? '#ef5350',
      borderVisible:    cfg.borderVisible    ?? true,
      borderUpColor:    cfg.borderUpColor    ?? cfg.upColor   ?? '#26a69a',
      borderDownColor:  cfg.borderDownColor  ?? cfg.downColor ?? '#ef5350',
      wickUpColor:      cfg.wickUpColor      ?? cfg.upColor   ?? '#26a69a',
      wickDownColor:    cfg.wickDownColor    ?? cfg.downColor ?? '#ef5350',
      priceLineVisible: cfg.priceLineVisible ?? false,
      lastValueVisible: cfg.lastValueVisible ?? false,
    })
    this.seriesReg.set(h._id, s)
    return h
  }

  addHistogramSeries(cfg: HistogramSeriesConfig = {}): SeriesHandle {
    const h = this.mk()
    const s = this.chart.addSeries(HistogramSeries, {
      ...(cfg.priceFormat === 'volume' ? { priceFormat: { type: 'volume' as const } } : {}),
      ...(cfg.priceScaleId             ? { priceScaleId: cfg.priceScaleId }           : {}),
      lastValueVisible: cfg.lastValueVisible ?? false,
      priceLineVisible: cfg.priceLineVisible ?? false,
    })
    this.seriesReg.set(h._id, s)
    return h
  }

  removeSeries(handle: SeriesHandle): void {
    const s = this.seriesReg.get(handle._id)
    if (s) {
      this.chart.removeSeries(s)
      this.seriesReg.delete(handle._id)
    }
  }

  setData(handle: SeriesHandle, data: TimeSeriesPoint[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.seriesReg.get(handle._id) as any
    s?.setData(data.map((d: TimeSeriesPoint) => ({ time: t(d.time), value: d.value })))
  }

  setHistogramData(handle: SeriesHandle, data: HistogramPoint[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.seriesReg.get(handle._id) as any
    s?.setData(data.map((d: HistogramPoint) => ({
      time:  t(d.time),
      value: d.value,
      ...(d.color ? { color: d.color } : {}),
    })))
  }

  setCandlestickData(handle: SeriesHandle, data: DrawingCandle[]): void {
    const s = this.seriesReg.get(handle._id) as ISeriesApi<'Candlestick'> | undefined
    s?.setData(data.map((d: DrawingCandle) => ({
      time: t(d.time), open: d.open, high: d.high, low: d.low, close: d.close,
    })))
  }

  updateLine(handle: SeriesHandle, point: TimeSeriesPoint): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.seriesReg.get(handle._id) as any
    s?.update({ time: t(point.time), value: point.value })
  }

  updateHistogram(handle: SeriesHandle, point: HistogramPoint): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.seriesReg.get(handle._id) as any
    s?.update({ time: t(point.time), value: point.value, ...(point.color ? { color: point.color } : {}) })
  }

  updateCandlestick(handle: SeriesHandle, bar: DrawingCandle): void {
    const s = this.seriesReg.get(handle._id) as ISeriesApi<'Candlestick'> | undefined
    s?.update({ time: t(bar.time), open: bar.open, high: bar.high, low: bar.low, close: bar.close })
  }

  applySeriesOptions(handle: SeriesHandle, opts: Partial<SeriesOptions>): void {
    const s = this.seriesReg.get(handle._id)
    if (!s) return
    const o: Record<string, unknown> = {}
    if (opts.visible   !== undefined) o.visible   = opts.visible
    if (opts.color     !== undefined) o.color     = opts.color
    if (opts.lineWidth !== undefined) o.lineWidth = opts.lineWidth
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(s as any).applyOptions(o)
  }

  // ── Price scale ────────────────────────────────────────────────────────────

  configurePriceScale(id: string, cfg: PriceScaleConfig): void {
    if (cfg.scaleMargins) {
      this.chart.priceScale(id).applyOptions({ scaleMargins: cfg.scaleMargins })
    }
  }

  // ── Crosshair ──────────────────────────────────────────────────────────────

  subscribeCrosshairMove(cb: (event: CrosshairEvent) => void): () => void {
    const handler = (param: MouseEventParams<Time>) => {
      cb({
        time:  param.time  !== undefined ? (param.time as number) : null,
        point: param.point ?? null,
      })
    }
    this.chart.subscribeCrosshairMove(handler)
    return () => this.chart.unsubscribeCrosshairMove(handler)
  }

  // ── Chart-level ────────────────────────────────────────────────────────────

  fitContent(): void {
    this.chart.timeScale().fitContent()
  }

  /**
   * Subscribe to visible logical-range changes (fires on scroll/zoom).
   * `from` < 0 means the user has scrolled into whitespace before the first
   * loaded bar — the signal to backfill older history.
   */
  subscribeVisibleLogicalRange(cb: (range: { from: number; to: number } | null) => void): () => void {
    const handler = (range: { from: number; to: number } | null) => cb(range)
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(handler)
    return () => this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
  }

  /** Current visible time window (UTC seconds), or null before first layout. */
  getVisibleTimeRange(): { from: number; to: number } | null {
    const r = this.chart.timeScale().getVisibleRange()
    if (!r) return null
    return { from: r.from as number, to: r.to as number }
  }

  /** Restore a visible time window (used to keep the viewport steady across backfills). */
  setVisibleTimeRange(range: { from: number; to: number }): void {
    this.chart.timeScale().setVisibleRange({ from: t(range.from), to: t(range.to) })
  }

  dispose(): void {
    for (const layer of this.layers.values()) {
      layer.hlines.dispose()
      layer.zones.dispose()
      layer.polylines.dispose()
      layer.markerSets.dispose()
      layer.watermarks.dispose()
    }
    this.layers.clear()
    this.seriesReg.clear()
    this.chart.remove()
  }
}
