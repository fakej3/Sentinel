import type { ConfidenceGrade } from '../types'
import type { EvidenceDirection, EvidenceImpact, FullTrendLabel } from '../types'

export function directionColor(dir: EvidenceDirection | 'bullish' | 'bearish' | 'neutral' | string): string {
  if (dir === 'bullish') return 'text-emerald-400'
  if (dir === 'bearish') return 'text-red-400'
  return 'text-slate-400'
}

export function directionBg(dir: string): string {
  if (dir === 'bullish') return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
  if (dir === 'bearish') return 'bg-red-400/10 text-red-400 border-red-400/20'
  return 'bg-slate-400/10 text-slate-400 border-slate-400/20'
}

export function impactColor(impact: EvidenceImpact): string {
  if (impact === 'high') return 'text-amber-400'
  if (impact === 'medium') return 'text-blue-400'
  return 'text-slate-500'
}

export function impactBg(impact: EvidenceImpact): string {
  if (impact === 'high') return 'bg-amber-400/10 text-amber-400 border-amber-400/20'
  if (impact === 'medium') return 'bg-blue-400/10 text-blue-400 border-blue-400/20'
  return 'bg-slate-500/10 text-slate-500 border-slate-500/20'
}

export function gradeColor(grade: ConfidenceGrade): string {
  switch (grade) {
    case 'very_strong': return 'text-emerald-300'
    case 'strong': return 'text-emerald-400'
    case 'moderate': return 'text-blue-400'
    case 'mixed': return 'text-amber-400'
    case 'weak': return 'text-red-400'
  }
}

export function gradeBg(grade: ConfidenceGrade): string {
  switch (grade) {
    case 'very_strong': return 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'
    case 'strong': return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
    case 'moderate': return 'bg-blue-400/10 text-blue-400 border-blue-400/20'
    case 'mixed': return 'bg-amber-400/10 text-amber-400 border-amber-400/20'
    case 'weak': return 'bg-red-400/10 text-red-400 border-red-400/20'
  }
}

export function trendColor(trend: FullTrendLabel | string): string {
  if (trend.includes('bullish')) return 'text-emerald-400'
  if (trend.includes('bearish')) return 'text-red-400'
  return 'text-slate-400'
}

export function trendBg(trend: FullTrendLabel | string): string {
  if (trend.includes('bullish')) return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
  if (trend.includes('bearish')) return 'bg-red-400/10 text-red-400 border-red-400/20'
  return 'bg-slate-400/10 text-slate-400 border-slate-400/20'
}

export function scoreGradient(score: number): string {
  if (score >= 8.5) return 'from-emerald-500 to-emerald-400'
  if (score >= 7.0) return 'from-emerald-600 to-emerald-500'
  if (score >= 5.0) return 'from-blue-600 to-blue-500'
  if (score >= 3.0) return 'from-amber-600 to-amber-500'
  return 'from-red-700 to-red-600'
}

export function scoreColor(score: number): string {
  if (score >= 8.5) return 'text-emerald-300'
  if (score >= 7.0) return 'text-emerald-400'
  if (score >= 5.0) return 'text-blue-400'
  if (score >= 3.0) return 'text-amber-400'
  return 'text-red-400'
}

export function scoreStroke(score: number): string {
  if (score >= 8.5) return '#6ee7b7'
  if (score >= 7.0) return '#34d399'
  if (score >= 5.0) return '#60a5fa'
  if (score >= 3.0) return '#fbbf24'
  return '#f87171'
}

export function changeColor(pct: number): string {
  if (pct > 0) return 'text-emerald-400'
  if (pct < 0) return 'text-red-400'
  return 'text-slate-400'
}

export function validityColor(passed: boolean): string {
  return passed ? 'text-emerald-400' : 'text-red-400'
}

export function severityColor(severity: string): string {
  if (severity === 'critical') return 'text-red-400'
  if (severity === 'warning') return 'text-amber-400'
  return 'text-blue-400'
}

export function severityBg(severity: string): string {
  if (severity === 'critical') return 'bg-red-400/10 text-red-400 border-red-400/20'
  if (severity === 'warning') return 'bg-amber-400/10 text-amber-400 border-amber-400/20'
  return 'bg-blue-400/10 text-blue-400 border-blue-400/20'
}

export function decisionColor(label: string): string {
  if (label === 'Strong Buy' || label === 'Buy') return 'text-emerald-400'
  if (label === 'Cautious Buy') return 'text-emerald-300'
  if (label === 'Strong Sell' || label === 'Sell') return 'text-red-400'
  if (label === 'Cautious Sell') return 'text-red-300'
  return 'text-slate-300'
}

export function decisionBg(label: string): string {
  if (label === 'Strong Buy' || label === 'Buy') return 'bg-emerald-400/10 border-emerald-500/20'
  if (label === 'Cautious Buy') return 'bg-emerald-400/5 border-emerald-500/15'
  if (label === 'Strong Sell' || label === 'Sell') return 'bg-red-400/10 border-red-500/20'
  if (label === 'Cautious Sell') return 'bg-red-400/5 border-red-500/15'
  return 'bg-slate-600/10 border-border-subtle'
}

export function riskBadgeColor(level: string): string {
  if (level === 'Low') return 'bg-emerald-400/10 text-emerald-400 border border-emerald-500/20'
  if (level === 'High') return 'bg-red-400/10 text-red-400 border border-red-500/20'
  return 'bg-amber-400/10 text-amber-400 border border-amber-500/20'
}
