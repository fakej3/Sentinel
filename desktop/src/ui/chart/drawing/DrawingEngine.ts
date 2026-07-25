/**
 * DrawingEngine — THE ONLY FILE allowed to import from 'lightweight-charts'.
 *
 * All chart series, plugins, and primitive creation goes through this class.
 * Overlays receive a DrawingEngine reference and call its methods; they never
 * touch Lightweight Charts objects directly.
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
  BaselineSeriesConfig,
  SeriesOptions,
  PriceLineConfig,
  DrawingMarker,
  WatermarkConfig,
  CrosshairEvent,
  PriceScaleConfig,
  SeriesHandle,
  PriceLineHandle,
  MarkersHandle,
  WatermarkHandle,
} from './types'

// Internal alias — avoids circular type explosion inside the engine
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySeries = ISeriesApi<any>

interface PlEntry { s: AnySeries; l: IPriceLine }

export class DrawingEngine {
  private readonly chart: IChartApi
  private nextId = 0

  private readonly seriesReg    = new Map<number, AnySeries>()
  private readonly plReg        = new Map<number, PlEntry>()
  private readonly markersReg   = new Map<number, ISeriesMarkersPluginApi<UTCTimestamp>>()
  private readonly watermarkReg = new Map<number, ITextWatermarkPluginApi<Time>>()

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
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private mk<K extends 'series' | 'priceline' | 'markers' | 'watermark'>(kind: K) {
    return { _id: this.nextId++, _kind: kind } as { _id: number; _kind: K }
  }

  private t(time: number): UTCTimestamp { return time as UTCTimestamp }

  // ── Series creation ───────────────────────────────────────────────────────────

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

  addBaselineSeries(cfg: BaselineSeriesConfig): SeriesHandle {
    const h = this.mk('series')
    const s = this.chart.addSeries(BaselineSeries, {
      baseValue:              { type: 'price', price: cfg.baseValue },
      topFillColor1:          cfg.topFillColor1          ?? 'transparent',
      topFillColor2:          cfg.topFillColor2          ?? 'transparent',
      topLineColor:           cfg.topLineColor           ?? 'transparent',
      bottomFillColor1:       cfg.bottomFillColor1       ?? 'transparent',
      bottomFillColor2:       cfg.bottomFillColor2       ?? 'transparent',
      bottomLineColor:        cfg.bottomLineColor        ?? 'transparent',
      lineWidth:              cfg.lineWidth              ?? 1,
      priceLineVisible:       cfg.priceLineVisible       ?? false,
      lastValueVisible:       cfg.lastValueVisible       ?? false,
      crosshairMarkerVisible: cfg.crosshairMarkerVisible ?? false,
      ...(cfg.excludeFromAutoscale ? { autoscaleInfoProvider: () => null } : {}),
      ...(cfg.visible === false     ? { visible: false }                    : {}),
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

  // ── Data operations ───────────────────────────────────────────────────────────

  /** Set time-value data on a Line or Baseline series. Pass [] to clear. */
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

  // ── Series options ────────────────────────────────────────────────────────────

  applySeriesOptions(handle: SeriesHandle, opts: Partial<SeriesOptions>): void {
    const s = this.seriesReg.get(handle._id)
    if (!s) return
    const o: Record<string, unknown> = {}
    if (opts.visible          !== undefined) o.visible          = opts.visible
    if (opts.color            !== undefined) o.color            = opts.color
    if (opts.lineWidth        !== undefined) o.lineWidth        = opts.lineWidth
    if (opts.topFillColor1    !== undefined) o.topFillColor1    = opts.topFillColor1
    if (opts.topFillColor2    !== undefined) o.topFillColor2    = opts.topFillColor2
    if (opts.topLineColor     !== undefined) o.topLineColor     = opts.topLineColor
    if (opts.bottomFillColor1 !== undefined) o.bottomFillColor1 = opts.bottomFillColor1
    if (opts.bottomFillColor2 !== undefined) o.bottomFillColor2 = opts.bottomFillColor2
    if (opts.bottomLineColor  !== undefined) o.bottomLineColor  = opts.bottomLineColor
    if (opts.baseValue        !== undefined) o.baseValue        = opts.baseValue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(s as any).applyOptions(o)
  }

  // ── Price lines ───────────────────────────────────────────────────────────────

  addPriceLine(seriesHandle: SeriesHandle, cfg: PriceLineConfig): PriceLineHandle {
    const s = this.seriesReg.get(seriesHandle._id) as ISeriesApi<'Line'>
    const line = s.createPriceLine({
      price:            cfg.price,
      color:            cfg.color,
      lineWidth:        cfg.lineWidth        ?? 1,
      lineStyle:        (cfg.lineStyle       ?? 0) as number,
      axisLabelVisible: cfg.axisLabelVisible ?? false,
      title:            cfg.title            ?? '',
    })
    const h = this.mk('priceline')
    this.plReg.set(h._id, { s, l: line })
    return h
  }

  updatePriceLine(handle: PriceLineHandle, cfg: Partial<PriceLineConfig>): void {
    const entry = this.plReg.get(handle._id)
    if (!entry) return
    const o: Record<string, unknown> = {}
    if (cfg.price            !== undefined) o.price            = cfg.price
    if (cfg.color            !== undefined) o.color            = cfg.color
    if (cfg.lineWidth        !== undefined) o.lineWidth        = cfg.lineWidth
    if (cfg.lineStyle        !== undefined) o.lineStyle        = cfg.lineStyle
    if (cfg.axisLabelVisible !== undefined) o.axisLabelVisible = cfg.axisLabelVisible
    if (cfg.title            !== undefined) o.title            = cfg.title
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entry.l.applyOptions(o as any)
  }

  removePriceLine(handle: PriceLineHandle): void {
    const entry = this.plReg.get(handle._id)
    if (!entry) return
    entry.s.removePriceLine(entry.l)
    this.plReg.delete(handle._id)
  }

  // ── Coordinate conversion ─────────────────────────────────────────────────────

  priceToCoordinate(handle: SeriesHandle, price: number): number | null {
    const s = this.seriesReg.get(handle._id) as ISeriesApi<'Line'> | undefined
    const coord = s?.priceToCoordinate(price)
    return coord !== undefined && coord !== null ? Number(coord) : null
  }

  // ── Price scale ───────────────────────────────────────────────────────────────

  configurePriceScale(id: string, cfg: PriceScaleConfig): void {
    if (cfg.scaleMargins) {
      this.chart.priceScale(id).applyOptions({ scaleMargins: cfg.scaleMargins })
    }
  }

  // ── Markers plugin ────────────────────────────────────────────────────────────

  addMarkersPlugin(handle: SeriesHandle): MarkersHandle {
    const s = this.seriesReg.get(handle._id) as ISeriesApi<'Line'>
    const plugin = createSeriesMarkers(s) as ISeriesMarkersPluginApi<UTCTimestamp>
    const h = this.mk('markers')
    this.markersReg.set(h._id, plugin)
    return h
  }

  setMarkers(handle: MarkersHandle, markers: DrawingMarker[]): void {
    const plugin = this.markersReg.get(handle._id)
    if (!plugin) return
    const lw: SeriesMarker<UTCTimestamp>[] = markers.map(m => ({
      time:     this.t(m.time),
      position: m.position,
      shape:    m.shape,
      color:    m.color,
      text:     m.text,
      size:     m.size,
    }))
    plugin.setMarkers(lw)
  }

  detachMarkersPlugin(handle: MarkersHandle): void {
    this.markersReg.get(handle._id)?.detach()
    this.markersReg.delete(handle._id)
  }

  // ── Watermark plugin ──────────────────────────────────────────────────────────

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

  detachWatermark(handle: WatermarkHandle): void {
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
    for (const p of this.watermarkReg.values()) p.detach()
    for (const p of this.markersReg.values())   p.detach()
    this.watermarkReg.clear()
    this.markersReg.clear()
    this.plReg.clear()
    this.seriesReg.clear()
    this.chart.remove()
  }
}
