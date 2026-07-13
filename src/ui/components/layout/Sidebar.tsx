import { clsx } from 'clsx'
import { LayoutGrid, BarChart2, Activity, Star, Clock, Settings, type LucideIcon } from 'lucide-react'
import type { AppPage } from '../../types'

interface NavItem {
  page: AppPage
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { page: 'chart',     label: 'Chart',     icon: BarChart2 },
  { page: 'analysis',  label: 'Analysis',  icon: Activity },
  { page: 'watchlist', label: 'Watchlist', icon: Star },
  { page: 'history',   label: 'History',   icon: Clock },
  { page: 'settings',  label: 'Settings',  icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  activePage: AppPage
  onNavigate: (page: AppPage) => void
}

export function Sidebar({ collapsed, activePage, onNavigate }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col flex-shrink-0',
        'border-r border-border-subtle bg-surface-900 overflow-hidden',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-14' : 'w-[220px]',
      )}
      aria-label="Primary navigation"
    >
      <nav className="flex-1 py-2 px-2 space-y-0.5" aria-label="Pages">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = activePage === item.page
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={clsx(
                'w-full flex items-center rounded-lg transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
                collapsed ? 'justify-center h-10 px-2' : 'gap-3 px-2.5 py-2',
                isActive
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-700',
              )}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-xs font-medium truncate">{item.label}</span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
