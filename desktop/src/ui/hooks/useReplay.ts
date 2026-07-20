import { useState, useRef, useCallback, useEffect } from 'react'
import { ReplayEngine } from '../../modules/replay/engine'
import { TradeTracker } from '../../modules/replay/trade-tracker'
import { computeReplayStats } from '../../modules/replay/statistics'
import { SnapshotManager } from '../../modules/replay/snapshot'
import type {
  ReplayFrame, PlaybackSpeed, TrackedTrade, TimelineEntry, ReplayStats, ReplaySnapshot,
} from '../../modules/replay/types'
import type { Candle, Timeframe } from '../../modules/market/types'

export interface ReplayState {
  frame: ReplayFrame | null
  trades: TrackedTrade[]
  timeline: TimelineEntry[]
  stats: ReplayStats | null
  isPlaying: boolean
  speed: PlaybackSpeed
  loading: boolean
  snapshots: ReplaySnapshot[]
  candles: Candle[]
  totalCandles: number
}

export interface ReplayActions {
  load(candles: Candle[], symbol: string, interval: Timeframe): void
  play(): void
  pause(): void
  stepForward(): Promise<void>
  stepBack(): Promise<void>
  jumpForward(n?: number): Promise<void>
  jumpBack(n?: number): Promise<void>
  jumpToIndex(i: number): Promise<void>
  jumpToTimestamp(ts: number): Promise<void>
  restart(): Promise<void>
  setSpeed(s: PlaybackSpeed): void
  computeStats(): ReplayStats
  saveSnapshot(label: string): ReplaySnapshot | null
  deleteSnapshot(id: string): void
  clearSnapshots(): void
}

const SPEED_MS: Record<PlaybackSpeed, number> = {
  0.5: 2000,
  1:   1000,
  2:    500,
  5:    200,
  10:   100,
  20:    50,
}

function signalFromResult(result: ReplayFrame['result']): TimelineEntry['signal'] {
  if (!result.tradePlan.actionable) return 'wait'
  if (result.tradePlan.invalidationLevel === null || !result.tradePlan.entryZone) return 'wait'
  return result.tradePlan.invalidationLevel < result.tradePlan.entryZone.lower ? 'buy' : 'sell'
}

export function useReplay(): [ReplayState, ReplayActions] {
  const engineRef     = useRef<ReplayEngine | null>(null)
  const trackerRef    = useRef<TradeTracker>(new TradeTracker())
  const snapshotMgr   = useRef<SnapshotManager>(new SnapshotManager())
  const symbolRef     = useRef('')
  const intervalRef   = useRef<Timeframe>('1h')
  const playTimer     = useRef<ReturnType<typeof setInterval> | null>(null)

  const [frame,        setFrame]        = useState<ReplayFrame | null>(null)
  const [trades,       setTrades]       = useState<TrackedTrade[]>([])
  const [timeline,     setTimeline]     = useState<TimelineEntry[]>([])
  const [stats,        setStats]        = useState<ReplayStats | null>(null)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [speed,        setSpeedState]   = useState<PlaybackSpeed>(1)
  const [loading,      setLoading]      = useState(false)
  const [snapshots,    setSnapshots]    = useState<ReplaySnapshot[]>(() => snapshotMgr.current.list())
  const [candles,      setCandles]      = useState<Candle[]>([])
  const [totalCandles, setTotalCandles] = useState(0)

  const stopTimer = useCallback(() => {
    if (playTimer.current) {
      clearInterval(playTimer.current)
      playTimer.current = null
    }
  }, [])

  const applyFrame = useCallback((f: ReplayFrame) => {
    const tracker = trackerRef.current
    const latestCandle = f.candles[f.candles.length - 1]
    const { newTrade, trades: updatedTrades } = tracker.processFrame(f.index, f.result, latestCandle)

    setFrame(f)
    setCandles(f.candles)
    setTrades([...updatedTrades])

    setTimeline(prev => [...prev, {
      index:            f.index,
      candleTimestamp:  f.candleTimestamp,
      signal:           signalFromResult(f.result),
      confidence:       f.result.confidence.score,
      setupQuality:     f.result.tradePlan.setupQuality,
      newTrade:         newTrade !== null,
      tradeId:          newTrade?.id ?? null,
    }])
  }, [])

  // jumpToIndex must be declared before stepBack / jumpBack which depend on it
  const jumpToIndex = useCallback(async (idx: number) => {
    const engine = engineRef.current
    if (!engine) return
    stopTimer()
    setIsPlaying(false)
    setLoading(true)
    trackerRef.current.reset()
    setTimeline([])
    setTrades([])

    const target = Math.max(engine.minIndex, Math.min(idx, engine.maxIndex))
    for (let i = engine.minIndex; i <= target; i++) {
      await engine.jumpToIndex(i)
      const f = await engine.currentFrame()
      applyFrame(f)
    }
    setLoading(false)
  }, [stopTimer, applyFrame])

  const stepForward = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    const f = await engine.stepForward()
    if (f) applyFrame(f)
    else { stopTimer(); setIsPlaying(false) }
  }, [applyFrame, stopTimer])

  const stepBack = useCallback(async () => {
    const engine = engineRef.current
    if (!engine || engine.currentIndex <= engine.minIndex) return
    await jumpToIndex(engine.currentIndex - 1)
  }, [jumpToIndex])

  const jumpForward = useCallback(async (n = 10) => {
    const engine = engineRef.current
    if (!engine) return
    stopTimer()
    setIsPlaying(false)
    setLoading(true)
    const target = Math.min(engine.currentIndex + n, engine.maxIndex)
    for (let i = engine.currentIndex + 1; i <= target; i++) {
      await engine.jumpToIndex(i)
      const f = await engine.currentFrame()
      applyFrame(f)
    }
    setLoading(false)
  }, [stopTimer, applyFrame])

  const jumpBack = useCallback(async (n = 10) => {
    const engine = engineRef.current
    if (!engine) return
    await jumpToIndex(Math.max(engine.currentIndex - n, engine.minIndex))
  }, [jumpToIndex])

  const jumpToTimestamp = useCallback(async (ts: number) => {
    const engine = engineRef.current
    if (!engine) return
    const f = await engine.jumpToTimestamp(ts)
    await jumpToIndex(f.index)
  }, [jumpToIndex])

  const restart = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    stopTimer()
    setIsPlaying(false)
    trackerRef.current.reset()
    setTimeline([])
    setTrades([])
    setLoading(true)
    const f = await engine.restart()
    applyFrame(f)
    setLoading(false)
  }, [stopTimer, applyFrame])

  const load = useCallback((newCandles: Candle[], symbol: string, interval: Timeframe) => {
    stopTimer()
    setIsPlaying(false)
    setLoading(true)
    trackerRef.current.reset()
    symbolRef.current   = symbol
    intervalRef.current = interval
    setTimeline([])
    setStats(null)
    setTrades([])

    try {
      const engine = new ReplayEngine({ candles: newCandles, symbol, interval })
      engineRef.current = engine
      setTotalCandles(engine.totalCandles)
      engine.currentFrame().then(f => {
        applyFrame(f)
        setLoading(false)
      }).catch(() => setLoading(false))
    } catch {
      setLoading(false)
    }
  }, [stopTimer, applyFrame])

  const play = useCallback(() => {
    const engine = engineRef.current
    if (!engine || engine.isAtEnd) return
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => {
    stopTimer()
    setIsPlaying(false)
  }, [stopTimer])

  const setSpeed = useCallback((s: PlaybackSpeed) => setSpeedState(s), [])

  const computeStatsAction = useCallback((): ReplayStats => {
    const result = computeReplayStats(trackerRef.current.getTrades())
    setStats(result)
    return result
  }, [])

  const saveSnapshot = useCallback((label: string): ReplaySnapshot | null => {
    if (!frame) return null
    const currentTrades = trackerRef.current.getTrades()
    const currentStats  = computeReplayStats(currentTrades)
    const snap = snapshotMgr.current.save(
      label, symbolRef.current, intervalRef.current,
      timeline, currentTrades, currentStats,
    )
    setSnapshots(snapshotMgr.current.list())
    return snap
  }, [frame, timeline])

  const deleteSnapshot = useCallback((id: string) => {
    snapshotMgr.current.delete(id)
    setSnapshots(snapshotMgr.current.list())
  }, [])

  const clearSnapshots = useCallback(() => {
    snapshotMgr.current.clear()
    setSnapshots([])
  }, [])

  // Auto-play loop — recreated on speed or isPlaying change
  useEffect(() => {
    if (!isPlaying) { stopTimer(); return }
    const engine = engineRef.current
    if (!engine) return

    playTimer.current = setInterval(() => {
      if (!engineRef.current || engineRef.current.isAtEnd) {
        stopTimer()
        setIsPlaying(false)
        return
      }
      engineRef.current.stepForward().then(f => {
        if (f) applyFrame(f)
        else { stopTimer(); setIsPlaying(false) }
      })
    }, SPEED_MS[speed])

    return stopTimer
  }, [isPlaying, speed, applyFrame, stopTimer])

  const state: ReplayState = {
    frame, trades, timeline, stats, isPlaying, speed, loading, snapshots, candles, totalCandles,
  }

  const actions: ReplayActions = {
    load, play, pause, stepForward, stepBack,
    jumpForward, jumpBack, jumpToIndex, jumpToTimestamp, restart,
    setSpeed, computeStats: computeStatsAction, saveSnapshot, deleteSnapshot, clearSnapshots,
  }

  return [state, actions]
}
