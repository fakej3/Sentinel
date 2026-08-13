export const QUICK_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '12h', '1d', '3d', '1w'] as const
export const EXTRA_TIMEFRAMES = ['3m', '2h', '6h', '8h', '1M'] as const
export const ALL_TIMEFRAMES = [...QUICK_TIMEFRAMES, ...EXTRA_TIMEFRAMES] as const

export type Timeframe = (typeof ALL_TIMEFRAMES)[number]

const INTERVAL_MS: Record<string, number> = {
  '1m':  60_000,       '3m':   180_000,     '5m':    300_000,
  '15m': 900_000,      '30m':  1_800_000,
  '1h':  3_600_000,    '2h':   7_200_000,   '4h':    14_400_000,
  '6h':  21_600_000,   '8h':   28_800_000,  '12h':   43_200_000,
  '1d':  86_400_000,   '3d':   259_200_000, '1w':    604_800_000,
  '1M':  2_592_000_000,
}

/** Duration of one candle for the given interval string, in milliseconds. Returns 0 for unknown intervals. */
export function intervalToMs(interval: string): number {
  return INTERVAL_MS[interval] ?? 0
}
