import type { IChartApi } from 'lightweight-charts'
import type { Candle } from '../../modules/market/types'
import type { IOverlay } from './types'

export class OverlayManager {
  private readonly chart: IChartApi
  private readonly overlays = new Map<string, IOverlay>()

  constructor(chart: IChartApi) {
    this.chart = chart
  }

  add(overlay: IOverlay): void {
    overlay.mount(this.chart)
    this.overlays.set(overlay.id, overlay)
  }

  update(id: string, candles: Candle[]): void {
    this.overlays.get(id)?.update(candles)
  }

  updateAll(candles: Candle[]): void {
    for (const overlay of this.overlays.values()) {
      overlay.update(candles)
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

  dispose(): void {
    for (const overlay of this.overlays.values()) {
      overlay.dispose()
    }
    this.overlays.clear()
  }
}
