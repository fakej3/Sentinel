import { clsx } from 'clsx'
import { LayoutGrid, BarChart2, Activity, Star, ListFilter, type LucideIcon } from 'lucide-react'

interface MobileNavProps {
  hasData: boolean
  onOpenWatchlist: () => void
}

interface NavItem {
  label: string
  icon: LucideIcon
  href?: string
  action?: 'watchlist'
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', icon: LayoutGrid, href: '#top' },
  { label: 'Chart',    icon: BarChart2,  href: '#chart' },
  { label: 'Analysis', icon: Activity,   href: '#analysis' },
  { label: 'Watchlist',icon: Star,       action: 'watchlist' },
  { label: 'Detail',   icon: ListFilter, href: '#detail' },
]

export function MobileNav({ hasData, onOpenWatchlist }: MobileNavProps) {
  const handleClick = (item: NavItem) => {
    if (item.action === 'watchlist') {
      onOpenWatchlist()
      return
    }
    if (item.href) {
      const id = item.href.slice(1)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-surface-900 border-t border-border-subtle"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-full px-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isDisabled = !hasData && (item.href === '#analysis' || item.href === '#detail')
          return (
            <button
              key={item.label}
              onClick={() => !isDisabled && handleClick(item)}
              disabled={isDisabled}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-lg',
                'transition-colors duration-150 min-w-[52px]',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
                isDisabled
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-800 active:bg-surface-700',
              )}
              aria-label={item.label}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
