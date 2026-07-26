import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { DrawingEngine } from '../../chart/drawing/DrawingEngine'
import type { CrosshairEvent } from '../../chart/drawing/types'
import { fetchCandlesAuto } from '../../../modules/binance/endpoints'
import { subscribeLiveCandles } from '../../../modules/binance/ws'
import type { Candle, Timeframe } from '../../../modules/market/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import { OverlayManager } from '../../chart/OverlayManager'
import { CandlestickOverlay } from '../../chart/overlays/CandlestickOverlay'
import { VolumeOverlay } from '../../chart/overlays/VolumeOverlay'
import { EmaOverlay } from '../../chart/overlays/EmaOverlay'
import { SupportResistanceOverlay } from '../../chart/overlays/SupportResistanceOverlay'
import { EntryZoneOverlay } from '../../chart/overlays/EntryZoneOverlay'
import { StopLossOverlay } from '../../chart/overlays/StopLossOverlay'
import { TakeProfitOverlay } from '../../chart/overlays/TakeProfitOverlay'
import { RiskRewardOverlay } from '../../chart/overlays/RiskRewardOverlay'
import { FibonacciOverlay } from '../../chart/overlays/FibonacciOverlay'
import { MarketStructureOverlay } from '../../chart/overlays/MarketStructureOverlay'
import { formatPrice, formatPercent, formatVolume, formatTimestamp } from '../../utils/format'
import { IndicatorPanel, INDICATORS, loadIndicatorVisibility, type IndicatorId } from './IndicatorPanel'

export interface TradingViewChartHandle {
  highlight(key: string | null): void
  loadCandles(candles: Candle[]): void
}

interface TradingViewChartProps {
  symbol: string
  interval: string
  data: PipelineResult | null
  /** When provided, the chart renders these candles instead of fetching from Binance */
  candles?: Candle[]
}

// EMA config in declaration order — used both for overlay creation and HUD coloring
// Color language: blue=EMA20/entry, orange=EMA50, teal=EMA100, white=EMA200 (long-term context)
// Gold is reserved exclusively for Fibonacci; purple for CHoCH structure.
const EMA_CONFIGS = [
  { period: 20,  color: 'rgba(59, 130, 246, 0.75)',  hudColor: '#60a5fa' },
  { period: 50,  color: 'rgba(249, 115, 22, 0.85)',  hudColor: '#fb923c' },
  { period: 100, color: 'rgba(16, 185, 129, 0.80)',  hudColor: '#34d399' },
  { period: 200, color: 'rgba(226, 232, 240, 0.80)', hudColor: '#e2e8f0' },
] as const

export const TradingViewChart = forwardRef<TradingViewChartHandle, TradingViewChartProps>(
function TradingViewChart({ symbol, interval, data, candles: controlledCandles }, ref) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const engineRef     = useRef<DrawingEngine | null>(null)
  const managerRef    = useRef<OverlayManager | null>(null)
  const candlesRef    = useRef<Candle[]>([])
  const candleMapRef  = useRef<Map<number, Candle>>(new Map())
  const marketTypeRef = useRef<'spot' | 'futures'>('spot')

  // References to EMA overlays for crosshair value lookup
  const emaOverlaysRef = useRef<EmaOverlay[]>([])

  // HUD element refs — updated via direct DOM writes on every crosshair move (no re-render)
  const hudRef        = useRef<HTMLDivElement>(null)
  const hudTimeRef    = useRef<HTMLSpanElement>(null)
  const hudOpenRef    = useRef<HTMLSpanElement>(null)
  const hudHighRef    = useRef<HTMLSpanElement>(null)
  const hudLowRef     = useRef<HTMLSpanElement>(null)
  const hudCloseRef   = useRef<HTMLSpanElement>(null)
  const hudChangeRef  = useRef<HTMLSpanElement>(null)
  const hudVolRef     = useRef<HTMLSpanElement>(null)
  // EMA value spans (indexed 0-3 = E20, E50, E100, E200)
  const hudEmaRefs    = useRef<(HTMLSpanElement | null)[]>([null, null, null, null])

  const [status,   setStatus]   = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useImperativeHandle(ref, () => ({
    highlight(key: string | null) { managerRef.current?.highlight(key) },
    loadCandles(candles: Candle[]) {
      candlesRef.current = candles
      candleMapRef.current = new Map(candles.map(c => [c.openTime, c]))
      managerRef.current?.updateAll(candles)
      engineRef.current?.fitContent()
    },
  }), [])

  // Create drawing engine, overlay manager, and crosshair HUD — runs once.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const engine  = new DrawingEngine(el)
    const manager = new OverlayManager(engine)

    manager.add(new CandlestickOverlay())
    manager.add(new VolumeOverlay())

    const emaOverlays = EMA_CONFIGS.map(cfg => {
      const ema = new EmaOverlay({ period: cfg.period, color: cfg.color })
      manager.add(ema)
      return ema
    })
    emaOverlaysRef.current = emaOverlays

    manager.addAnalysis(new SupportResistanceOverlay())
    manager.addAnalysis(new EntryZoneOverlay())
    manager.addAnalysis(new StopLossOverlay())
    manager.addAnalysis(new TakeProfitOverlay())
    manager.addAnalysis(new RiskRewardOverlay())
    manager.addAnalysis(new FibonacciOverlay())
    manager.addAnalysis(new MarketStructureOverlay())

    engineRef.current  = engine
    managerRef.current = manager

    // Apply stored visibility (persisted from previous session)
    const stored = loadIndicatorVisibility()
    for (const ind of INDICATORS) {
      if (!stored[ind.id]) {
        if (ind.group === 'overlay') manager.setVisible(ind.id, false)
        else manager.setVisibleAnalysis(ind.id, false)
      }
    }

    // Crosshair HUD — update DOM directly on every move, no React re-render
    const onCrosshair = (event: CrosshairEvent) => {
      const hud = hudRef.current
      if (!hud) return

      if (event.time === null || event.point === null) {
        hud.style.display = 'none'
        return
      }

      const timeMs = event.time * 1000
      const candle = candleMapRef.current.get(timeMs)
      if (!candle) { hud.style.display = 'none'; return }

      hud.style.display = 'flex'

      const timeEl   = hudTimeRef.current
      const openEl   = hudOpenRef.current
      const highEl   = hudHighRef.current
      const lowEl    = hudLowRef.current
      const closeEl  = hudCloseRef.current
      const changeEl = hudChangeRef.current
      const volEl    = hudVolRef.current

      if (timeEl)   timeEl.textContent  = formatTimestamp(timeMs)
      if (openEl)   openEl.textContent  = formatPrice(candle.open)
      if (highEl)   highEl.textContent  = formatPrice(candle.high)
      if (lowEl)    lowEl.textContent   = formatPrice(candle.low)
      if (closeEl)  closeEl.textContent = formatPrice(candle.close)

      if (changeEl) {
        const chg = candle.open !== 0 ? ((candle.close - candle.open) / candle.open) * 100 : 0
        changeEl.textContent  = formatPercent(chg)
        changeEl.style.color  = chg >= 0 ? '#34d399' : '#f87171'
      }

      if (volEl) volEl.textContent = formatVolume(candle.volume)

      // EMA values at this candle
      const utcSec = event.time
      emaOverlaysRef.current.forEach((ema, i) => {
        const el = hudEmaRefs.current[i]
        if (!el) return
        const v = ema.getValueAt(utcSec)
        el.textContent = v !== undefined ? formatPrice(v) : ''
      })
    }

    const unsubCrosshair = engine.subscribeCrosshairMove(onCrosshair)

    return () => {
      unsubCrosshair()
      manager.dispose()
      engine.dispose()
      engineRef.current      = null
      managerRef.current     = null
      emaOverlaysRef.current = []
    }
  }, [])

  // Symbol watermark — centered ghost text, updated whenever the symbol changes.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.render('__symbol__', [{
      kind:      'watermark',
      key:       'sym',
      horzAlign: 'center',
      vertAlign: 'center',
      lines:     [{ text: symbol.toUpperCase(), color: 'rgba(148,163,184,0.04)', fontSize: 48, fontStyle: 'bold' }],
    }])
  }, [symbol])

  // Fetch historical candles then subscribe to live WS ticks (live mode only).
  useEffect(() => {
    if (controlledCandles !== undefined) return
    let cancelled = false
    let unsubWs: (() => void) | null = null
    setStatus('loading')
    setErrorMsg('')

    fetchCandlesAuto(symbol, interval as Timeframe)
      .then(({ candles: initial, market }) => {
        if (cancelled) return
        const manager = managerRef.current
        if (!manager) return

        marketTypeRef.current = market
        candlesRef.current   = initial
        candleMapRef.current = new Map(initial.map(c => [c.openTime, c]))
        manager.updateAll(initial)
        engineRef.current?.fitContent()
        setStatus('ready')

        unsubWs = subscribeLiveCandles(symbol, interval as Timeframe, live => {
          if (cancelled) return
          const mgr = managerRef.current
          if (!mgr) return

          mgr.tickCandle(live)

          // Update map first (O(1)), then the array buffer
          candleMapRef.current.set(live.openTime, live)

          const prev = candlesRef.current
          const idx  = prev.findIndex(c => c.openTime === live.openTime)
          if (idx >= 0) {
            const next = prev.slice()
            next[idx]  = live
            candlesRef.current = next
          } else {
            candlesRef.current = prev.concat(live)
          }

          if (live.isClosed) {
            mgr.updateAll(candlesRef.current)
          }
        }, marketTypeRef.current)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch chart data')
        setStatus('error')
      })

    return () => {
      cancelled = true
      unsubWs?.()
    }
  }, [symbol, interval, controlledCandles, retryKey])

  // In controlled (replay) mode, push candles whenever they change.
  useEffect(() => {
    if (controlledCandles === undefined) return
    candlesRef.current   = controlledCandles
    candleMapRef.current = new Map(controlledCandles.map(c => [c.openTime, c]))
    const manager = managerRef.current
    if (!manager) return
    manager.updateAll(controlledCandles)
    engineRef.current?.fitContent()
    setStatus('ready')
  }, [controlledCandles])

  // Push analysis result into analysis overlays whenever it changes.
  useEffect(() => {
    managerRef.current?.updateAnalysis(data)
  }, [data])

  const handleToggle = useCallback((id: IndicatorId, visible: boolean) => {
    const ind = INDICATORS.find(i => i.id === id)
    if (!ind) return
    const mgr = managerRef.current
    if (!mgr) return
    if (ind.group === 'overlay') mgr.setVisible(id, visible)
    else mgr.setVisibleAnalysis(id, visible)
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      <IndicatorPanel onToggle={handleToggle} />

      {/* Crosshair OHLCV + EMA HUD — DOM-updated directly, no re-render on cursor move */}
      <div
        ref={hudRef}
        style={{ display: 'none' }}
        className="absolute top-2 left-2 pointer-events-none z-10 flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0c0f18]/92 border border-white/[0.05] text-[11px] font-mono"
      >
        <span ref={hudTimeRef} className="text-slate-400 tabular-nums" />
        <span className="text-white/10 select-none">│</span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-slate-500 text-[9px] leading-none">O</span>
          <span ref={hudOpenRef}  className="text-slate-200 tabular-nums" />
        </span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-slate-500 text-[9px] leading-none">H</span>
          <span ref={hudHighRef}  className="text-slate-200 tabular-nums" />
        </span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-slate-500 text-[9px] leading-none">L</span>
          <span ref={hudLowRef}   className="text-slate-200 tabular-nums" />
        </span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-slate-500 text-[9px] leading-none">C</span>
          <span ref={hudCloseRef} className="text-slate-200 tabular-nums" />
        </span>
        <span ref={hudChangeRef} className="tabular-nums" />
        <span className="text-white/10 select-none">│</span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-slate-500 text-[9px] leading-none">Vol</span>
          <span ref={hudVolRef} className="text-slate-300 tabular-nums" />
        </span>
        {/* EMA values — colored to match their line */}
        <span className="text-white/10 select-none">│</span>
        {EMA_CONFIGS.map((cfg, i) => (
          <span key={cfg.period} className="flex items-baseline gap-0.5">
            <span className="text-[9px] leading-none" style={{ color: cfg.hudColor, opacity: 0.7 }}>E{cfg.period}</span>
            <span
              ref={el => { hudEmaRefs.current[i] = el }}
              className="tabular-nums"
              style={{ color: cfg.hudColor }}
            />
          </span>
        ))}
      </div>

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-slate-400 text-sm">Loading chart…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="text-red-400 text-sm text-center max-w-xs px-4">{errorMsg}</span>
          <p className="text-slate-500 text-xs text-center max-w-xs px-4">
            Check that the symbol is valid (e.g. BTCUSDT) and your connection is active.
          </p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="h-7 px-4 text-xs font-medium bg-surface-700 hover:bg-surface-600 text-slate-300
                       border border-border-subtle rounded-lg transition-colors
                       focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
})
