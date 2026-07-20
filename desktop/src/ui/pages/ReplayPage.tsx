import { useState, useRef, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import { Film, BarChart2, ListOrdered, TrendingUp, FlaskConical, Save, X, Loader2, type LucideIcon } from 'lucide-react'
import { fetchCandles } from '../../modules/binance/endpoints'
import type { Timeframe } from '../../modules/market/types'
import { TradingViewChart, type TradingViewChartHandle } from '../components/layout/TradingViewChart'
import { AnalysisInspector } from '../components/inspector/AnalysisInspector'
import { ReplayControls } from '../components/replay/ReplayControls'
import { ReplayTimeline } from '../components/replay/ReplayTimeline'
import { TradePanel } from '../components/replay/TradePanel'
import { StatsPanel } from '../components/replay/StatsPanel'
import { useReplay } from '../hooks/useReplay'
import { REPLAY_MIN_CANDLES } from '../../modules/replay/types'

const INTERVALS: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

type SidePanel = 'inspector' | 'timeline' | 'trades' | 'stats'

interface ReplayPageProps {
  initialSymbol?: string
  initialInterval?: Timeframe
}

export function ReplayPage({ initialSymbol = 'BTCUSDT', initialInterval = '1h' }: ReplayPageProps) {
  const [symbol,    setSymbol]    = useState(initialSymbol)
  const [interval,  setInterval]  = useState<Timeframe>(initialInterval)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchingCandles, setFetchingCandles] = useState(false)
  const [sidePanel, setSidePanel] = useState<SidePanel>('inspector')
  const [snapshotLabel, setSnapshotLabel] = useState('')
  const [showSnapshotInput, setShowSnapshotInput] = useState(false)

  const chartRef = useRef<TradingViewChartHandle>(null)
  const [replayState, replayActions] = useReplay()

  const { frame, trades, timeline, stats, isPlaying, speed, loading, snapshots, candles, totalCandles } = replayState

  const handleHighlight = useCallback((key: string | null) => {
    chartRef.current?.highlight(key)
  }, [])

  const handleLoad = useCallback(async () => {
    setFetchError(null)
    setFetchingCandles(true)
    try {
      const loaded = await fetchCandles(symbol.toUpperCase(), interval, 500)
      if (loaded.length < REPLAY_MIN_CANDLES) {
        setFetchError(`Need at least ${REPLAY_MIN_CANDLES} candles, got ${loaded.length}`)
        return
      }
      replayActions.load(loaded, symbol.toUpperCase(), interval)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch candles')
    } finally {
      setFetchingCandles(false)
    }
  }, [symbol, interval, replayActions])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inInput = ['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName ?? '')
      if (inInput || !frame) return
      switch (e.key) {
        case 'ArrowRight': case 'l': e.preventDefault(); replayActions.stepForward(); break
        case 'ArrowLeft':  case 'h': e.preventDefault(); replayActions.stepBack(); break
        case ' ': e.preventDefault(); isPlaying ? replayActions.pause() : replayActions.play(); break
        case 'r': e.preventDefault(); replayActions.restart(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frame, isPlaying, replayActions])

  const handleComputeStats = () => {
    replayActions.computeStats()
    setSidePanel('stats')
  }

  const handleSaveSnapshot = () => {
    if (!snapshotLabel.trim()) return
    replayActions.saveSnapshot(snapshotLabel.trim())
    setSnapshotLabel('')
    setShowSnapshotInput(false)
  }

  const isLoaded = frame !== null

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-950">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-surface-900 shrink-0">
        <Film size={14} className="text-blue-400 shrink-0" />
        <span className="text-xs font-medium text-slate-300">Replay & Validation Lab</span>
        <div className="flex-1" />

        {/* Symbol / Interval inputs */}
        <input
          type="text"
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleLoad()}
          className={clsx(
            'w-24 px-2 py-1 text-xs rounded bg-surface-800 border text-slate-200',
            'focus:outline-none focus:ring-1 focus:ring-blue-500',
            'border-border-subtle',
          )}
          placeholder="Symbol"
        />
        <select
          value={interval}
          onChange={e => setInterval(e.target.value as Timeframe)}
          className={clsx(
            'px-2 py-1 text-xs rounded bg-surface-800 border border-border-subtle text-slate-200',
            'focus:outline-none focus:ring-1 focus:ring-blue-500',
          )}
        >
          {INTERVALS.map(tf => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>

        <button
          onClick={handleLoad}
          disabled={fetchingCandles || loading}
          className={clsx(
            'px-3 py-1 text-xs rounded font-medium transition-colors',
            'bg-blue-600/20 text-blue-400 border border-blue-500/30',
            'hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {fetchingCandles ? (
            <span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" />Loading…</span>
          ) : 'Load'}
        </button>

        {isLoaded && (
          <>
            <button
              onClick={handleComputeStats}
              title="Compute validation statistics"
              className="px-2 py-1 text-xs rounded text-slate-400 hover:text-slate-200 hover:bg-surface-700 border border-border-subtle transition-colors flex items-center gap-1"
            >
              <FlaskConical size={11} />
              Stats
            </button>
            <button
              onClick={() => setShowSnapshotInput(s => !s)}
              title="Save snapshot for comparison"
              className="px-2 py-1 text-xs rounded text-slate-400 hover:text-slate-200 hover:bg-surface-700 border border-border-subtle transition-colors flex items-center gap-1"
            >
              <Save size={11} />
              Snapshot
            </button>
          </>
        )}
      </div>

      {/* Snapshot label input */}
      {showSnapshotInput && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-900 border-b border-border-subtle">
          <input
            autoFocus
            type="text"
            value={snapshotLabel}
            onChange={e => setSnapshotLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveSnapshot()
              if (e.key === 'Escape') setShowSnapshotInput(false)
            }}
            placeholder="Snapshot label…"
            className="flex-1 px-2 py-1 text-xs bg-surface-800 border border-border-subtle rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleSaveSnapshot} className="text-xs text-blue-400 hover:text-blue-300 px-2">Save</button>
          <button onClick={() => setShowSnapshotInput(false)} className="text-slate-500 hover:text-slate-300">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Error */}
      {fetchError && (
        <div className="px-3 py-1.5 bg-red-900/20 text-red-400 text-xs border-b border-red-900/30">
          {fetchError}
        </div>
      )}

      {/* Replay controls */}
      {isLoaded && frame && (
        <ReplayControls
          currentIndex={frame.index}
          minIndex={REPLAY_MIN_CANDLES - 1}
          maxIndex={totalCandles - 1}
          isPlaying={isPlaying}
          speed={speed}
          loading={loading}
          onPlay={replayActions.play}
          onPause={replayActions.pause}
          onStepBack={replayActions.stepBack}
          onStepForward={replayActions.stepForward}
          onJumpBack={() => replayActions.jumpBack(10)}
          onJumpForward={() => replayActions.jumpForward(10)}
          onRestart={replayActions.restart}
          onSeek={replayActions.jumpToIndex}
          onSpeedChange={replayActions.setSpeed}
        />
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chart */}
        <div className="flex-1 min-w-0 relative">
          {!isLoaded && !fetchingCandles && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Film size={32} className="text-slate-700" />
              <div className="text-sm text-slate-400">Load candles to begin replay</div>
              <div className="text-xs text-slate-600">Select a symbol and interval above</div>
              <button
                onClick={handleLoad}
                className="mt-2 px-4 py-1.5 text-sm rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
              >
                Load {symbol} {interval}
              </button>
            </div>
          )}
          {fetchingCandles && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={20} className="text-slate-500 animate-spin" />
            </div>
          )}
          <TradingViewChart
            ref={chartRef}
            symbol={symbol}
            interval={interval}
            data={frame?.result ?? null}
            candles={candles.length > 0 ? candles : undefined}
          />
        </div>

        {/* Side panel */}
        <div className="w-[280px] flex-shrink-0 border-l border-border-subtle flex flex-col overflow-hidden">
          {/* Panel tabs */}
          <div className="flex border-b border-border-subtle">
            <PanelTab icon={BarChart2}    label="Inspector" active={sidePanel === 'inspector'} onClick={() => setSidePanel('inspector')} />
            <PanelTab icon={ListOrdered}  label="Timeline"  active={sidePanel === 'timeline'}  onClick={() => setSidePanel('timeline')} count={timeline.length} />
            <PanelTab icon={TrendingUp}   label="Trades"    active={sidePanel === 'trades'}    onClick={() => setSidePanel('trades')} count={trades.length} />
            <PanelTab icon={FlaskConical} label="Stats"     active={sidePanel === 'stats'}     onClick={() => setSidePanel('stats')} />
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {sidePanel === 'inspector' && frame && (
              <AnalysisInspector
                data={frame.result}
                onHighlight={handleHighlight}
                onClose={() => {}}
              />
            )}
            {sidePanel === 'inspector' && !frame && (
              <EmptyPanel message="Load candles to see analysis" />
            )}
            {sidePanel === 'timeline' && (
              <ReplayTimeline
                entries={timeline}
                currentIndex={frame?.index ?? -1}
                onJump={replayActions.jumpToIndex}
              />
            )}
            {sidePanel === 'trades' && (
              <TradePanel trades={trades} />
            )}
            {sidePanel === 'stats' && stats && (
              <StatsPanel stats={stats} />
            )}
            {sidePanel === 'stats' && !stats && (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
                <FlaskConical size={24} className="text-slate-700" />
                <p className="text-xs text-slate-500 text-center">
                  Run the replay to completion, then compute statistics.
                </p>
                <button
                  onClick={handleComputeStats}
                  disabled={!isLoaded}
                  className="px-3 py-1.5 text-xs rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Compute Stats
                </button>
              </div>
            )}
          </div>

          {/* Saved snapshots */}
          {snapshots.length > 0 && (
            <div className="border-t border-border-subtle">
              <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-600">Snapshots</span>
                <button
                  onClick={replayActions.clearSnapshots}
                  className="text-[10px] text-slate-600 hover:text-slate-400"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-[80px] overflow-y-auto">
                {snapshots.map(snap => (
                  <div key={snap.id} className="flex items-center gap-2 px-3 py-1 hover:bg-surface-800">
                    <span className="text-[10px] text-slate-400 flex-1 truncate">{snap.label}</span>
                    <span className="text-[10px] text-slate-600">{snap.symbol}</span>
                    <button
                      onClick={() => replayActions.deleteSnapshot(snap.id)}
                      className="text-slate-600 hover:text-slate-400"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PanelTab({
  icon: Icon, label, active, onClick, count,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'flex-1 flex flex-col items-center py-1.5 gap-0.5 text-[9px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-blue-500',
        active
          ? 'text-blue-400 border-b-2 border-blue-500'
          : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent',
      )}
    >
      <Icon size={13} className="shrink-0" />
      <span className="leading-none">{label}{count !== undefined && count > 0 ? ` (${count})` : ''}</span>
    </button>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-xs text-slate-600">
      {message}
    </div>
  )
}
