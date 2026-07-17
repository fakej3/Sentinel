export const SPOT_BASE_URL = 'https://api.binance.com'
export const FUTURES_BASE_URL = 'https://fapi.binance.com'

export const DEFAULT_CANDLE_LIMIT = 200
export const MAX_CANDLE_LIMIT = 1000
export const REQUEST_TIMEOUT_MS = 10_000

export const VALID_TIMEFRAMES = new Set([
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
])
