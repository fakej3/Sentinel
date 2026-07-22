import { useState } from 'react'

export const INDICATORS = [
  { id: 'ema-20',           label: 'E20',   group: 'overlay'  },
  { id: 'ema-50',           label: 'E50',   group: 'overlay'  },
  { id: 'ema-100',          label: 'E100',  group: 'overlay'  },
  { id: 'ema-200',          label: 'E200',  group: 'overlay'  },
  { id: 'volume',           label: 'Vol',   group: 'overlay'  },
  { id: 'sr',               label: 'S/R',   group: 'analysis' },
  { id: 'market-structure', label: 'MS',    group: 'analysis' },
  { id: 'fibonacci',        label: 'Fib',   group: 'analysis' },
  { id: 'entry-zone',       label: 'Entry', group: 'analysis' },
  { id: 'stop-loss',        label: 'SL',    group: 'analysis' },
  { id: 'take-profit',      label: 'TP',    group: 'analysis' },
  { id: 'risk-reward',      label: 'RR',    group: 'analysis' },
] as const

export type IndicatorId    = typeof INDICATORS[number]['id']
export type IndicatorGroup = typeof INDICATORS[number]['group']

const ROW1 = INDICATORS.slice(0, 6)
const ROW2 = INDICATORS.slice(6)

const STORAGE_KEY = 'sentinel:indicator-visibility'

type VisibilityMap = Record<IndicatorId, boolean>

export function loadIndicatorVisibility(): VisibilityMap {
  const defaults = Object.fromEntries(
    INDICATORS.map(({ id }) => [id, true])
  ) as VisibilityMap
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>
    for (const { id } of INDICATORS) {
      if (parsed[id] === false) defaults[id] = false
    }
  } catch {}
  return defaults
}

interface IndicatorPanelProps {
  onToggle(id: IndicatorId, visible: boolean): void
}

export function IndicatorPanel({ onToggle }: IndicatorPanelProps) {
  const [visibility, setVisibility] = useState<VisibilityMap>(loadIndicatorVisibility)

  const toggle = (id: IndicatorId) => {
    const next = !visibility[id]
    const updated = { ...visibility, [id]: next }
    setVisibility(updated)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
    onToggle(id, next)
  }

  const chipClass = (id: IndicatorId) =>
    visibility[id]
      ? 'h-5 px-1.5 text-[10px] font-medium rounded border leading-none transition-colors bg-slate-700/70 border-slate-500/60 text-slate-200 hover:bg-slate-600/70 hover:border-slate-400/60'
      : 'h-5 px-1.5 text-[10px] font-medium rounded border leading-none transition-colors bg-slate-900/40 border-slate-700/30 text-slate-600 hover:border-slate-600/50 hover:text-slate-500'

  return (
    <div className="absolute bottom-8 left-2 z-10 flex flex-col gap-0.5 pointer-events-auto">
      <div className="flex items-center gap-1">
        {ROW1.map(({ id, label }) => (
          <button key={id} onClick={() => toggle(id)} className={chipClass(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {ROW2.map(({ id, label }) => (
          <button key={id} onClick={() => toggle(id)} className={chipClass(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
