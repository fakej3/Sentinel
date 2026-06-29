import type { VolumeMaResult } from '../types'

/**
 * Volume Moving Average (SMA of volume, period 20) with relative volume.
 * Returns null when volumes.length < period.
 */
export function computeVolumeMa(volumes: number[], period = 20): VolumeMaResult | null {
  if (volumes.length < period) return null

  const slice = volumes.slice(-period)
  const ma = slice.reduce((s, v) => s + v, 0) / period
  const current = volumes[volumes.length - 1]

  return { ma, relativeVolume: ma === 0 ? 0 : current / ma }
}
