import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { SeriesHandle, PriceLineHandle, MarkersHandle, WatermarkHandle, DrawingMarker } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TrendDirection, TrendStrength } from '../../../modules/market-structure/types'
import type { StructureEvent } from '../../../modules/market-structure/types'
import type { IAnalysisOverlay } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_BOS_LINES   = 2
const MAX_CHOCH_LINES = 1

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendLabel(trend: TrendDirection, strength: TrendStrength): string {
  if (trend === 'ranging') return 'Ranging'
  const prefix = strength === 'strong' ? 'Strong ' : strength === 'weak' ? 'Weak ' : ''
  return prefix + (trend === 'bullish' ? 'Bullish' : 'Bearish')
}

function trendColor(trend: TrendDirection): string {
  if (trend === 'bullish') return 'rgba(34, 197, 94, 0.28)'
  if (trend === 'bearish') return 'rgba(239, 83, 80, 0.28)'
  return 'rgba(148, 163, 184, 0.22)'
}

type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'EH' | 'EL'

function swingLabelColor(label: SwingLabel | null): string {
  if (label === 'HH' || label === 'HL') return '#22c55e'
  if (label === 'LH' || label === 'LL') return '#ef5350'
  return '#64748b'   // EH / EL / unlabeled
}

// ── Typed event-line record ───────────────────────────────────────────────────

interface EventLine {
  line: PriceLineHandle
  event: StructureEvent
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export class MarketStructureOverlay implements IAnalysisOverlay {
  readonly id = 'market-structure'

  private engine: DrawingEngine | null = null

  // Invisible host for BOS/CHoCH price lines
  private eventHostH: SeriesHandle | null = null
  private bosLines:   EventLine[] = []
  private chochLines: EventLine[] = []

  // Invisible host whose series data anchors the markers plugin
  private markerHostH: SeriesHandle | null = null
  private markersH: MarkersHandle | null = null

  // Zigzag structure line through recent swings
  private swingLineH: SeriesHandle | null = null

  // Trend direction badge (text watermark, top-left)
  private trendBadgeH: WatermarkHandle | null = null

  // Canonical (un-highlighted) marker set — kept for fast highlight mutation
  private lastMarkers: DrawingMarker[] = []

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  mount(engine: DrawingEngine): void {
    this.engine = engine

    this.eventHostH = engine.addLineSeries({
      color:                  'rgba(0,0,0,0)',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale:   true,
    })
    engine.setData(this.eventHostH, [])

    this.markerHostH = engine.addLineSeries({
      color:                  'rgba(0,0,0,0)',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale:   true,
    })
    engine.setData(this.markerHostH, [])
    this.markersH = engine.addMarkersPlugin(this.markerHostH)

    this.swingLineH = engine.addLineSeries({
      color:                  'rgba(100, 116, 139, 0.45)',
      lineWidth:              1,
      lineStyle:              LineStyle.Dashed,
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale:   true,
    })
    engine.setData(this.swingLineH, [])

    this.trendBadgeH = engine.addWatermark({
      horzAlign: 'left',
      vertAlign: 'top',
      lines: [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 11, fontStyle: 'bold' }],
    })
  }

  update(data: PipelineResult | null): void {
    this.clearEventLines()

    if (!data || !this.engine) {
      if (this.markersH)    this.engine?.setMarkers(this.markersH, [])
      if (this.swingLineH)  this.engine?.setData(this.swingLineH, [])
      if (this.markerHostH) this.engine?.setData(this.markerHostH, [])
      this.lastMarkers = []
      if (this.trendBadgeH) this.engine?.updateWatermark(this.trendBadgeH, {
        horzAlign: 'left', vertAlign: 'top',
        lines: [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 11 }],
      })
      return
    }

    const { marketStructure, candles } = data

    // Anchor marker host to all candle timestamps; use actual prices so markers
    // appear at the correct chart position (aboveBar/belowBar is relative to series value).
    const candleByTime = new Map(candles.map(c => [Math.floor(c.openTime / 1000), c]))
    const swingByTime  = new Map(marketStructure.swings.map(s => [Math.floor(s.timestamp / 1000), s]))
    const times = candles.map(c => Math.floor(c.openTime / 1000))
    if (this.markerHostH) {
      this.engine.setData(this.markerHostH, times.map(time => {
        const swing  = swingByTime.get(time)
        const candle = candleByTime.get(time)
        if (swing && candle) {
          return { time, value: swing.type === 'high' ? candle.high : candle.low }
        }
        return { time, value: candle?.close ?? 0 }
      }))
    }

    // ── Swing markers — all labeled swings so HH/HL/LH/LL labels are correct ─
    const labeledSwings = marketStructure.swings.filter(s => s.label !== null)
    const markers: DrawingMarker[] = labeledSwings.map(s => ({
      time:     Math.floor(s.timestamp / 1000),
      position: s.type === 'high' ? 'aboveBar' as const : 'belowBar' as const,
      shape:    'circle' as const,
      color:    swingLabelColor(s.label as SwingLabel),
      text:     s.label as string,
      size:     0.6,
    }))

    this.lastMarkers = markers
    if (this.markersH) this.engine.setMarkers(this.markersH, markers)

    // ── Zigzag ───────────────────────────────────────────────────────────────
    const zigzag = labeledSwings.map(s => ({
      time:  Math.floor(s.timestamp / 1000),
      value: s.price,
    }))
    if (this.swingLineH) this.engine.setData(this.swingLineH, zigzag)

    // ── BOS price lines ───────────────────────────────────────────────────────
    for (const e of marketStructure.bos.events.slice(-MAX_BOS_LINES)) {
      const isBull = e.direction === 'bullish'
      const line = this.engine.addPriceLine(this.eventHostH!, {
        price:            e.level,
        color:            isBull ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 83, 80, 0.55)',
        lineWidth:        1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: true,
        title:            'BOS',
      })
      this.bosLines.push({ line, event: e })
    }

    // ── CHoCH price lines ─────────────────────────────────────────────────────
    for (const e of marketStructure.choch.events.slice(-MAX_CHOCH_LINES)) {
      const line = this.engine.addPriceLine(this.eventHostH!, {
        price:            e.level,
        color:            'rgba(168, 85, 247, 0.65)',
        lineWidth:        1,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: true,
        title:            'CHoCH',
      })
      this.chochLines.push({ line, event: e })
    }

    // ── Trend badge ───────────────────────────────────────────────────────────
    if (this.trendBadgeH) {
      this.engine.updateWatermark(this.trendBadgeH, {
        horzAlign: 'left',
        vertAlign: 'top',
        lines: [{
          text:      trendLabel(marketStructure.trend, marketStructure.strength),
          color:     trendColor(marketStructure.trend),
          fontSize:  11,
          fontStyle: 'bold',
        }],
      })
    }
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    if (this.eventHostH)  this.engine.applySeriesOptions(this.eventHostH, { visible })
    if (this.markerHostH) this.engine.applySeriesOptions(this.markerHostH, { visible })
    if (this.swingLineH)  this.engine.applySeriesOptions(this.swingLineH, { visible })
    if (!visible && this.trendBadgeH) {
      this.engine.updateWatermark(this.trendBadgeH, {
        horzAlign: 'left', vertAlign: 'top',
        lines: [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 11 }],
      })
    }
    // On setVisible(true), OverlayManager immediately calls update(lastData) to restore
  }

  // ── Highlight ────────────────────────────────────────────────────────────────

  highlight(key: string | null): void {
    this.applyEventHighlight(key)
    this.applySwingHighlight(key)
  }

  private applyEventHighlight(key: string | null): void {
    if (!this.engine) return
    for (const { line, event } of this.bosLines) {
      const lit = key === 'ms:all' || key === `ms:bos:${event.timestamp}`
      this.engine.updatePriceLine(line, { lineWidth: lit ? 3 : 1 })
    }
    for (const { line, event } of this.chochLines) {
      const lit = key === 'ms:all' || key === `ms:choch:${event.timestamp}`
      this.engine.updatePriceLine(line, { lineWidth: lit ? 3 : 1 })
    }
  }

  private applySwingHighlight(key: string | null): void {
    if (!this.engine || !this.markersH || this.lastMarkers.length === 0) return

    let litTs: number | null = null
    if (key?.startsWith('ms:swing:')) {
      litTs = Number(key.slice('ms:swing:'.length))
    }
    const litAll = key === 'ms:all'

    const updated = this.lastMarkers.map(m => {
      const tsMs = m.time * 1000
      const shouldLit = litAll || (litTs !== null && tsMs === litTs)
      return shouldLit ? { ...m, size: 2.5 } : { ...m, size: 0.6 }
    })

    // Skip re-render if highlight state hasn't changed
    const curLit  = updated.some(m => m.size !== 0.6)
    const prevLit = this.lastMarkers.some(m => m.size !== 0.6)
    if (!curLit && !prevLit) return

    this.engine.setMarkers(this.markersH, updated)
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  private clearEventLines(): void {
    if (!this.engine) return
    for (const { line } of [...this.bosLines, ...this.chochLines]) {
      this.engine.removePriceLine(line)
    }
    this.bosLines   = []
    this.chochLines = []
  }

  dispose(): void {
    this.clearEventLines()
    if (this.engine) {
      if (this.markersH)    this.engine.detachMarkersPlugin(this.markersH)
      if (this.trendBadgeH) this.engine.detachWatermark(this.trendBadgeH)
      if (this.eventHostH)  this.engine.removeSeries(this.eventHostH)
      if (this.markerHostH) this.engine.removeSeries(this.markerHostH)
      if (this.swingLineH)  this.engine.removeSeries(this.swingLineH)
    }
    this.markersH    = null
    this.trendBadgeH = null
    this.eventHostH  = null
    this.markerHostH = null
    this.swingLineH  = null
    this.lastMarkers = []
    this.engine      = null
  }
}
