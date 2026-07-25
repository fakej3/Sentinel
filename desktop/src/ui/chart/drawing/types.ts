/**
 * Drawing-layer types — zero runtime imports from 'lightweight-charts'.
 * Overlays import from here; DrawingEngine.ts is the only file allowed
 * to import from 'lightweight-charts' directly.
 */

// ── Data types ────────────────────────────────────────────────────────────────

export interface DrawingCandle {
  time: number  // UTC seconds
  open: number
  high: number
  low: number
  close: number
}

export interface TimeSeriesPoint {
  time: number  // UTC seconds
  value: number
}

export interface HistogramPoint {
  time: number  // UTC seconds
  value: number
  color?: string
}

// ── Enum mirror: numeric values match LW Charts LineStyle exactly ─────────────

export const LineStyle = {
  Solid:        0,
  Dotted:       1,
  Dashed:       2,
  LargeDashed:  3,
  SparseDotted: 4,
} as const
export type LineStyleValue = typeof LineStyle[keyof typeof LineStyle]

// ── Raw-series config types (used by data-layer overlays) ─────────────────────

export interface LineSeriesConfig {
  color?: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyleValue
  priceLineVisible?: boolean
  lastValueVisible?: boolean
  crosshairMarkerVisible?: boolean
  /** Exclude this series from y-axis autoscale. */
  excludeFromAutoscale?: boolean
  visible?: boolean
}

export interface CandlestickSeriesConfig {
  upColor?: string
  downColor?: string
  borderVisible?: boolean
  wickUpColor?: string
  wickDownColor?: string
  priceLineVisible?: boolean
  lastValueVisible?: boolean
}

export interface HistogramSeriesConfig {
  priceScaleId?: string
  priceFormat?: 'volume'
  lastValueVisible?: boolean
  priceLineVisible?: boolean
}

// ── Series mutation options (data-layer overlays: visibility / highlight) ─────

export interface SeriesOptions {
  visible?: boolean
  color?: string
  lineWidth?: 1 | 2 | 3 | 4
}

// ── Markers ───────────────────────────────────────────────────────────────────

export interface DrawingMarker {
  time: number  // UTC seconds
  position: 'aboveBar' | 'belowBar' | 'inBar'
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown'
  color: string
  text?: string
  size?: number
}

// ── Watermark ─────────────────────────────────────────────────────────────────

export interface WatermarkLine {
  text: string
  color: string
  fontSize: number
  fontStyle?: string
}

export interface WatermarkConfig {
  horzAlign: 'left' | 'center' | 'right'
  vertAlign: 'top' | 'center' | 'bottom'
  lines: WatermarkLine[]
}

// ── Crosshair event ───────────────────────────────────────────────────────────

export interface CrosshairEvent {
  /** UTC seconds, or null when the crosshair leaves the chart area. */
  time: number | null
  point: { x: number; y: number } | null
}

// ── Price scale ───────────────────────────────────────────────────────────────

export interface PriceScaleConfig {
  scaleMargins?: { top: number; bottom: number }
}

// ── Opaque handle types ───────────────────────────────────────────────────────
// DrawingEngine creates and owns these; overlays only receive and pass them back.

/** Handle to a raw line / candlestick / histogram series (data-layer overlays). */
export type SeriesHandle    = { readonly _id: number; readonly _kind: 'series' }
/** Handle to the trend-badge watermark text overlay. */
export type WatermarkHandle = { readonly _id: number; readonly _kind: 'watermark' }

// High-level primitive handles — analysis overlays use these instead of
// managing host series and plugins manually.

/** A single horizontal price line, fully managed by DrawingEngine. */
export type HorizontalLineHandle = { readonly _id: number; readonly _kind: 'hline' }
/** A shaded zone between two price levels, fully managed by DrawingEngine. */
export type ZoneHandle           = { readonly _id: number; readonly _kind: 'zone' }
/** A polyline (zigzag / trend line) series, fully managed by DrawingEngine. */
export type PolylineHandle       = { readonly _id: number; readonly _kind: 'polyline' }
/** A set of chart markers anchored to a hidden series, fully managed by DrawingEngine. */
export type MarkerSetHandle      = { readonly _id: number; readonly _kind: 'markerset' }

// ── High-level primitive configs ──────────────────────────────────────────────

export interface HorizontalLineConfig {
  price: number
  color: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyleValue
  axisLabelVisible?: boolean
  title?: string
  /** Toggle visibility without removing the line. */
  visible?: boolean
}

export interface ZoneConfig {
  topPrice: number
  bottomPrice: number
  /** Primary fill color. */
  fillColor1: string
  /** Secondary fill color for a subtle gradient; defaults to fillColor1. */
  fillColor2?: string
  /** Top border line color; defaults to transparent. */
  lineColor?: string
  /** UTC-second timestamps defining the zone's horizontal extent. */
  times: number[]
  visible?: boolean
}

export interface PolylineConfig {
  color: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyleValue
}
