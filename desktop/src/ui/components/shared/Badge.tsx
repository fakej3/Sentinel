import { clsx } from 'clsx'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ children, className, dot }: BadgeProps) {
  return (
    <span
      className={clsx(
        'tag border',
        className,
      )}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 flex-shrink-0" />
      )}
      {children}
    </span>
  )
}

interface TrendBadgeProps {
  trend: string
}

export function TrendBadge({ trend }: TrendBadgeProps) {
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')
  const label = trend.replace(/_/g, ' ')

  return (
    <Badge
      dot
      className={clsx(
        isBullish && 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
        isBearish && 'bg-red-400/10 text-red-400 border-red-400/20',
        !isBullish && !isBearish && 'bg-slate-400/10 text-slate-400 border-slate-400/20',
      )}
    >
      {label}
    </Badge>
  )
}

interface GradeBadgeProps {
  grade: string
}

export function GradeBadge({ grade }: GradeBadgeProps) {
  const gradeMap: Record<string, string> = {
    very_strong: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
    strong: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    moderate: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    mixed: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    weak: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const label = grade.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <Badge dot className={gradeMap[grade] ?? 'bg-slate-400/10 text-slate-400 border-slate-400/20'}>
      {label}
    </Badge>
  )
}

interface SeverityBadgeProps {
  severity: string
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const map: Record<string, string> = {
    critical: 'bg-red-400/10 text-red-400 border-red-400/20',
    warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    info: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  }
  return (
    <Badge dot className={map[severity] ?? 'bg-slate-400/10 text-slate-400 border-slate-400/20'}>
      {severity}
    </Badge>
  )
}
