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

// ── Series config types ───────────────────────────────────────────────────────

export interface LineSeriesConfig {
  color?: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyleValue
  priceLineVisible?: boolean
  lastValueVisible?: boolean
  crosshairMarkerVisible?: boolean
  /** Exclude this series from y-axis autoscale (invisible host series). */
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

export interface BaselineSeriesConfig {
  baseValue: number
  topFillColor1?: string
  topFillColor2?: string
  topLineColor?: string
  bottomFillColor1?: string
  bottomFillColor2?: string
  bottomLineColor?: string
  lineWidth?: 1 | 2 | 3 | 4
  priceLineVisible?: boolean
  lastValueVisible?: boolean
  crosshairMarkerVisible?: boolean
  excludeFromAutoscale?: boolean
  visible?: boolean
}

// ── Series options (for applyOptions / setVisible / highlight mutations) ──────

export interface SeriesOptions {
  visible?: boolean
  color?: string
  lineWidth?: 1 | 2 | 3 | 4
  topFillColor1?: string
  topFillColor2?: string
  topLineColor?: string
  bottomFillColor1?: string
  bottomFillColor2?: string
  bottomLineColor?: string
  baseValue?: { type: 'price'; price: number }
}

// ── Price line ────────────────────────────────────────────────────────────────

export interface PriceLineConfig {
  price: number
  color: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyleValue
  axisLabelVisible?: boolean
  title?: string
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

export type SeriesHandle    = { readonly _id: number; readonly _kind: 'series' }
export type PriceLineHandle = { readonly _id: number; readonly _kind: 'priceline' }
export type MarkersHandle   = { readonly _id: number; readonly _kind: 'markers' }
export type WatermarkHandle = { readonly _id: number; readonly _kind: 'watermark' }
