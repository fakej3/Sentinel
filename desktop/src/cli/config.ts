import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const _pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf-8'),
) as { version: string }

export const APP_VERSION: string = _pkg.version

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
