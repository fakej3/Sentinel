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
  borderUpColor?: string
  borderDownColor?: string
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

// ── Watermark text line ───────────────────────────────────────────────────────

export interface WatermarkLine {
  text: string
  color: string
  fontSize: number
  fontStyle?: string
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

// ── Opaque handle type (data-layer overlays only) ─────────────────────────────

/** Handle to a raw line / candlestick / histogram series (data-layer overlays). */
export type SeriesHandle = { readonly _id: number; readonly _kind: 'series' }

// ── Drawing instructions ──────────────────────────────────────────────────────
// Declarative descriptions produced by analysis overlays.
// DrawingEngine.render() translates these into LW Charts objects.
// Each instruction carries a stable `key` so the renderer can reuse existing
// LW Charts objects between calls instead of tearing them down and recreating.

export interface HorizontalLineInstruction {
  kind: 'hline'
  /** Stable key — renderer reuses the same LW Charts object when key matches. */
  key: string
  price: number
  color: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyleValue
  axisLabelVisible?: boolean
  title?: string
  visible?: boolean
}

export interface ZoneInstruction {
  kind: 'zone'
  key: string
  topPrice: number
  bottomPrice: number
  fillColor1: string
  fillColor2?: string
  lineColor?: string
  /** UTC-second timestamps defining the horizontal extent of the zone fill. */
  fromTime: number
  toTime: number
  visible?: boolean
}

export interface PolylineInstruction {
  kind: 'polyline'
  key: string
  color: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyleValue
  data: TimeSeriesPoint[]
  visible?: boolean
}

export interface MarkerSetInstruction {
  kind: 'markerset'
  key: string
  /** Anchor values — every candle position with swing highs/lows at their H/L. */
  anchor: TimeSeriesPoint[]
  markers: DrawingMarker[]
  visible?: boolean
}

export interface WatermarkInstruction {
  kind: 'watermark'
  key: string
  horzAlign: 'left' | 'center' | 'right'
  vertAlign: 'top' | 'center' | 'bottom'
  lines: WatermarkLine[]
  /** When false the watermark is rendered with blank / transparent text. */
  visible?: boolean
}

export type DrawingInstruction =
  | HorizontalLineInstruction
  | ZoneInstruction
  | PolylineInstruction
  | MarkerSetInstruction
  | WatermarkInstruction
