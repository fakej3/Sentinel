import { clsx } from 'clsx'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  colorClass?: string
  height?: string
  animated?: boolean
  label?: string
  showValue?: boolean
}

export function ProgressBar({
  value,
  max = 100,
  className,
  colorClass,
  height = 'h-1.5',
  animated = true,
  label,
  showValue,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = colorClass ?? (pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-blue-400' : 'bg-red-400')

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-slate-400">{label}</span>}
          {showValue && <span className="text-xs font-mono text-slate-300">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className={clsx('w-full bg-surface-600 rounded-full overflow-hidden', height)}>
        <div
          className={clsx('h-full rounded-full', color, animated && 'transition-all duration-700 ease-out')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface DualBarProps {
  buyPct: number
  sellPct: number
  label?: string
}

export function DualBar({ buyPct, sellPct, label }: DualBarProps) {
  const total = buyPct + sellPct
  const buyFrac = total > 0 ? (buyPct / total) * 100 : 50
  const sellFrac = 100 - buyFrac

  return (
    <div className="space-y-1">
      {label && <p className="section-label">{label}</p>}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-surface-600">
        <div
          className="bg-emerald-400/80 h-full transition-all duration-700"
          style={{ width: `${buyFrac}%` }}
        />
        <div
          className="bg-red-400/80 h-full flex-1 transition-all duration-700"
          style={{ width: `${sellFrac}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-emerald-400">Buy {buyFrac.toFixed(0)}%</span>
        <span className="text-red-400">Sell {sellFrac.toFixed(0)}%</span>
      </div>
    </div>
  )
}
