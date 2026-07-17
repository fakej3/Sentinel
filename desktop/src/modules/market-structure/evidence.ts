import type {
  SwingPoint,
  StructureEvent,
  TrendDirection,
  TrendStrength,
  ConsolidationResult,
  BreakoutResult,
  PullbackResult,
} from './types'

/**
 * Builds a list of human-readable evidence strings explaining every
 * structural conclusion the engine has reached.
 *
 * Rules:
 *   - Every statement references concrete data (counts, prices, percentages).
 *   - No claim is made without a supporting swing or event.
 *   - Contradicting evidence is also reported (e.g., LH in a bullish trend).
 *   - Evidence is ordered: trend → structure → events → conditions.
 */
export function buildEvidence(
  trend: TrendDirection,
  strength: TrendStrength,
  labeledSwings: SwingPoint[],
  bosEvents: StructureEvent[],
  chochEvents: StructureEvent[],
  consolidation: ConsolidationResult,
  breakout: BreakoutResult,
  pullback: PullbackResult,
): string[] {
  const evidence: string[] = []

  // Trend summary
  const trendLabel =
    trend === 'bullish' ? 'Bullish' :
    trend === 'bearish' ? 'Bearish' :
    'Ranging / No Clear Trend'
  const strengthLabel =
    strength === 'strong' ? 'Strong' :
    strength === 'moderate' ? 'Moderate' :
    'Weak'
  evidence.push(`${strengthLabel} ${trendLabel} market structure`)

  // Structural swing counts
  const recent = labeledSwings.filter(s => s.label !== null).slice(-10)
  const hhCount = recent.filter(s => s.label === 'HH').length
  const hlCount = recent.filter(s => s.label === 'HL').length
  const lhCount = recent.filter(s => s.label === 'LH').length
  const llCount = recent.filter(s => s.label === 'LL').length
  const ehCount = recent.filter(s => s.label === 'EH').length
  const elCount = recent.filter(s => s.label === 'EL').length

  if (hhCount > 0) evidence.push(`${hhCount} Higher High${hhCount > 1 ? 's' : ''} confirmed`)
  if (hlCount > 0) evidence.push(`${hlCount} Higher Low${hlCount > 1 ? 's' : ''} confirmed`)
  if (lhCount > 0) evidence.push(`${lhCount} Lower High${lhCount > 1 ? 's' : ''} confirmed`)
  if (llCount > 0) evidence.push(`${llCount} Lower Low${llCount > 1 ? 's' : ''} confirmed`)
  if (ehCount > 0) evidence.push(`${ehCount} Equal High${ehCount > 1 ? 's' : ''} (neutral)`)
  if (elCount > 0) evidence.push(`${elCount} Equal Low${elCount > 1 ? 's' : ''} (neutral)`)

  // Contradicting structure
  if (trend === 'bullish' && (lhCount > 0 || llCount > 0)) {
    evidence.push('Caution: counter-trend swings (LH/LL) present within the bullish sequence')
  }
  if (trend === 'bearish' && (hhCount > 0 || hlCount > 0)) {
    evidence.push('Caution: counter-trend swings (HH/HL) present within the bearish sequence')
  }

  // BOS events
  const bullBos = bosEvents.filter(e => e.direction === 'bullish')
  const bearBos = bosEvents.filter(e => e.direction === 'bearish')

  if (bullBos.length > 0) {
    const last = bullBos[bullBos.length - 1]
    evidence.push(
      `Bullish Break of Structure detected at ${last.level.toFixed(4)}` +
      (bullBos.length > 1 ? ` (${bullBos.length} total)` : ''),
    )
  }
  if (bearBos.length > 0) {
    const last = bearBos[bearBos.length - 1]
    evidence.push(
      `Bearish Break of Structure detected at ${last.level.toFixed(4)}` +
      (bearBos.length > 1 ? ` (${bearBos.length} total)` : ''),
    )
  }

  // CHOCH events
  if (chochEvents.length > 0) {
    const last = chochEvents[chochEvents.length - 1]
    evidence.push(
      `Change of Character at ${last.level.toFixed(4)} — potential ${last.direction} reversal signal` +
      ` (${chochEvents.length} total)`,
    )
  }

  // Consolidation
  if (consolidation.detected) {
    evidence.push(
      `Consolidation: price rangebound between ${consolidation.rangeLow!.toFixed(4)}` +
      ` and ${consolidation.rangeHigh!.toFixed(4)}` +
      ` (${consolidation.rangePercent!.toFixed(2)}% range, ${consolidation.barsInRange} bars)`,
    )
  }

  // Breakout
  if (breakout.confirmed) {
    evidence.push(
      `Confirmed ${breakout.direction} breakout above/below ${breakout.level!.toFixed(4)}` +
      ' with volume confirmation',
    )
  } else if (breakout.direction !== null) {
    evidence.push(
      `${breakout.direction} breakout attempt at ${breakout.level!.toFixed(4)}` +
      ' — insufficient volume for confirmation',
    )
  } else if (breakout.failed) {
    evidence.push('Failed breakout: price exited consolidation range but has returned inside')
  }

  // Pullback
  if (pullback.detected && pullback.depth !== null) {
    evidence.push(
      `Pullback in progress: ${(pullback.depth * 100).toFixed(1)}% retracement` +
      ' from BOS level toward structural anchor',
    )
  }

  return evidence
}
