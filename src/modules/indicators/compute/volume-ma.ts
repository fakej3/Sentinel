import type { VolumeMaResult } from '../types'

/**
 * Volume Moving Average (SMA of prior `period` bars) with relative volume.
 * Uses the previous `period` bars only — the current bar is excluded from the
 * average so that relativeVolume reflects current bar vs historical baseline.
 * Returns null when volumes.length < period + 1 (need at least one bar after the window).
 */
export function computeVolumeMa(volumes: number[], period = 20): VolumeMaResult | null {
  if (volumes.length < period + 1) return null

  const slice = volumes.slice(-(period + 1), -1)
  const ma = slice.reduce((s, v) => s + v, 0) / period
  const current = volumes[volumes.length - 1]

  return { ma, relativeVolume: ma === 0 ? 0 : current / ma }
}
