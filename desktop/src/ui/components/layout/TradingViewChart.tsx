import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { createChart, CrosshairMode, type IChartApi, type MouseEventParams, type Time } from 'lightweight-charts'
import { fetchCandles } from '../../../modules/binance/endpoints'
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

export const TradingViewChart = forwardRef<TradingViewChartHandle, TradingViewChartProps>(
function TradingViewChart({ symbol, interval, data, candles: controlledCandles }, ref) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const managerRef    = useRef<OverlayManager | null>(null)
  const candlesRef    = useRef<Candle[]>([])

  // HUD element refs — updated via direct DOM writes on every crosshair move (no re-render)
  const hudRef        = useRef<HTMLDivElement>(null)
  const hudTimeRef    = useRef<HTMLSpanElement>(null)
  const hudOpenRef    = useRef<HTMLSpanElement>(null)
  const hudHighRef    = useRef<HTMLSpanElement>(null)
  const hudLowRef     = useRef<HTMLSpanElement>(null)
  const hudCloseRef   = useRef<HTMLSpanElement>(null)
  const hudChangeRef  = useRef<HTMLSpanElement>(null)
  const hudVolRef     = useRef<HTMLSpanElement>(null)

  const [status,   setStatus]   = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useImperativeHandle(ref, () => ({
    highlight(key: string | null) { managerRef.current?.highlight(key) },
    loadCandles(candles: Candle[]) {
      candlesRef.current = candles
      managerRef.current?.updateAll(candles)
      chartRef.current?.timeScale().fitContent()
    },
  }), [])

  // Create chart, overlay manager, and crosshair HUD — runs once.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: '#0c0f18' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#111827' },
        horzLines: { color: '#1a2035' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: 'rgba(119,134,150,0.4)', width: 1, style: 0, labelBackgroundColor: '#1e293b' },
        horzLine: { color: 'rgba(119,134,150,0.4)', width: 1, style: 0, labelBackgroundColor: '#1e293b' },
      },
      timeScale: {
        borderColor: '#1e2a3a',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: '#1e2a3a',
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
    })

    const manager = new OverlayManager(chart)

    manager.add(new CandlestickOverlay())
    manager.add(new VolumeOverlay())
    manager.add(new EmaOverlay({ period: 20,  color: 'rgba(59, 130, 246, 0.45)' }))
    manager.add(new EmaOverlay({ period: 50,  color: 'rgba(234, 179, 8, 0.60)' }))
    manager.add(new EmaOverlay({ period: 100, color: 'rgba(16, 185, 129, 0.60)' }))
    manager.add(new EmaOverlay({ period: 200, color: 'rgba(139, 92, 246, 0.85)' }))

    manager.addAnalysis(new SupportResistanceOverlay())
    manager.addAnalysis(new EntryZoneOverlay())
    manager.addAnalysis(new StopLossOverlay())
    manager.addAnalysis(new TakeProfitOverlay())
    manager.addAnalysis(new RiskRewardOverlay())
    manager.addAnalysis(new FibonacciOverlay())
    manager.addAnalysis(new MarketStructureOverlay())

    chartRef.current  = chart
    managerRef.current = manager

    // Crosshair HUD — update DOM directly on every move, no React re-render
    const onCrosshair = (param: MouseEventParams<Time>) => {
      const hud = hudRef.current
      if (!hud) return

      if (!param.time || !param.point) {
        hud.style.display = 'none'
        return
      }

      const timeMs = (param.time as number) * 1000
      const candle = candlesRef.current.find(c => c.openTime === timeMs)
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
    }

    chart.subscribeCrosshairMove(onCrosshair)

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair)
      manager.dispose()
      chart.remove()
      chartRef.current  = null
      managerRef.current = null
    }
  }, [])

  // Fetch historical candles then subscribe to live WS ticks (live mode only).
  useEffect(() => {
    if (controlledCandles !== undefined) return
    let cancelled = false
    let unsubWs: (() => void) | null = null
    setStatus('loading')
    setErrorMsg('')

    fetchCandles(symbol, interval as Timeframe)
      .then(initial => {
        if (cancelled) return
        const manager = managerRef.current
        if (!manager) return

        candlesRef.current = initial
        manager.updateAll(initial)
        chartRef.current?.timeScale().fitContent()
        setStatus('ready')

        unsubWs = subscribeLiveCandles(symbol, interval as Timeframe, live => {
          if (cancelled) return
          const mgr = managerRef.current
          if (!mgr) return

          mgr.tickCandle(live)

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
        })
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
  }, [symbol, interval, controlledCandles])

  // In controlled (replay) mode, push candles whenever they change.
  useEffect(() => {
    if (controlledCandles === undefined) return
    candlesRef.current = controlledCandles  // keep in sync for HUD lookup
    const manager = managerRef.current
    if (!manager) return
    manager.updateAll(controlledCandles)
    chartRef.current?.timeScale().fitContent()
    setStatus('ready')
  }, [controlledCandles])

  // Push analysis result into analysis overlays whenever it changes.
  useEffect(() => {
    managerRef.current?.updateAnalysis(data)
  }, [data])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Crosshair OHLCV HUD — DOM-updated directly, no re-render on cursor move */}
      <div
        ref={hudRef}
        style={{ display: 'none' }}
        className="absolute top-2 left-2 pointer-events-none z-10 flex items-center gap-2.5 px-2.5 py-1 rounded bg-[#0c0f18]/90 border border-white/[0.06] text-[11px] font-mono"
      >
        <span ref={hudTimeRef}   className="text-slate-500" />
        <span className="text-slate-600">O</span>
        <span ref={hudOpenRef}   className="text-slate-200" />
        <span className="text-slate-600">H</span>
        <span ref={hudHighRef}   className="text-slate-200" />
        <span className="text-slate-600">L</span>
        <span ref={hudLowRef}    className="text-slate-200" />
        <span className="text-slate-600">C</span>
        <span ref={hudCloseRef}  className="text-slate-200" />
        <span ref={hudChangeRef} />
        <span className="text-slate-600">Vol</span>
        <span ref={hudVolRef}    className="text-slate-400" />
      </div>

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-slate-400 text-sm">Loading chart…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-red-400 text-sm">{errorMsg}</span>
        </div>
      )}
    </div>
  )
})
