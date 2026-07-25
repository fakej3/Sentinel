/**
 * DrawingEngine — THE ONLY FILE allowed to import from 'lightweight-charts'.
 *
 * Public API:
 *   Data-layer overlays (Candlestick, Volume, EMA):
 *     addLineSeries / addCandlestickSeries / addHistogramSeries / removeSeries
 *     setData / setHistogramData / setCandlestickData / updateLine / updateHistogram / updateCandlestick
 *     applySeriesOptions / configurePriceScale
 *
 *   Analysis overlays (all 7 analysis overlays):
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

function hiddenLineSeries(chart: IChartApi): AnySeries {
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

interface HLineEntry {
  host:            AnySeries
  pline:           IPriceLine
  price:           number
  color:           string
  lineWidth:       number
  lineStyle:       number
  axisLabelVisible: boolean
  title:           string
  visible:         boolean
}

class HorizontalLineRenderer {
  private readonly chart: IChartApi
  private readonly pool = new Map<string, HLineEntry>()

  constructor(chart: IChartApi) { this.chart = chart }

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
        if (price            !== existing.price)            o.price            = price
        if (color            !== existing.color)            o.color            = color
        if (lineWidth        !== existing.lineWidth)        o.lineWidth        = lineWidth
        if (lineStyle        !== existing.lineStyle)        o.lineStyle        = lineStyle
        if (axisLabelVisible !== existing.axisLabelVisible) o.axisLabelVisible = axisLabelVisible
        if (title            !== existing.title)            o.title            = title
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Object.keys(o).length > 0) existing.pline.applyOptions(o as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (visible !== existing.visible) (existing.host as any).applyOptions({ visible })
        existing.price = price; existing.color = color; existing.lineWidth = lineWidth
        existing.lineStyle = lineStyle; existing.axisLabelVisible = axisLabelVisible
        existing.title = title; existing.visible = visible
      } else {
        const host = hiddenLineSeries(this.chart)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!visible) (host as any).applyOptions({ visible: false })
        const pline = (host as ISeriesApi<'Line'>).createPriceLine({
          price, color, lineWidth, lineStyle: lineStyle as number, axisLabelVisible, title,
        })
        this.pool.set(inst.key, { host, pline, price, color, lineWidth, lineStyle, axisLabelVisible, title, visible })
      }
    }

    for (const [k, entry] of this.pool) {
      if (!nextKeys.has(k)) {
        entry.host.removePriceLine(entry.pline)
        this.chart.removeSeries(entry.host)
        this.pool.delete(k)
      }
    }
  }

  dispose(): void {
    for (const entry of this.pool.values()) {
      entry.host.removePriceLine(entry.pline)
      this.chart.removeSeries(entry.host)
    }
    this.pool.clear()
  }
}

// ── ZoneRenderer ──────────────────────────────────────────────────────────────

interface ZoneEntry {
  series:      AnySeries
  topPrice:    number
  bottomPrice: number
  fillColor1:  string
  fillColor2:  string
  lineColor:   string
  times:       number[]
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

        const timesChanged = inst.times !== existing.times &&
          (inst.times.length !== existing.times.length || inst.times[0] !== existing.times[0])
        if (topPrice !== existing.topPrice || bottomPrice !== existing.bottomPrice || timesChanged) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(existing.series as any).setData(inst.times.map((ts: number) => ({ time: t(ts), value: topPrice })))
        }

        existing.topPrice = topPrice; existing.bottomPrice = bottomPrice
        existing.fillColor1 = fillColor1; existing.fillColor2 = fillColor2
        existing.lineColor = lineColor; existing.times = inst.times; existing.visible = visible
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
        ;(s as any).setData(inst.times.map((ts: number) => ({ time: t(ts), value: topPrice })))
        this.pool.set(inst.key, { series: s, topPrice, bottomPrice, fillColor1, fillColor2, lineColor, times: inst.times, visible })
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
  series:  AnySeries
  color:   string
  lineWidth: number
  lineStyle: number
  visible: boolean
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(existing.series as any).setData(inst.data.map((d: TimeSeriesPoint) => ({ time: t(d.time), value: d.value })))
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
        this.pool.set(inst.key, { series: s, color, lineWidth, lineStyle, visible })
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
  host:    AnySeries
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
        // Update anchor only if it actually changed (avoids full data resend during highlight)
        if (!anchorEqual(inst.anchor, existing.anchor)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(existing.host as any).setData(inst.anchor.map((d: TimeSeriesPoint) => ({ time: t(d.time), value: d.value })))
          existing.anchor = inst.anchor
        }
        // Update markers if changed
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
      const visible      = inst.visible ?? true
      const effectLines  = visible ? inst.lines : BLANK_LINES

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
    if (a[i].time !== b[i].time || a[i].size !== b[i].size || a[i].color !== b[i].color) return false
  }
  return true
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
  private readonly ruler: AnySeries

  constructor(el: HTMLElement) {
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: '#0c0f18' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#0f1621' },
        horzLines: { color: '#141e2e' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: 'rgba(148,163,184,0.35)', width: 1, style: 0, labelBackgroundColor: '#1e293b' },
        horzLine: { color: 'rgba(148,163,184,0.35)', width: 1, style: 0, labelBackgroundColor: '#1e293b' },
      },
      timeScale: {
        borderColor: '#1a2535',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 15,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      rightPriceScale: {
        borderColor: '#1a2535',
        scaleMargins: { top: 0.15, bottom: 0.10 },
      },
    })

    this.ruler = this.chart.addSeries(LineSeries, {
      color:                  'rgba(0,0,0,0)',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider:  () => null,
    })
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
    const coord = (this.ruler as ISeriesApi<'Line'>).priceToCoordinate(price)
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
      borderVisible:    cfg.borderVisible    ?? false,
      wickUpColor:      cfg.wickUpColor      ?? '#26a69a',
      wickDownColor:    cfg.wickDownColor    ?? '#ef5350',
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
