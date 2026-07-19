/**
 * Sentinel Phase 2 — Professional Trading Validation
 *
 * Extends module38 to 15 symbols × 4 timeframes (including 1d).
 * Adds Phase 4 (weakness identification), Phase 5 (professional trader
 * perspective), and Phase 6 (evidence-based fix proposals).
 *
 * Usage:
 *   node_modules/.bin/tsx src/modules/historical-validation/phase2/bin.ts
 */
import { writeFileSync } from 'node:fs'
import type { Candle, Timeframe } from '../../market/types.js'
import type { CalibrationDashboard } from '../types.js'
import type { ValidationRecord } from '../types.js'
import { walkCandles } from '../walk.js'
import { buildDashboard } from '../dashboard.js'
import { generateMultiRegimeCandles } from '../module38/scenarios.js'
import { computeExtendedMetrics } from '../module38/extended-metrics.js'
import type { DatasetResult, ExtendedMetrics } from '../module38/extended-metrics.js'
import { generatePhase2Report } from './report.js'

// ── Constants ─────────────────────────────────────────────────────────────────

export const PHASE2_SYMBOLS = [
  // Original 10 (module38)
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT',
  // 5 additional for Phase 2
  'FETUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT', 'PEPEUSDT',
] as const

export const PHASE2_TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h', '1d']

// Symbol categorization for Phase 5 analysis
export const SYMBOL_CATEGORY: Record<string, 'major' | 'large_alt' | 'mid_alt' | 'meme'> = {
  BTCUSDT:  'major',
  ETHUSDT:  'major',
  BNBUSDT:  'large_alt',
  SOLUSDT:  'large_alt',
  XRPUSDT:  'large_alt',
  ADAUSDT:  'large_alt',
  LINKUSDT: 'large_alt',
  AVAXUSDT: 'large_alt',
  DOGEUSDT: 'meme',
  SUIUSDT:  'mid_alt',
  FETUSDT:  'mid_alt',
  ARBUSDT:  'mid_alt',
  OPUSDT:   'mid_alt',
  INJUSDT:  'mid_alt',
  PEPEUSDT: 'meme',
}

// ── Extended candle generator ─────────────────────────────────────────────────

/**
 * Generate candles for Phase 2: all 15 symbols + 1d timeframe support.
 * Unknown symbols get default price=100 (which is fine for relative analysis).
 * For 1d, we use 4h candles and rescale timestamps to daily spacing.
 */
export function generatePhase2Candles(symbol: string, timeframe: Timeframe): Candle[] {
  // Generate using the module38 generator (handles all regimes)
  // For 1d: use 4h as the proxy timeframe, then rescale timestamps
  const sourceTf: Timeframe = timeframe === '1d' ? '4h' : timeframe
  const candles = generateMultiRegimeCandles(symbol, sourceTf)

  if (timeframe === '1d') {
    const START    = 1_704_067_200_000  // 2024-01-01 00:00 UTC
    const ONE_DAY  = 86_400_000
    return candles.map((c, i) => ({
      ...c,
      openTime:  START + i * ONE_DAY,
      closeTime: START + i * ONE_DAY + ONE_DAY - 1,
    }))
  }

  return candles
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeaknessItem {
  category: string
  description: string
  evidence: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  sampleSize: number
  winRate: number | null
}

export interface Phase4Result {
  weaknesses: WeaknessItem[]
  worstRegimes: Array<{ label: string; winRate: number | null; count: number }>
  worstTimeframes: Array<{ tf: string; winRate: number | null; count: number }>
  worstSymbolCategories: Array<{ category: string; winRate: number | null; count: number }>
  confCalibrationGaps: Array<{ bucket: string; confScore: string; actualWR: number | null; trades: number; gap: number }>
}

export interface ProTraderSetupResult {
  total: number
  wins: number
  losses: number
  winRate: number | null
}

export interface Phase5Result {
  proGradeSetups: ProTraderSetupResult
  allSetups: ProTraderSetupResult
  entryQuality: { score: number; breakdown: Record<string, number> }
  stopQuality:  { score: number; tooTight: number; appropriate: number; tooWide: number }
  targetQuality:{ score: number; realistic: number; aggressive: number; conservative: number }
  overconfidenceCases: Array<{
    bucket: string
    confRange: string
    winRate: number | null
    expectedWR: number
    tradeDelta: number
    trades: number
  }>
  categoryStats: Array<{ category: string; label: string; winRate: number | null; trades: number }>
  timeframeVerdict: Array<{ tf: string; verdict: string; winRate: number | null }>
  proInsights: string[]
}

export interface Phase6Proposal {
  id: string
  title: string
  weakness: string
  evidence: string
  codeLocation: string
  proposedChange: string
  expectedImpact: string
  priority: 'high' | 'medium' | 'low'
}

export interface Phase6Result {
  proposals: Phase6Proposal[]
  summary: string
}

export interface Phase2Output {
  results:    DatasetResult[]
  dashboards: CalibrationDashboard[]
  metrics:    ExtendedMetrics
  phase4:     Phase4Result
  phase5:     Phase5Result
  phase6:     Phase6Result
  html:       string
}

// ── Phase 4: Weakness identification ─────────────────────────────────────────

export function analyzeWeaknesses(
  results: DatasetResult[],
  metrics: ExtendedMetrics,
): Phase4Result {
  const allRecords = results.flatMap(r => r.records)

  // ── By regime ────────────────────────────────────────────────────────────
  const worstRegimes = metrics.regimeStats
    .filter(r => r.winCount + r.lossCount >= 5)
    .sort((a, b) => (a.winRate ?? 1) - (b.winRate ?? 1))
    .slice(0, 4)
    .map(r => ({ label: r.label, winRate: r.winRate, count: r.winCount + r.lossCount }))

  // ── By timeframe ─────────────────────────────────────────────────────────
  const tfMap = new Map<string, { wins: number; losses: number }>()
  for (const d of metrics.datasets) {
    const e = tfMap.get(d.timeframe) ?? { wins: 0, losses: 0 }
    e.wins   += d.winCount
    e.losses += d.lossCount
    tfMap.set(d.timeframe, e)
  }
  const worstTimeframes = Array.from(tfMap.entries())
    .map(([tf, { wins, losses }]) => ({
      tf,
      winRate: wins + losses > 0 ? wins / (wins + losses) : null,
      count:   wins + losses,
    }))
    .sort((a, b) => (a.winRate ?? 1) - (b.winRate ?? 1))

  // ── By symbol category ───────────────────────────────────────────────────
  const catMap = new Map<string, { wins: number; losses: number }>()
  for (const d of metrics.datasets) {
    const cat = SYMBOL_CATEGORY[d.symbol] ?? 'unknown'
    const e   = catMap.get(cat) ?? { wins: 0, losses: 0 }
    e.wins   += d.winCount
    e.losses += d.lossCount
    catMap.set(cat, e)
  }
  const worstSymbolCategories = Array.from(catMap.entries())
    .map(([category, { wins, losses }]) => ({
      category,
      winRate: wins + losses > 0 ? wins / (wins + losses) : null,
      count:   wins + losses,
    }))
    .sort((a, b) => (a.winRate ?? 1) - (b.winRate ?? 1))

  // ── Confidence calibration gaps ──────────────────────────────────────────
  const confGapMap = new Map<string, { wins: number; losses: number; midConf: number }>()
  const CONF_BUCKETS = [
    { label: '9-10', min: 9, max: 10, mid: 9.5 },
    { label: '8-9',  min: 8, max: 9,  mid: 8.5 },
    { label: '7-8',  min: 7, max: 8,  mid: 7.5 },
    { label: '6-7',  min: 6, max: 7,  mid: 6.5 },
    { label: '5-6',  min: 5, max: 6,  mid: 5.5 },
    { label: '4-5',  min: 4, max: 5,  mid: 4.5 },
    { label: '3-4',  min: 3, max: 4,  mid: 3.5 },
    { label: '0-3',  min: 0, max: 3,  mid: 1.5 },
  ]

  for (const r of allRecords) {
    if (r.outcome.result === 'no_trade' || r.outcome.result === 'neither') continue
    const score  = r.snapshot.pipeline.confidence.score
    const bucket = CONF_BUCKETS.find(b => score >= b.min && score < b.max) ?? CONF_BUCKETS[CONF_BUCKETS.length - 1]
    const key    = bucket.label
    const e      = confGapMap.get(key) ?? { wins: 0, losses: 0, midConf: bucket.mid }
    if (r.outcome.result === 'tp_hit')  e.wins++
    else                                e.losses++
    confGapMap.set(key, e)
  }

  const confCalibrationGaps = Array.from(confGapMap.entries())
    .map(([bucket, { wins, losses, midConf }]) => {
      const trades = wins + losses
      const actualWR = trades > 0 ? wins / trades : null
      const expectedWR = midConf / 10  // naive expectation: score 8.5 → 85% WR
      const gap = actualWR !== null ? actualWR - expectedWR : 0
      return { bucket, confScore: `${midConf.toFixed(1)}`, actualWR, trades, gap }
    })
    .filter(r => r.trades >= 3)
    .sort((a, b) => a.gap - b.gap)  // most overconfident first

  // ── Synthesize weaknesses ────────────────────────────────────────────────
  const weaknesses: WeaknessItem[] = []

  // Check regime weaknesses
  for (const r of worstRegimes) {
    if (r.winRate !== null && r.winRate < 0.45) {
      weaknesses.push({
        category: 'regime_performance',
        description: `Poor performance in ${r.label} regime`,
        evidence: `Win rate ${(r.winRate * 100).toFixed(1)}% across ${r.count} resolved trades`,
        severity: r.winRate < 0.35 ? 'high' : 'medium',
        sampleSize: r.count,
        winRate: r.winRate,
      })
    }
  }

  // Check confidence calibration
  const severeGaps = confCalibrationGaps.filter(g => g.gap < -0.2 && g.trades >= 5)
  for (const g of severeGaps) {
    weaknesses.push({
      category: 'confidence_calibration',
      description: `Overconfidence in ${g.bucket} bucket (expected ${(g.gap + (g.actualWR ?? 0) * 100).toFixed(0)}%, actual ${g.actualWR !== null ? (g.actualWR * 100).toFixed(1) : 'n/a'}%)`,
      evidence: `${g.trades} trades; confidence ${g.confScore} expected ~${((g.gap + (g.actualWR ?? 0)) * 100).toFixed(0)}% WR, got ${g.actualWR !== null ? (g.actualWR * 100).toFixed(1) : 'n/a'}%`,
      severity: g.gap < -0.3 ? 'high' : 'medium',
      sampleSize: g.trades,
      winRate: g.actualWR,
    })
  }

  // Check loss category systemics
  const badRR       = metrics.lossCategoryBreakdown.find(c => c.category === 'bad_rr')
  const stopTight   = metrics.lossCategoryBreakdown.find(c => c.category === 'stop_too_tight')
  const weakTrend   = metrics.lossCategoryBreakdown.find(c => c.category === 'weak_trend')
  const latEntry    = metrics.lossCategoryBreakdown.find(c => c.category === 'late_entry')

  if (badRR && badRR.pct > 15) {
    weaknesses.push({
      category: 'trade_planning',
      description: 'High proportion of trades taken with bad R:R (<1.5)',
      evidence: `${badRR.pct.toFixed(1)}% of losses (${badRR.count} trades) had R:R < 1.5`,
      severity: badRR.pct > 25 ? 'high' : 'medium',
      sampleSize: badRR.count,
      winRate: null,
    })
  }

  if (stopTight && stopTight.pct > 10) {
    weaknesses.push({
      category: 'stop_placement',
      description: 'Stops placed too close to entry (< 0.5% from entry)',
      evidence: `${stopTight.pct.toFixed(1)}% of losses (${stopTight.count} trades) had stops < 0.5% from entry`,
      severity: stopTight.pct > 20 ? 'high' : 'medium',
      sampleSize: stopTight.count,
      winRate: null,
    })
  }

  if (weakTrend && weakTrend.pct > 20) {
    weaknesses.push({
      category: 'trend_detection',
      description: 'Excessive trading in weak-trend conditions',
      evidence: `${weakTrend.pct.toFixed(1)}% of losses (${weakTrend.count} trades) due to weak trend signals`,
      severity: weakTrend.pct > 30 ? 'high' : 'medium',
      sampleSize: weakTrend.count,
      winRate: null,
    })
  }

  if (latEntry && latEntry.pct > 15) {
    weaknesses.push({
      category: 'entry_timing',
      description: 'Late entry pattern: adverse move > 1.8× stop distance before reversal attempt',
      evidence: `${latEntry.pct.toFixed(1)}% of losses (${latEntry.count} trades) classified as late entry`,
      severity: latEntry.pct > 25 ? 'high' : 'medium',
      sampleSize: latEntry.count,
      winRate: null,
    })
  }

  // Check MTF conflict impact
  const conflictBin = metrics.mtfAgreementStats.find(s => s.agreement === 'strong_conflict')
  const alignedBin  = metrics.mtfAgreementStats.find(s => s.agreement === 'aligned')
  if (
    conflictBin && alignedBin &&
    conflictBin.winRate !== null && alignedBin.winRate !== null &&
    conflictBin.winRate < alignedBin.winRate - 0.1
  ) {
    weaknesses.push({
      category: 'mtf_agreement',
      description: 'MTF conflict significantly hurts win rate',
      evidence: `Aligned: ${(alignedBin.winRate * 100).toFixed(1)}% WR vs Strong Conflict: ${(conflictBin.winRate * 100).toFixed(1)}% WR`,
      severity: 'medium',
      sampleSize: conflictBin.count,
      winRate: conflictBin.winRate,
    })
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  weaknesses.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return { weaknesses, worstRegimes, worstTimeframes, worstSymbolCategories, confCalibrationGaps }
}

// ── Phase 5: Professional trader review ──────────────────────────────────────

export function professionalReview(
  results: DatasetResult[],
  metrics: ExtendedMetrics,
): Phase5Result {
  const allRecords = results.flatMap(r => r.records)
  const resolved   = allRecords.filter(r =>
    r.outcome.result === 'tp_hit' || r.outcome.result === 'sl_hit',
  )

  // ── Pro-grade filter: confidence ≥ 7.0, quality = excellent | good ────────
  const proGrade = resolved.filter(r => {
    const { confidence, tradePlan } = r.snapshot.pipeline
    return (
      confidence.score >= 7.0 &&
      (tradePlan.setupQuality === 'excellent' || tradePlan.setupQuality === 'good')
    )
  })

  const proWins   = proGrade.filter(r => r.outcome.result === 'tp_hit').length
  const proLosses = proGrade.filter(r => r.outcome.result === 'sl_hit').length
  const allWins   = resolved.filter(r => r.outcome.result === 'tp_hit').length
  const allLosses = resolved.filter(r => r.outcome.result === 'sl_hit').length

  const proGradeSetups: ProTraderSetupResult = {
    total: proGrade.length,
    wins: proWins,
    losses: proLosses,
    winRate: proGrade.length > 0 ? proWins / proGrade.length : null,
  }
  const allSetups: ProTraderSetupResult = {
    total: resolved.length,
    wins: allWins,
    losses: allLosses,
    winRate: resolved.length > 0 ? allWins / resolved.length : null,
  }

  // ── Entry quality analysis ────────────────────────────────────────────────
  // Good: entry zone clearly near S/R
  // Acceptable: entry zone present but S/R context unclear
  // Poor: no entry zone or entry away from S/R
  let entryGood = 0, entryAccept = 0, entryPoor = 0
  for (const r of resolved) {
    const { tradePlan, analysis } = r.snapshot.pipeline
    const { srContext } = analysis
    if (!tradePlan.entryZone) {
      entryPoor++
    } else if (srContext.insideSupport || srContext.insideResistance ||
               srContext.approachingSupport || srContext.approachingResistance) {
      entryGood++
    } else {
      entryAccept++
    }
  }
  const entryTotal = entryGood + entryAccept + entryPoor
  const entryScore = entryTotal > 0
    ? Math.round((entryGood * 100 + entryAccept * 50) / entryTotal)
    : 0

  // ── Stop quality analysis ─────────────────────────────────────────────────
  let stopTight = 0, stopApprop = 0, stopWide = 0
  for (const r of resolved) {
    const { entryPrice, stopPrice } = r.outcome
    if (entryPrice === null || stopPrice === null) continue
    const dist = Math.abs(entryPrice - stopPrice) / entryPrice
    if (dist < 0.005)       stopTight++
    else if (dist > 0.04)   stopWide++
    else                    stopApprop++
  }
  const stopTotal = stopTight + stopApprop + stopWide
  const stopScore = stopTotal > 0
    ? Math.round((stopApprop * 100 + stopWide * 50) / stopTotal)
    : 0

  // ── Target quality analysis ───────────────────────────────────────────────
  let targetRealistic = 0, targetAggressive = 0, targetConservative = 0
  for (const r of resolved) {
    const { entryPrice, targetPrice, stopPrice } = r.outcome
    if (entryPrice === null || targetPrice === null || stopPrice === null) continue
    const riskDist   = Math.abs(entryPrice - stopPrice)
    const rewardDist = Math.abs(targetPrice - entryPrice)
    const rr = riskDist > 0 ? rewardDist / riskDist : 0
    if (rr >= 2.0 && rr <= 8.0)   targetRealistic++
    else if (rr > 8.0)             targetAggressive++
    else                           targetConservative++
  }
  const targetTotal = targetRealistic + targetAggressive + targetConservative
  const targetScore = targetTotal > 0
    ? Math.round((targetRealistic * 100 + targetConservative * 50) / targetTotal)
    : 0

  // ── Overconfidence detection ──────────────────────────────────────────────
  const CONF_BUCKETS_ORDERED = [
    { label: '9-10', min: 9, max: 10, expected: 0.85 },
    { label: '8-9',  min: 8, max: 9,  expected: 0.75 },
    { label: '7-8',  min: 7, max: 8,  expected: 0.65 },
    { label: '6-7',  min: 6, max: 7,  expected: 0.55 },
    { label: '5-6',  min: 5, max: 6,  expected: 0.45 },
    { label: '4-5',  min: 4, max: 5,  expected: 0.38 },
    { label: '0-4',  min: 0, max: 4,  expected: 0.30 },
  ]

  const overconfidenceCases = CONF_BUCKETS_ORDERED.map(b => {
    const inBucket = resolved.filter(r => {
      const s = r.snapshot.pipeline.confidence.score
      return s >= b.min && s < b.max
    })
    const wins   = inBucket.filter(r => r.outcome.result === 'tp_hit').length
    const losses = inBucket.filter(r => r.outcome.result === 'sl_hit').length
    const trades = wins + losses
    const winRate = trades > 0 ? wins / trades : null
    const delta   = winRate !== null ? winRate - b.expected : 0
    return {
      bucket:     b.label,
      confRange:  b.label,
      winRate,
      expectedWR: b.expected,
      tradeDelta: delta,
      trades,
    }
  }).filter(b => b.trades >= 3)

  // ── Per-category stats ────────────────────────────────────────────────────
  const catWins   = new Map<string, number>()
  const catLosses = new Map<string, number>()
  for (const r of resolved) {
    const cat = SYMBOL_CATEGORY[r.snapshot.symbol] ?? 'unknown'
    if (r.outcome.result === 'tp_hit') catWins.set(cat, (catWins.get(cat) ?? 0) + 1)
    else catLosses.set(cat, (catLosses.get(cat) ?? 0) + 1)
  }
  const CATEGORY_LABELS: Record<string, string> = {
    major: 'Major (BTC, ETH)',
    large_alt: 'Large Alt (BNB, SOL, XRP, ADA, LINK, AVAX)',
    mid_alt: 'Mid Alt (SUI, FET, ARB, OP, INJ)',
    meme: 'Meme (DOGE, PEPE)',
    unknown: 'Unknown',
  }
  const categoryStats = Array.from(new Set([...catWins.keys(), ...catLosses.keys()])).map(cat => {
    const w = catWins.get(cat) ?? 0
    const l = catLosses.get(cat) ?? 0
    return {
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
      winRate: w + l > 0 ? w / (w + l) : null,
      trades: w + l,
    }
  }).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))

  // ── Per-timeframe verdict ─────────────────────────────────────────────────
  const tfStats = new Map<string, { wins: number; losses: number }>()
  for (const r of resolved) {
    const tf = r.snapshot.timeframe
    const e  = tfStats.get(tf) ?? { wins: 0, losses: 0 }
    if (r.outcome.result === 'tp_hit') e.wins++
    else e.losses++
    tfStats.set(tf, e)
  }
  const timeframeVerdict = Array.from(tfStats.entries()).map(([tf, { wins, losses }]) => {
    const wr = wins + losses > 0 ? wins / (wins + losses) : null
    const verdict = wr === null ? 'No data'
      : wr >= 0.60 ? 'Excellent — use freely'
      : wr >= 0.50 ? 'Acceptable — use with confirmation'
      : wr >= 0.40 ? 'Marginal — tighten filters'
      : 'Poor — avoid or major revision needed'
    return { tf, verdict, winRate: wr }
  }).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))

  // ── Pro insights ──────────────────────────────────────────────────────────
  const proInsights: string[] = []

  const proWR = proGradeSetups.winRate
  const allWR = allSetups.winRate
  if (proWR !== null && allWR !== null) {
    if (proWR > allWR + 0.05) {
      proInsights.push(`Pro-grade filter (conf ≥ 7, quality excellent/good) lifts win rate from ${(allWR * 100).toFixed(1)}% to ${(proWR * 100).toFixed(1)}% — the quality signal is working`)
    } else if (Math.abs(proWR - allWR) <= 0.05) {
      proInsights.push(`Pro-grade filter barely changes win rate (${(allWR * 100).toFixed(1)}% → ${(proWR * 100).toFixed(1)}%) — the quality filter may not be discriminating enough`)
    } else {
      proInsights.push(`Pro-grade filter reduces win rate from ${(allWR * 100).toFixed(1)}% to ${(proWR * 100).toFixed(1)}% — high-quality setups are not outperforming the general pool`)
    }
  }

  const overconfidentBuckets = overconfidenceCases.filter(c => c.tradeDelta < -0.15)
  if (overconfidentBuckets.length > 0) {
    const worst = overconfidentBuckets[0]
    proInsights.push(`Engine is overconfident in the ${worst.bucket} confidence bucket: expected ${(worst.expectedWR * 100).toFixed(0)}% win rate, actual ${worst.winRate !== null ? (worst.winRate * 100).toFixed(1) : 'n/a'}%`)
  }

  const underconfidentBuckets = overconfidenceCases.filter(c => c.tradeDelta > 0.15)
  if (underconfidentBuckets.length > 0) {
    const best = underconfidentBuckets[underconfidentBuckets.length - 1]
    proInsights.push(`Engine is underconfident in the ${best.bucket} bucket: expected ${(best.expectedWR * 100).toFixed(0)}%, actual ${best.winRate !== null ? (best.winRate * 100).toFixed(1) : 'n/a'}% — score may be too conservative here`)
  }

  if (stopTight > stopTotal * 0.15) {
    proInsights.push(`${((stopTight / Math.max(1, stopTotal)) * 100).toFixed(0)}% of trades have stops closer than 0.5% from entry — a professional trader would widen stops to survive normal intrabar noise`)
  }

  if (entryPoor > entryTotal * 0.2) {
    proInsights.push(`${((entryPoor / Math.max(1, entryTotal)) * 100).toFixed(0)}% of trades lack a defined entry zone — without a specific level, sizing and execution are guess-work`)
  }

  const bestCat = categoryStats.find(c => c.winRate !== null && c.trades >= 5)
  const worstCat = [...categoryStats].reverse().find(c => c.winRate !== null && c.trades >= 5)
  if (bestCat && worstCat && bestCat.category !== worstCat.category) {
    proInsights.push(`${bestCat.label} performs best (${(bestCat.winRate! * 100).toFixed(1)}% WR), ${worstCat.label} performs worst (${(worstCat.winRate! * 100).toFixed(1)}% WR)`)
  }

  return {
    proGradeSetups,
    allSetups,
    entryQuality: {
      score: entryScore,
      breakdown: { good: entryGood, acceptable: entryAccept, poor: entryPoor },
    },
    stopQuality: { score: stopScore, tooTight: stopTight, appropriate: stopApprop, tooWide: stopWide },
    targetQuality: { score: targetScore, realistic: targetRealistic, aggressive: targetAggressive, conservative: targetConservative },
    overconfidenceCases,
    categoryStats,
    timeframeVerdict,
    proInsights,
  }
}

// ── Phase 6: Evidence-based proposals ────────────────────────────────────────

export function generateProposals(
  phase4: Phase4Result,
  phase5: Phase5Result,
  metrics: ExtendedMetrics,
): Phase6Result {
  const proposals: Phase6Proposal[] = []

  // ── Proposal: Weak trend confidence cap ──────────────────────────────────
  const weakTrendLoss = metrics.lossCategoryBreakdown.find(c => c.category === 'weak_trend')
  if (weakTrendLoss && weakTrendLoss.pct > 15) {
    proposals.push({
      id:       'P1',
      title:    'Tighten weak-trend confidence cap',
      weakness: `${weakTrendLoss.pct.toFixed(1)}% of losses are due to weak trend signals (trend includes 'weak' or ranging)`,
      evidence: `${weakTrendLoss.count} trades lost specifically because the trend was weak. Current cap is 6.5 (config.weakTrendScoreCap).`,
      codeLocation: 'src/modules/confidence/config.ts:163 (weakTrendScoreCap: 6.5)',
      proposedChange: 'Reduce weakTrendScoreCap from 6.5 to 5.5 to further restrict trade signals when trend is ambiguous. The trade plan setup-quality downgrade for weak trends (trade-plan.ts) may also need strengthening.',
      expectedImpact: 'Estimated 10–20% reduction in weak-trend losses. Win rate improvement depends on whether filtered trades have a win rate < overall.',
      priority: weakTrendLoss.pct > 25 ? 'high' : 'medium',
    })
  }

  // ── Proposal: Stop placement ─────────────────────────────────────────────
  const stopTightLoss = metrics.lossCategoryBreakdown.find(c => c.category === 'stop_too_tight')
  if (stopTightLoss && stopTightLoss.pct > 10) {
    proposals.push({
      id:       'P2',
      title:    'Add ATR-based minimum stop distance',
      weakness: `${stopTightLoss.pct.toFixed(1)}% of losses had stops < 0.5% from entry (${stopTightLoss.count} trades)`,
      evidence: `${phase5.stopQuality.tooTight} resolved trades had stops tighter than 0.5%, which is insufficient for intrabar noise in most crypto markets.`,
      codeLocation: 'src/modules/pipeline/compute/trade-plan.ts (invalidationLevel calculation)',
      proposedChange: 'Enforce minimum stop distance of max(current_stop, entry × 0.008). When ATR is available (analysis.price.atrPercent), use max(current_stop, entry × atrPercent × 1.5) as minimum.',
      expectedImpact: 'Wider stops reduce premature stop-outs. Expect 5–15% fewer stop_too_tight losses at the cost of slightly larger risk-per-trade.',
      priority: stopTightLoss.pct > 20 ? 'high' : 'medium',
    })
  }

  // ── Proposal: Bad R:R filter ─────────────────────────────────────────────
  const badRRLoss = metrics.lossCategoryBreakdown.find(c => c.category === 'bad_rr')
  if (badRRLoss && badRRLoss.pct > 15) {
    proposals.push({
      id:       'P3',
      title:    'Enforce minimum R:R threshold in trade plan',
      weakness: `${badRRLoss.pct.toFixed(1)}% of losses had R:R < 1.5 (${badRRLoss.count} trades) — these setups should not have been taken`,
      evidence: 'The current pipeline allows any positive R:R. A professional trader would skip trades below 2:1.',
      codeLocation: 'src/modules/pipeline/compute/trade-plan.ts (setupQuality computation)',
      proposedChange: 'When riskRewardRatio < 1.5, force setupQuality to "poor" and patienceMessage should explicitly state "R:R insufficient for this setup". Consider "no_setup" below 1.0.',
      expectedImpact: 'Estimated 15–25% reduction in poor-setup losses. Will reduce signal rate by similar proportion.',
      priority: 'high',
    })
  }

  // ── Proposal: Overconfidence calibration ─────────────────────────────────
  const severeOverconf = phase5.overconfidenceCases.filter(c => c.tradeDelta < -0.2 && c.trades >= 5)
  if (severeOverconf.length > 0) {
    const worst = severeOverconf[0]
    proposals.push({
      id:       'P4',
      title:    'Recalibrate confidence engine normalization divisor',
      weakness: `Confidence ${worst.confRange} bucket expects ~${(worst.expectedWR * 100).toFixed(0)}% WR but delivers ${worst.winRate !== null ? (worst.winRate * 100).toFixed(1) : 'n/a'}%`,
      evidence: `${severeOverconf.map(c => `${c.bucket}: ${c.winRate !== null ? (c.winRate * 100).toFixed(1) : 'n/a'}% actual vs ${(c.expectedWR * 100).toFixed(0)}% expected`).join('; ')}`,
      codeLocation: 'src/modules/confidence/config.ts:140 (normalizationDivisor: 10)',
      proposedChange: 'Increase normalizationDivisor from 10 to 12–14 to compress scores into a more realistic range. Alternatively, add a post-calibration sigmoid squash: score = 10 / (1 + exp(-0.4 * (rawScore - 5))). Measure win-rate-vs-score correlation after adjustment.',
      expectedImpact: 'Compressed scores (e.g., 8.5 becomes 7.0) will better reflect actual win rates. Reduces user overreliance on numeric confidence values.',
      priority: 'medium',
    })
  }

  // ── Proposal: Ranging market filter ─────────────────────────────────────
  const rangingRegime = metrics.regimeStats.find(r => r.regime === 'range')
  if (rangingRegime && rangingRegime.winRate !== null && rangingRegime.winRate < 0.45) {
    proposals.push({
      id:       'P5',
      title:    'Suppress directional signals in confirmed ranging markets',
      weakness: `Ranging regime win rate: ${(rangingRegime.winRate * 100).toFixed(1)}% across ${rangingRegime.winCount + rangingRegime.lossCount} trades`,
      evidence: 'The engine generates bullish/bearish signals in ranging markets, which are not directional by definition. Ranging signal quality is inherently lower.',
      codeLocation: 'src/modules/pipeline/compute/trade-plan.ts (direction logic), src/modules/analysis/index.ts (fullTrend)',
      proposedChange: 'When fullTrend.trend === "ranging": (1) set setupQuality to "no_setup" regardless of S/R, (2) patienceMessage should exclusively reference breakout confirmation. Do not generate directional entry zones in ranging.',
      expectedImpact: 'Eliminates low-quality directional signals in range-bound markets. Win rate in remaining setups should improve. Expect 5–10% reduction in signal rate.',
      priority: rangingRegime.winRate < 0.4 ? 'high' : 'medium',
    })
  }

  // ── Proposal: Late entry detection ──────────────────────────────────────
  const lateEntry = metrics.lossCategoryBreakdown.find(c => c.category === 'late_entry')
  if (lateEntry && lateEntry.pct > 15) {
    proposals.push({
      id:       'P6',
      title:    'Add trade maturity gating to prevent late entries',
      weakness: `${lateEntry.pct.toFixed(1)}% of losses (${lateEntry.count} trades) are late entries where the adverse move exceeded 1.8× stop distance from the start`,
      evidence: 'Late entries occur when the engine signals a bullish setup after the move has already extended, leaving the entry near the top with stop blown immediately.',
      codeLocation: 'src/modules/pipeline/compute/trade-maturity.ts (maturityScore), src/modules/pipeline/compute/trade-plan.ts',
      proposedChange: 'Expose the maturityScore in the trade plan quality gate. When maturityScore < 30 ("immature"), set setupQuality to "poor" or suppress the trade signal. Module 41 validation showed this filter saves a meaningful proportion of losses.',
      expectedImpact: 'Module 41 already validated this pattern. Estimated 5–15% reduction in late-entry losses, depending on maturity threshold chosen.',
      priority: 'medium',
    })
  }

  const summary = proposals.length === 0
    ? 'No systematic weaknesses found requiring code changes. Engine is performing well.'
    : `${proposals.length} evidence-based improvement proposals identified. High-priority: ${proposals.filter(p => p.priority === 'high').length}. All proposals require statistical validation on additional data before implementation.`

  return { proposals, summary }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runPhase2(options?: {
  outputPath?:      string
  stepSize?:        number
  forwardLookBars?: number
  minCandleCount?:  number
  verbose?:         boolean
}): Promise<Phase2Output> {
  const {
    outputPath,
    stepSize        = 10,
    forwardLookBars = 20,
    minCandleCount  = 50,
    verbose         = false,
  } = options ?? {}

  const results:    DatasetResult[]       = []
  const dashboards: CalibrationDashboard[] = []

  const totalDatasets = PHASE2_SYMBOLS.length * PHASE2_TIMEFRAMES.length
  let processed = 0

  if (verbose) {
    console.log(`\nPhase 2 — Professional Trading Validation`)
    console.log(`${PHASE2_SYMBOLS.length} symbols × ${PHASE2_TIMEFRAMES.length} timeframes = ${totalDatasets} datasets\n`)
  }

  for (const symbol of PHASE2_SYMBOLS) {
    for (const timeframe of PHASE2_TIMEFRAMES) {
      if (verbose) {
        process.stdout.write(`  [${String(++processed).padStart(2, '0')}/${totalDatasets}] ${symbol} ${timeframe} ... `)
      } else {
        processed++
      }

      const candles = generatePhase2Candles(symbol, timeframe)

      const records = await walkCandles(symbol, timeframe, candles, {
        minCandleCount,
        stepSize,
        forwardLookBars,
      })

      const dashboard = buildDashboard(records, symbol, timeframe, candles.length)

      results.push({ symbol, timeframe, records })
      dashboards.push(dashboard)

      if (verbose) {
        const act  = records.filter(r => r.outcome.result !== 'no_trade')
        const wins = act.filter(r => r.outcome.result === 'tp_hit')
        const loss = act.filter(r => r.outcome.result === 'sl_hit')
        const wr   = wins.length + loss.length > 0
          ? (wins.length / (wins.length + loss.length) * 100).toFixed(1)
          : 'n/a'
        console.log(`${records.length} snapshots, ${act.length} trades, win=${wr}%`)
      }
    }
  }

  if (verbose) console.log('\nComputing extended metrics...')
  const metrics = computeExtendedMetrics(results)

  if (verbose) console.log('Phase 4: Weakness analysis...')
  const phase4 = analyzeWeaknesses(results, metrics)

  if (verbose) console.log('Phase 5: Professional trader review...')
  const phase5 = professionalReview(results, metrics)

  if (verbose) console.log('Phase 6: Generating proposals...')
  const phase6 = generateProposals(phase4, phase5, metrics)

  if (verbose) console.log('Generating HTML report...')
  const html = generatePhase2Report(results, metrics, dashboards, phase4, phase5, phase6)

  if (outputPath) {
    writeFileSync(outputPath, html, 'utf-8')
    if (verbose) console.log(`\nReport written to: ${outputPath}`)
  }

  return { results, dashboards, metrics, phase4, phase5, phase6, html }
}
