import type { IChartApi } from 'lightweight-charts'
import type { Candle } from '../../modules/market/types'
import type { PipelineResult } from '../../modules/pipeline/types'
import type { IOverlay, IAnalysisOverlay } from './types'

export class OverlayManager {
  private readonly chart: IChartApi
  private readonly overlays = new Map<string, IOverlay>()
  private readonly analysisOverlays = new Map<string, IAnalysisOverlay>()

  constructor(chart: IChartApi) {
    this.chart = chart
  }

  add(overlay: IOverlay): void {
    overlay.mount(this.chart)
    this.overlays.set(overlay.id, overlay)
  }

  addAnalysis(overlay: IAnalysisOverlay): void {
    overlay.mount(this.chart)
    this.analysisOverlays.set(overlay.id, overlay)
  }

  update(id: string, candles: Candle[]): void {
    this.overlays.get(id)?.update(candles)
  }

  updateAll(candles: Candle[]): void {
    for (const overlay of this.overlays.values()) {
      overlay.update(candles)
    }
  }

  updateAnalysis(data: PipelineResult | null): void {
    for (const overlay of this.analysisOverlays.values()) {
      overlay.update(data)
    }
  }

  setVisible(id: string, visible: boolean): void {
    this.overlays.get(id)?.setVisible(visible)
  }

  remove(id: string): void {
    const overlay = this.overlays.get(id)
    if (overlay) {
      overlay.dispose()
      this.overlays.delete(id)
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
  }
}
