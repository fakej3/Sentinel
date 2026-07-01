import { clsx } from 'clsx'
import type { AppTab } from '../../types'

export interface TabDef {
  id: AppTab
  label: string
  count?: number
}

interface TabsProps {
  tabs: TabDef[]
  active: AppTab
  onChange: (tab: AppTab) => void
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-0.5 px-4 border-b border-border-subtle bg-surface-900 flex-shrink-0">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'relative px-3.5 py-2.5 text-xs font-medium transition-all duration-150 rounded-t-md',
            'outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
            active === tab.id
              ? 'text-slate-100'
              : 'text-slate-500 hover:text-slate-300',
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={clsx(
                'ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
                'text-[10px] font-semibold rounded-full',
                active === tab.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-surface-600 text-slate-500',
              )}
            >
              {tab.count}
            </span>
          )}
          {active === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
          )}
        </button>
      ))}
    </div>
  )
}

interface TabPanelProps {
  children: React.ReactNode
  className?: string
}

export function TabPanel({ children, className }: TabPanelProps) {
  return (
    <div className={clsx('flex-1 overflow-y-auto animate-fade-in', className)}>
      {children}
    </div>
  )
}
