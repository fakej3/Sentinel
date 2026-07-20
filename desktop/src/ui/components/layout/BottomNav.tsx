import { memo } from 'react'
import { clsx } from 'clsx'
import { LayoutGrid, BarChart2, Activity, Star, Film, Settings, type LucideIcon } from 'lucide-react'
import type { AppPage } from '../../types'

interface NavItem {
  page: AppPage
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard', label: 'Home',      icon: LayoutGrid },
  { page: 'chart',     label: 'Chart',     icon: BarChart2 },
  { page: 'analysis',  label: 'Analysis',  icon: Activity },
  { page: 'replay',    label: 'Replay',    icon: Film },
  { page: 'watchlist', label: 'Watchlist', icon: Star },
  { page: 'settings',  label: 'Settings',  icon: Settings },
]

interface BottomNavProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  hasData: boolean
}

export const BottomNav = memo(function BottomNav({ activePage, onNavigate, hasData }: BottomNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-surface-900 border-t border-border-subtle"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-full px-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = activePage === item.page
          const isDisabled = !hasData && item.page === 'analysis'
          return (
            <button
              key={item.page}
              onClick={() => !isDisabled && onNavigate(item.page)}
              disabled={isDisabled}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-lg',
                'transition-colors duration-150 min-w-[52px]',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
                isDisabled
                  ? 'opacity-30 cursor-not-allowed'
                  : isActive
                  ? 'text-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-800 active:bg-surface-700',
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
})
