import { emaSeries } from '../../../modules/indicators/utils'

export function computeEma(closes: number[], period: number): number[] {
  return emaSeries(closes, period)
}
