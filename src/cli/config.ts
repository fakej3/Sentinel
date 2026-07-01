export { PIPELINE_VERSION } from '../modules/pipeline/config'
export { VALID_TIMEFRAMES, MAX_CANDLE_LIMIT } from '../modules/binance/constants'

export const VALID_TEMPLATES = new Set<string>([
  'full',
  'executive',
  'summary',
  'bullet',
  'headline',
  'social',
])
