import type { DrawingEngine } from './drawing/DrawingEngine'
import type { Candle } from '../../modules/market/types'
import type { PipelineResult } from '../../modules/pipeline/types'

export interface IOverlay {
  readonly id: string
  mount(engine: DrawingEngine): void
  update(candles: Candle[]): void
  setVisible(visible: boolean): void
  /**
   * Fast single-bar update for live WebSocket ticks.
   * Implementations call the engine's update method instead of setData so only
   * the affected data point is redrawn. Overlays that do not support incremental
   * updates (e.g. EMA) simply leave this unimplemented — they are refreshed via
   * `update()` on each candle close instead.
   */
  tick?(candle: Candle): void
  /**
   * Highlight the overlay element matching `key`, or restore all elements when `key` is null.
   * Key format: `'<overlay>:<qualifier>'`  e.g. `'ema:20'`, `'sr:zone:sr-001'`, `'ms:bos:1714000000000'`
   * Group keys like `'ema:all'` highlight every element in the overlay.
   */
  highlight?(key: string | null): void
  dispose(): void
}

/**
 * The chart's live candle window in UTC seconds.
 * Analysis overlays MUST take all temporal extents (zone from/to, segment ends)
 * from this range — never from the analysis snapshot's own candle array, which
 * was fetched at analysis time and goes stale as live candles arrive.
 */
export interface ChartTimeRange {
  fromSec: number
  toSec: number
}

/** Overlay driven by the full pipeline analysis result rather than raw candle data. */
export interface IAnalysisOverlay {
  readonly id: string
  mount(engine: DrawingEngine): void
  /**
   * Push a new analysis snapshot (or null to clear) together with the chart's
   * current time range. The manager re-invokes this with a fresh range when
   * the chart window advances, so temporal drawings extend to the live edge.
   */
  update(data: PipelineResult | null, range: ChartTimeRange | null): void
  setVisible?(visible: boolean): void
  /** Same contract as IOverlay.highlight. */
  highlight?(key: string | null): void
  dispose(): void
}
