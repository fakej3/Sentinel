import type { Candle, Timeframe } from '../market/types'
import type { ValidationRecord, ValidationSnapshot, WalkConfig } from './types'
import { DEFAULT_WALK_CONFIG } from './types'
import { replayDataset } from '../benchmark/index'
import { simulateOutcome } from './outcome'

function deriveDirection(trend: string): 'bullish' | 'bearish' | 'neutral' {
  if (trend.includes('bullish')) return 'bullish'
  if (trend.includes('bearish')) return 'bearish'
  return 'neutral'
}

/**
 * Walk through a candle history and produce a ValidationRecord for each step.
 *
 * At each step:
 *   1. Run the complete production pipeline on allCandles.slice(0, i)
 *   2. Simulate outcome on allCandles.slice(i, i + forwardLookBars)
 *   3. Record snapshot + outcome
 *
 * Steps where the pipeline throws (e.g. degenerate price data) are silently
 * skipped — a skip does NOT indicate a bug; it indicates unusable data.
 *
 * Everything is deterministic: same candles → identical records every time.
 */
export async function walkCandles(
  symbol: string,
  interval: Timeframe,
  allCandles: Candle[],
  config: Partial<WalkConfig> = {},
): Promise<ValidationRecord[]> {
  const cfg: WalkConfig = {
    minCandleCount: config.minCandleCount ?? DEFAULT_WALK_CONFIG.minCandleCount,
    stepSize:        config.stepSize        ?? DEFAULT_WALK_CONFIG.stepSize,
    forwardLookBars: config.forwardLookBars ?? DEFAULT_WALK_CONFIG.forwardLookBars,
    pipelineConfig:  config.pipelineConfig,
  }

  const records: ValidationRecord[] = []

  for (let i = cfg.minCandleCount; i <= allCandles.length - cfg.forwardLookBars; i += cfg.stepSize) {
    const snapshotCandles = allCandles.slice(0, i)
    const forwardCandles  = allCandles.slice(i, i + cfg.forwardLookBars)
    const lastCandle      = snapshotCandles[snapshotCandles.length - 1]

    let pipeline
    try {
      pipeline = await replayDataset(
        {
          symbol,
          interval,
          candles: snapshotCandles,
          metadata: { fetchedAt: lastCandle?.closeTime ?? 0 },
        },
        cfg.pipelineConfig,
      )
    } catch {
      continue
    }

    const id        = `${symbol}-${interval}-${i}`
    const direction = deriveDirection(pipeline.analysis.fullTrend.trend)

    const snapshot: ValidationSnapshot = {
      id,
      symbol,
      interval,
      timestamp:           lastCandle?.closeTime ?? i,
      snapshotCandleIndex: i,
      pipeline,
      direction,
    }

    const outcome = simulateOutcome(id, pipeline.tradePlan, direction, forwardCandles)

    records.push({ snapshot, outcome })
  }

  return records
}
