/**
 * DrawingEngine — THE ONLY FILE allowed to import from 'lightweight-charts'.
 *
 * All chart series, plugins, and primitive creation goes through this class.
 * Overlays receive a DrawingEngine reference and call its methods; they never
 * touch Lightweight Charts objects directly.
 *
 * Responsibility boundary:
 *   DrawingEngine  →  HOW things are rendered (LW Charts primitives, series types,
 *                      plugin lifecycle, coordinate maths)
 *   Overlays       →  WHAT needs to be drawn (price levels, colors, marker positions,
 *                      zone bounds, polyline points)
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
  WatermarkConfig,
  CrosshairEvent,
  PriceScaleConfig,
  SeriesHandle,
  WatermarkHandle,
  HorizontalLineHandle,
  HorizontalLineConfig,
  ZoneHandle,
  ZoneConfig,
  PolylineHandle,
  PolylineConfig,
  MarkerSetHandle,
} from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySeries = ISeriesApi<any>

export class DrawingEngine {
  private readonly chart: IChartApi
  private nextId = 0

  // ── Internal registries ───────────────────────────────────────────────────────

  // Data-layer overlays: raw series (candlestick, histogram, EMA line)
  private readonly seriesReg    = new Map<number, AnySeries>()

  // High-level primitives managed entirely inside DrawingEngine
  private readonly hlineReg     = new Map<number, { host: AnySeries; pline: IPriceLine }>()
  private readonly zoneReg      = new Map<number, { series: AnySeries; topPrice: number; bottomPrice: number; times: number[] }>()
  private readonly polylineReg  = new Map<number, AnySeries>()
  private readonly markerSetReg = new Map<number, { host: AnySeries; plugin: ISeriesMarkersPluginApi<UTCTimestamp> }>()
  private readonly watermarkReg = new Map<number, ITextWatermarkPluginApi<Time>>()

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

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private mk<K extends 'series' | 'watermark' | 'hline' | 'zone' | 'polyline' | 'markerset'>(kind: K) {
    return { _id: this.nextId++, _kind: kind } as { _id: number; _kind: K }
  }

  private t(time: number): UTCTimestamp { return time as UTCTimestamp }

  private hiddenLineSeries(): AnySeries {
    return this.chart.addSeries(LineSeries, {
      color:                  'rgba(0,0,0,0)',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider:  () => null,
    })
  }

  // ── Data-layer series (used by CandlestickOverlay, VolumeOverlay, EmaOverlay) ─

  addLineSeries(cfg: LineSeriesConfig = {}): SeriesHandle {
    const h = this.mk('series')
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
    const h = this.mk('series')
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
    const h = this.mk('series')
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
    s?.setData(data.map(d => ({ time: this.t(d.time), value: d.value })))
  }

  setHistogramData(handle: SeriesHandle, data: HistogramPoint[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.seriesReg.get(handle._id) as any
    s?.setData(data.map(d => ({
      time:  this.t(d.time),
      value: d.value,
      ...(d.color ? { color: d.color } : {}),
    })))
  }

  setCandlestickData(handle: SeriesHandle, data: DrawingCandle[]): void {
    const s = this.seriesReg.get(handle._id) as ISeriesApi<'Candlestick'> | undefined
    s?.setData(data.map(d => ({
      time: this.t(d.time), open: d.open, high: d.high, low: d.low, close: d.close,
    })))
  }

  updateLine(handle: SeriesHandle, point: TimeSeriesPoint): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.seriesReg.get(handle._id) as any
    s?.update({ time: this.t(point.time), value: point.value })
  }

  updateHistogram(handle: SeriesHandle, point: HistogramPoint): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.seriesReg.get(handle._id) as any
    s?.update({ time: this.t(point.time), value: point.value, ...(point.color ? { color: point.color } : {}) })
  }

  updateCandlestick(handle: SeriesHandle, bar: DrawingCandle): void {
    const s = this.seriesReg.get(handle._id) as ISeriesApi<'Candlestick'> | undefined
    s?.update({ time: this.t(bar.time), open: bar.open, high: bar.high, low: bar.low, close: bar.close })
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

  // ── Coordinate conversion ─────────────────────────────────────────────────────

  /** Convert a price to a y-pixel coordinate on the chart's main price scale. */
  priceToCoordinate(price: number): number | null {
    const coord = (this.ruler as ISeriesApi<'Line'>).priceToCoordinate(price)
    return coord !== undefined && coord !== null ? Number(coord) : null
  }

  // ── Price scale ───────────────────────────────────────────────────────────────

  configurePriceScale(id: string, cfg: PriceScaleConfig): void {
    if (cfg.scaleMargins) {
      this.chart.priceScale(id).applyOptions({ scaleMargins: cfg.scaleMargins })
    }
  }

  // ── Horizontal line primitive ─────────────────────────────────────────────────
  // Creates an invisible host series + price line internally.
  // Overlays never see or manage the host series.

  addHorizontalLine(cfg: HorizontalLineConfig): HorizontalLineHandle {
    const host = this.hiddenLineSeries()
    if (cfg.visible === false) (host as any).applyOptions({ visible: false })  // eslint-disable-line @typescript-eslint/no-explicit-any
    const pline = (host as ISeriesApi<'Line'>).createPriceLine({
      price:            cfg.price,
      color:            cfg.color,
      lineWidth:        cfg.lineWidth        ?? 1,
      lineStyle:        (cfg.lineStyle       ?? 0) as number,
      axisLabelVisible: cfg.axisLabelVisible ?? false,
      title:            cfg.title            ?? '',
    })
    const h = this.mk('hline')
    this.hlineReg.set(h._id, { host, pline })
    return h
  }

  updateHorizontalLine(handle: HorizontalLineHandle, cfg: Partial<HorizontalLineConfig>): void {
    const entry = this.hlineReg.get(handle._id)
    if (!entry) return
    const o: Record<string, unknown> = {}
    if (cfg.price            !== undefined) o.price            = cfg.price
    if (cfg.color            !== undefined) o.color            = cfg.color
    if (cfg.lineWidth        !== undefined) o.lineWidth        = cfg.lineWidth
    if (cfg.lineStyle        !== undefined) o.lineStyle        = cfg.lineStyle
    if (cfg.axisLabelVisible !== undefined) o.axisLabelVisible = cfg.axisLabelVisible
    if (cfg.title            !== undefined) o.title            = cfg.title
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.keys(o).length > 0) entry.pline.applyOptions(o as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (cfg.visible !== undefined) (entry.host as any).applyOptions({ visible: cfg.visible })
  }

  removeHorizontalLine(handle: HorizontalLineHandle): void {
    const entry = this.hlineReg.get(handle._id)
    if (!entry) return
    entry.host.removePriceLine(entry.pline)
    this.chart.removeSeries(entry.host)
    this.hlineReg.delete(handle._id)
  }

  // ── Zone primitive ────────────────────────────────────────────────────────────
  // A shaded band between topPrice and bottomPrice rendered as a baseline series.
  // The "top fill" (between baseValue and the data values) is the visible zone.
  // The "bottom fill" is transparent so only the band appears.

  addZone(cfg: ZoneConfig): ZoneHandle {
    const s = this.chart.addSeries(BaselineSeries, {
      baseValue:              { type: 'price', price: cfg.bottomPrice },
      topFillColor1:          cfg.fillColor1,
      topFillColor2:          cfg.fillColor2 ?? cfg.fillColor1,
      topLineColor:           cfg.lineColor  ?? 'transparent',
      bottomFillColor1:       'transparent',
      bottomFillColor2:       'transparent',
      bottomLineColor:        'transparent',
      lineWidth:              1,
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider:  () => null,
      ...(cfg.visible === false ? { visible: false } : {}),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(s as any).setData(cfg.times.map((t: number) => ({ time: this.t(t), value: cfg.topPrice })))
    const h = this.mk('zone')
    this.zoneReg.set(h._id, {
      series:      s,
      topPrice:    cfg.topPrice,
      bottomPrice: cfg.bottomPrice,
      times:       cfg.times,
    })
    return h
  }

  updateZone(handle: ZoneHandle, opts: Partial<ZoneConfig>): void {
    const entry = this.zoneReg.get(handle._id)
    if (!entry) return
    const s = entry.series

    const styleOpts: Record<string, unknown> = {}
    if (opts.fillColor1  !== undefined) styleOpts.topFillColor1 = opts.fillColor1
    if (opts.fillColor2  !== undefined) styleOpts.topFillColor2 = opts.fillColor2
    if (opts.lineColor   !== undefined) styleOpts.topLineColor  = opts.lineColor
    if (opts.visible     !== undefined) styleOpts.visible        = opts.visible
    if (opts.bottomPrice !== undefined) {
      styleOpts.baseValue = { type: 'price' as const, price: opts.bottomPrice }
      entry.bottomPrice = opts.bottomPrice
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.keys(styleOpts).length > 0) (s as any).applyOptions(styleOpts)

    const topPrice = opts.topPrice ?? entry.topPrice
    const times    = opts.times    ?? entry.times
    if (opts.topPrice !== undefined || opts.times !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(s as any).setData(times.map((t: number) => ({ time: this.t(t), value: topPrice })))
      entry.topPrice = topPrice
      entry.times    = times
    }
  }

  removeZone(handle: ZoneHandle): void {
    const entry = this.zoneReg.get(handle._id)
    if (!entry) return
    this.chart.removeSeries(entry.series)
    this.zoneReg.delete(handle._id)
  }

  // ── Polyline primitive ────────────────────────────────────────────────────────
  // A named line series used for zigzag / trend lines.

  addPolyline(cfg: PolylineConfig): PolylineHandle {
    const s = this.chart.addSeries(LineSeries, {
      color:                  cfg.color,
      lineWidth:              cfg.lineWidth ?? 1,
      lineStyle:              cfg.lineStyle ?? 0,
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider:  () => null,
    })
    const h = this.mk('polyline')
    this.polylineReg.set(h._id, s)
    return h
  }

  setPolylineData(handle: PolylineHandle, data: TimeSeriesPoint[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.polylineReg.get(handle._id) as any
    s?.setData(data.map((d: TimeSeriesPoint) => ({ time: this.t(d.time), value: d.value })))
  }

  setPolylineVisible(handle: PolylineHandle, visible: boolean): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = this.polylineReg.get(handle._id) as any
    s?.applyOptions({ visible })
  }

  removePolyline(handle: PolylineHandle): void {
    const s = this.polylineReg.get(handle._id)
    if (s) {
      this.chart.removeSeries(s)
      this.polylineReg.delete(handle._id)
    }
  }

  // ── Marker set primitive ──────────────────────────────────────────────────────
  // A markers plugin attached to a hidden anchor series.
  // setMarkerSetData  → sets both anchor positions and marker visuals in one call.
  // setMarkerSetMarkers → updates only markers (e.g. for highlight size changes).

  addMarkerSet(): MarkerSetHandle {
    const host   = this.hiddenLineSeries()
    const plugin = createSeriesMarkers(host) as ISeriesMarkersPluginApi<UTCTimestamp>
    const h = this.mk('markerset')
    this.markerSetReg.set(h._id, { host, plugin })
    return h
  }

  setMarkerSetData(handle: MarkerSetHandle, anchor: TimeSeriesPoint[], markers: DrawingMarker[]): void {
    const entry = this.markerSetReg.get(handle._id)
    if (!entry) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(entry.host as any).setData(anchor.map((d: TimeSeriesPoint) => ({ time: this.t(d.time), value: d.value })))
    entry.plugin.setMarkers(this.toSeriesMarkers(markers))
  }

  setMarkerSetMarkers(handle: MarkerSetHandle, markers: DrawingMarker[]): void {
    const entry = this.markerSetReg.get(handle._id)
    if (entry) entry.plugin.setMarkers(this.toSeriesMarkers(markers))
  }

  setMarkerSetVisible(handle: MarkerSetHandle, visible: boolean): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = this.markerSetReg.get(handle._id)
    if (entry) (entry.host as any).applyOptions({ visible })
  }

  removeMarkerSet(handle: MarkerSetHandle): void {
    const entry = this.markerSetReg.get(handle._id)
    if (!entry) return
    entry.plugin.detach()
    this.chart.removeSeries(entry.host)
    this.markerSetReg.delete(handle._id)
  }

  private toSeriesMarkers(markers: DrawingMarker[]): SeriesMarker<UTCTimestamp>[] {
    return markers.map(m => ({
      time:     this.t(m.time),
      position: m.position,
      shape:    m.shape,
      color:    m.color,
      text:     m.text,
      size:     m.size,
    }))
  }

  // ── Watermark ─────────────────────────────────────────────────────────────────

  addWatermark(cfg: WatermarkConfig): WatermarkHandle {
    const pane   = this.chart.panes()[0]
    const plugin = createTextWatermark(pane, {
      horzAlign: cfg.horzAlign,
      vertAlign: cfg.vertAlign,
      lines:     cfg.lines.map(l => ({ text: l.text, color: l.color, fontSize: l.fontSize, fontStyle: l.fontStyle })),
    }) as ITextWatermarkPluginApi<Time>
    const h = this.mk('watermark')
    this.watermarkReg.set(h._id, plugin)
    return h
  }

  updateWatermark(handle: WatermarkHandle, cfg: WatermarkConfig): void {
    this.watermarkReg.get(handle._id)?.applyOptions({
      lines: cfg.lines.map(l => ({ text: l.text, color: l.color, fontSize: l.fontSize, fontStyle: l.fontStyle })),
    })
  }

  removeWatermark(handle: WatermarkHandle): void {
    this.watermarkReg.get(handle._id)?.detach()
    this.watermarkReg.delete(handle._id)
  }

  // ── Crosshair ─────────────────────────────────────────────────────────────────

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

  // ── Chart-level ───────────────────────────────────────────────────────────────

  fitContent(): void {
    this.chart.timeScale().fitContent()
  }

  dispose(): void {
    for (const { plugin } of this.markerSetReg.values()) plugin.detach()
    for (const p of this.watermarkReg.values()) p.detach()
    this.markerSetReg.clear()
    this.watermarkReg.clear()
    this.hlineReg.clear()
    this.zoneReg.clear()
    this.polylineReg.clear()
    this.seriesReg.clear()
    this.chart.remove()
  }
}
