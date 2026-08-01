import { DrawingEngine } from './drawing/DrawingEngine'
import type { Candle } from '../../modules/market/types'
import type { PipelineResult } from '../../modules/pipeline/types'
import type { IOverlay, IAnalysisOverlay, ChartTimeRange } from './types'

export class OverlayManager {
  private readonly engine: DrawingEngine
  private readonly overlays = new Map<string, IOverlay>()
  private readonly analysisOverlays = new Map<string, IAnalysisOverlay>()
  private readonly hiddenAnalysis = new Set<string>()
  private lastAnalysisData: PipelineResult | null | undefined = undefined
  /** The chart's live candle window — the ONLY time authority for analysis drawings. */
  private chartRange: ChartTimeRange | null = null

  constructor(engine: DrawingEngine) {
    this.engine = engine
  }

  add(overlay: IOverlay): void {
    overlay.mount(this.engine)
    this.overlays.set(overlay.id, overlay)
  }

  addAnalysis(overlay: IAnalysisOverlay): void {
    overlay.mount(this.engine)
    this.analysisOverlays.set(overlay.id, overlay)
  }

  update(id: string, candles: Candle[]): void {
    this.overlays.get(id)?.update(candles)
  }

  updateAll(candles: Candle[]): void {
    for (const overlay of this.overlays.values()) {
      overlay.update(candles)
    }
    this.refreshChartRange(candles)
  }

  /** Fast single-bar update for live WebSocket ticks — skips overlays that don't implement tick(). */
  tickCandle(candle: Candle): void {
    for (const overlay of this.overlays.values()) {
      overlay.tick?.(candle)
    }
  }

  updateAnalysis(data: PipelineResult | null): void {
    this.lastAnalysisData = data
    for (const [id, overlay] of this.analysisOverlays.entries()) {
      if (this.hiddenAnalysis.has(id)) continue
      overlay.update(data, this.chartRange)
    }
  }

  setVisible(id: string, visible: boolean): void {
    this.overlays.get(id)?.setVisible(visible)
  }

  setVisibleAnalysis(id: string, visible: boolean): void {
    const overlay = this.analysisOverlays.get(id)
    if (!overlay) return
    overlay.setVisible?.(visible)
    if (visible) {
      this.hiddenAnalysis.delete(id)
      if (this.lastAnalysisData !== undefined) overlay.update(this.lastAnalysisData, this.chartRange)
    } else {
      this.hiddenAnalysis.add(id)
    }
  }

  /**
   * Recompute the chart time range from the current candle set. When the range
   * advances (new candle closed, backfill, timeframe change) and an analysis
   * snapshot is on screen, re-push it so temporal drawings track the live edge.
   */
  private refreshChartRange(candles: Candle[]): void {
    // Extend toSec past the last candle to cover the chart's rightOffset blank area.
    // Without this, zone fills end at the last candle bar while hlines extend into
    // the blank right gutter — a visible cutoff. 15 bars > rightOffset:10 ensures
    // fills always reach the visual right edge regardless of bar spacing.
    const next: ChartTimeRange | null = candles.length > 0
      ? (() => {
          const last         = candles[candles.length - 1]
          const intervalSec  = candles.length >= 2
            ? (last.openTime - candles[0].openTime) / (candles.length - 1) / 1000
            : 0
          return {
            fromSec: Math.floor(candles[0].openTime / 1000),
            toSec:   Math.floor(last.openTime / 1000) + Math.round(intervalSec * 15),
          }
        })()
      : null

    const changed =
      (next === null) !== (this.chartRange === null) ||
      (next !== null && this.chartRange !== null &&
        (next.fromSec !== this.chartRange.fromSec || next.toSec !== this.chartRange.toSec))

    this.chartRange = next

    if (changed && this.lastAnalysisData !== undefined && this.lastAnalysisData !== null) {
      for (const [id, overlay] of this.analysisOverlays.entries()) {
        if (this.hiddenAnalysis.has(id)) continue
        overlay.update(this.lastAnalysisData, this.chartRange)
      }
    }
  }

  /**
   * Broadcast a highlight key to every overlay.
   * Each overlay independently decides whether the key refers to it.
   * Passing `null` clears all highlights.
   */
  highlight(key: string | null): void {
    for (const overlay of this.overlays.values()) overlay.highlight?.(key)
    for (const overlay of this.analysisOverlays.values()) overlay.highlight?.(key)
  }

  dispose(): void {
    for (const overlay of this.overlays.values()) overlay.dispose()
    this.overlays.clear()
    for (const overlay of this.analysisOverlays.values()) overlay.dispose()
    this.analysisOverlays.clear()
    this.hiddenAnalysis.clear()
    this.lastAnalysisData = undefined
  }
}
