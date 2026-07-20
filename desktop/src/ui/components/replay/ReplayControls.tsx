import { memo } from 'react'
import { clsx } from 'clsx'
import { SkipBack, ChevronLeft, Play, Pause, ChevronRight, SkipForward, RotateCcw } from 'lucide-react'
import type { PlaybackSpeed } from '../../../modules/replay/types'

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 5, 10, 20]

interface ReplayControlsProps {
  currentIndex: number
  minIndex: number
  maxIndex: number
  isPlaying: boolean
  speed: PlaybackSpeed
  loading: boolean
  onPlay: () => void
  onPause: () => void
  onStepBack: () => void
  onStepForward: () => void
  onJumpBack: () => void
  onJumpForward: () => void
  onRestart: () => void
  onSeek: (index: number) => void
  onSpeedChange: (speed: PlaybackSpeed) => void
}

export const ReplayControls = memo(function ReplayControls({
  currentIndex, minIndex, maxIndex,
  isPlaying, speed, loading,
  onPlay, onPause, onStepBack, onStepForward,
  onJumpBack, onJumpForward, onRestart,
  onSeek, onSpeedChange,
}: ReplayControlsProps) {
  const atStart = currentIndex <= minIndex
  const atEnd   = currentIndex >= maxIndex
  const progress = maxIndex > minIndex ? (currentIndex - minIndex) / (maxIndex - minIndex) : 0

  return (
    <div className="flex flex-col gap-2 px-3 py-2 bg-surface-900 border-b border-border-subtle">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right">{currentIndex}</span>
        <div className="flex-1 relative h-1.5 bg-surface-700 rounded-full cursor-pointer group"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            onSeek(Math.round(minIndex + ratio * (maxIndex - minIndex)))
          }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-500 tabular-nums w-8">{maxIndex}</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Playback buttons */}
        <div className="flex items-center gap-1">
          <CtrlBtn onClick={onRestart} title="Restart" disabled={loading || atStart}>
            <RotateCcw size={12} />
          </CtrlBtn>
          <CtrlBtn onClick={onJumpBack} title="Jump back 10" disabled={loading || atStart}>
            <SkipBack size={14} />
          </CtrlBtn>
          <CtrlBtn onClick={onStepBack} title="Previous candle" disabled={loading || atStart}>
            <ChevronLeft size={14} />
          </CtrlBtn>
          <CtrlBtn
            onClick={isPlaying ? onPause : onPlay}
            title={isPlaying ? 'Pause' : 'Play'}
            disabled={loading || atEnd}
            primary
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </CtrlBtn>
          <CtrlBtn onClick={onStepForward} title="Next candle" disabled={loading || atEnd}>
            <ChevronRight size={14} />
          </CtrlBtn>
          <CtrlBtn onClick={onJumpForward} title="Jump forward 10" disabled={loading || atEnd}>
            <SkipForward size={14} />
          </CtrlBtn>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">Speed</span>
          <div className="flex gap-0.5">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                  s === speed
                    ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-surface-700',
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Loading indicator */}
        {loading && (
          <span className="text-[10px] text-slate-500 animate-pulse">computing…</span>
        )}
      </div>
    </div>
  )
})

interface CtrlBtnProps {
  onClick: () => void
  title: string
  disabled?: boolean
  primary?: boolean
  children: React.ReactNode
}

function CtrlBtn({ onClick, title, disabled, primary, children }: CtrlBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={clsx(
        'p-1.5 rounded transition-all duration-100',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
        disabled
          ? 'opacity-30 cursor-not-allowed text-slate-600'
          : primary
          ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700',
      )}
    >
      {children}
    </button>
  )
}
