import { memo, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { TimelineEntry } from '../../../modules/replay/types'

interface ReplayTimelineProps {
  entries: TimelineEntry[]
  currentIndex: number
  onJump: (index: number) => void
}

export const ReplayTimeline = memo(function ReplayTimeline({
  entries, currentIndex, onJump,
}: ReplayTimelineProps) {
  const listRef    = useRef<HTMLDivElement>(null)
  const activeRef  = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIndex])

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-slate-600 text-xs">
        No signals yet
      </div>
    )
  }

  return (
    <div ref={listRef} className="overflow-y-auto max-h-[260px]">
      {entries.map(entry => {
        const isActive = entry.index === currentIndex
        return (
          <button
            key={entry.index}
            ref={isActive ? activeRef : undefined}
            onClick={() => onJump(entry.index)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100',
              'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-blue-500',
              isActive
                ? 'bg-blue-600/15 border-l-2 border-blue-500'
                : 'border-l-2 border-transparent hover:bg-surface-800',
            )}
          >
            <SignalIcon signal={entry.signal} />
            <span className="text-[10px] tabular-nums text-slate-500 w-10 shrink-0">
              #{entry.index}
            </span>
            <span className={clsx(
              'text-[10px] font-medium w-8 shrink-0',
              entry.signal === 'buy'  ? 'text-emerald-400' :
              entry.signal === 'sell' ? 'text-red-400' :
              'text-slate-500'
            )}>
              {entry.signal.toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 tabular-nums">
              {entry.confidence.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-600 shrink-0">
              {entry.setupQuality}
            </span>
            {entry.newTrade && (
              <span className="ml-auto text-[9px] bg-blue-600/20 text-blue-400 px-1 rounded">
                NEW
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
})

function SignalIcon({ signal }: { signal: TimelineEntry['signal'] }) {
  if (signal === 'buy')  return <TrendingUp  size={11} className="text-emerald-400 shrink-0" />
  if (signal === 'sell') return <TrendingDown size={11} className="text-red-400    shrink-0" />
  return <Minus size={11} className="text-slate-600 shrink-0" />
}
