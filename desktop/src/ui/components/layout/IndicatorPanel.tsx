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

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 flex-wrap justify-end pointer-events-auto max-w-[220px]">
      {INDICATORS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => toggle(id)}
          className={`px-1.5 py-0.5 text-[10px] font-mono rounded border leading-none transition-colors ${
            visibility[id]
              ? 'bg-slate-700/60 border-slate-600/80 text-slate-300 hover:bg-slate-600/60'
              : 'bg-transparent border-slate-700/30 text-slate-600 hover:border-slate-600/50 hover:text-slate-500'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
