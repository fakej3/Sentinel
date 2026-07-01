import { scoreStroke, scoreColor } from '../../utils/colors'
import { formatScore, formatGrade } from '../../utils/format'
import type { ConfidenceGrade } from '../../types'

interface ConfidenceMeterProps {
  score: number
  grade: ConfidenceGrade
  size?: number
}

export function ConfidenceMeter({ score, grade, size = 120 }: ConfidenceMeterProps) {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  // Arc spans 270° (from 135° to 405° = -225° offset); 0–10 fills the arc
  const arcFraction = Math.min(1, Math.max(0, score / 10))
  const dashLength = arcFraction * circumference * 0.75 // 270°/360° = 0.75
  const gap = circumference - dashLength
  const stroke = scoreStroke(score)
  const center = size / 2

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-[135deg]"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1e2740"
            strokeWidth={8}
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Fill */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={8}
            strokeDasharray={`${dashLength} ${gap + circumference * 0.25}`}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${stroke}60)`,
              transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`text-2xl font-bold font-mono tabular-nums leading-none ${scoreColor(score)}`}
          >
            {formatScore(score)}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">/ 10</span>
        </div>
      </div>

      <div className="text-center">
        <p className={`text-sm font-semibold ${scoreColor(score)}`}>
          {formatGrade(grade)}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">Confidence</p>
      </div>
    </div>
  )
}

interface MiniMeterProps {
  label: string
  score: number
  max?: number
  colorClass?: string
}

export function MiniMeter({ label, score, max = 10, colorClass }: MiniMeterProps) {
  const pct = Math.max(0, Math.min(1, score / max)) * 100
  const color = colorClass ?? (score >= 7 ? 'bg-emerald-400' : score >= 4 ? 'bg-blue-400' : 'bg-red-400')

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-mono text-slate-300">{score.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-surface-600 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
