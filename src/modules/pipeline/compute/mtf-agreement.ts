import type { MTFTimeframeInput, MTFAgreementLabel, MultiTimeframeAgreement } from '../types'

/**
 * Module 32 Part 5 — Multi-Timeframe Agreement.
 *
 * Computes directional agreement across timeframes from direction + grade,
 * NOT from score averages. A simple average of scores would hide cases where
 * 2 timeframes are at 10 bullish and 2 are at 10 bearish (mean=10, but agreement=0).
 *
 * Rules:
 *   4/4 same direction  → aligned
 *   3/4 same direction  → mostly_aligned
 *   2/4 same direction, no opposing → mixed (neutral divergence)
 *   2/4 same direction, 1+ opposing → mixed
 *   ≤1/4 dominant, 1+ opposing    → strong_conflict
 */
export function computeMTFAgreement(timeframes: MTFTimeframeInput[]): MultiTimeframeAgreement {
  if (timeframes.length === 0) {
    return {
      agreement: 'mixed',
      agreementScore: 0,
      timeframes,
      dominantDirection: 'neutral',
      conflictingCount: 0,
    }
  }

  const { dominant, opposite } = findDominantAndOpposite(timeframes)

  const dominantCount = timeframes.filter(tf => tf.direction === dominant).length
  const conflictingCount = timeframes.filter(tf => tf.direction === opposite).length
  const total = timeframes.length

  const agreement = classifyAgreement(dominantCount, conflictingCount, total)
  const agreementScore = computeAgreementScore(agreement, dominantCount, conflictingCount, total, timeframes)

  return {
    agreement,
    agreementScore,
    timeframes,
    dominantDirection: dominant,
    conflictingCount,
  }
}

function findDominantAndOpposite(
  timeframes: MTFTimeframeInput[],
): { dominant: 'bullish' | 'bearish' | 'neutral'; opposite: 'bullish' | 'bearish' | 'neutral' } {
  let bullish = 0
  let bearish = 0

  for (const tf of timeframes) {
    if (tf.direction === 'bullish') bullish++
    else if (tf.direction === 'bearish') bearish++
  }

  if (bullish > bearish) return { dominant: 'bullish', opposite: 'bearish' }
  if (bearish > bullish) return { dominant: 'bearish', opposite: 'bullish' }
  // Exact tie between bullish and bearish: treat bullish as dominant so
  // conflictingCount captures the opposing bearish count → classifies as strong_conflict.
  if (bullish > 0) return { dominant: 'bullish', opposite: 'bearish' }
  // All neutral: no directional conflict
  return { dominant: 'neutral', opposite: 'neutral' }
}

function classifyAgreement(
  dominantCount: number,
  conflictingCount: number,
  total: number,
): MTFAgreementLabel {
  const dominantRatio = dominantCount / total

  if (dominantRatio >= 1.0) return 'aligned'
  if (dominantRatio >= 0.75) return 'mostly_aligned'
  if (conflictingCount === 0) return 'mixed'
  if (dominantRatio >= 0.5 && conflictingCount <= 1) return 'mixed'
  return 'strong_conflict'
}

function computeAgreementScore(
  agreement: MTFAgreementLabel,
  dominantCount: number,
  conflictingCount: number,
  total: number,
  timeframes: MTFTimeframeInput[],
): number {
  // Base score from agreement label
  const base: Record<MTFAgreementLabel, number> = {
    aligned:        9.0,
    mostly_aligned: 6.5,
    mixed:          3.5,
    strong_conflict:1.0,
  }

  let score = base[agreement]

  // Bonus: high-grade dominant timeframes push the score toward 10
  const dominantGradeBonus = timeframes
    .filter(tf => tf.direction === dominantCount > 0 ? getDominantDir(timeframes) : 'neutral')
    .reduce((sum, tf) => sum + gradeWeight(tf.grade), 0) / Math.max(1, total)

  score += dominantGradeBonus * 0.5

  // Penalty: conflicting timeframes with strong grades pull it down
  const conflictPenalty = timeframes
    .filter(tf => tf.direction !== getDominantDir(timeframes) && tf.direction !== 'neutral')
    .reduce((sum, tf) => sum + gradeWeight(tf.grade), 0) / Math.max(1, total)

  score -= conflictPenalty * 0.5

  return Math.min(10, Math.max(0, parseFloat(score.toFixed(2))))
}

function getDominantDir(timeframes: MTFTimeframeInput[]): 'bullish' | 'bearish' | 'neutral' {
  return findDominantAndOpposite(timeframes).dominant
}

function gradeWeight(grade: MTFTimeframeInput['grade']): number {
  switch (grade) {
    case 'very_strong': return 1.0
    case 'strong':      return 0.75
    case 'moderate':    return 0.5
    case 'mixed':       return 0.25
    case 'weak':        return 0.0
  }
}
