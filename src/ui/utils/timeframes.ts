export const QUICK_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '12h', '1d', '3d', '1w'] as const
export const EXTRA_TIMEFRAMES = ['3m', '2h', '6h', '8h', '1M'] as const
export const ALL_TIMEFRAMES = [...QUICK_TIMEFRAMES, ...EXTRA_TIMEFRAMES] as const

export type Timeframe = (typeof ALL_TIMEFRAMES)[number]
