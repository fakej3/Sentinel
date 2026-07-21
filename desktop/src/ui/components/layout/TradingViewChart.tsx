import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { createChart, CrosshairMode, type IChartApi } from 'lightweight-charts'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const managerRef = useRef<OverlayManager | null>(null)
  const candlesRef = useRef<Candle[]>([])   // live candle buffer — mutated without re-renders
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useImperativeHandle(ref, () => ({
    highlight(key: string | null) { managerRef.current?.highlight(key) },
    loadCandles(candles: Candle[]) {
      candlesRef.current = candles
      managerRef.current?.updateAll(candles)
      chartRef.current?.timeScale().fitContent()
    },
  }), [])

  // Create chart and overlay manager once — never recreated on prop changes.
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

    // Market data overlays (driven by fetchCandles)
    manager.add(new CandlestickOverlay())
    manager.add(new VolumeOverlay())
    manager.add(new EmaOverlay({ period: 20,  color: 'rgba(59, 130, 246, 0.45)' }))
    manager.add(new EmaOverlay({ period: 50,  color: 'rgba(234, 179, 8, 0.60)' }))
    manager.add(new EmaOverlay({ period: 100, color: 'rgba(16, 185, 129, 0.60)' }))
    manager.add(new EmaOverlay({ period: 200, color: 'rgba(139, 92, 246, 0.85)' }))

    // Analysis overlays (driven by PipelineResult)
    manager.addAnalysis(new SupportResistanceOverlay())
    manager.addAnalysis(new EntryZoneOverlay())
    manager.addAnalysis(new StopLossOverlay())
    manager.addAnalysis(new TakeProfitOverlay())
    manager.addAnalysis(new RiskRewardOverlay())
    manager.addAnalysis(new FibonacciOverlay())
    manager.addAnalysis(new MarketStructureOverlay())

    chartRef.current = chart
    managerRef.current = manager

    return () => {
      manager.dispose()
      chart.remove()
      chartRef.current = null
      managerRef.current = null
    }
  }, [])

  // Fetch historical candles then subscribe to live WS ticks (live mode only).
  useEffect(() => {
    if (controlledCandles !== undefined) return  // replay mode — skip live feed
    let cancelled  = false
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

        // Start live WS feed — updates arrive without triggering React re-renders.
        unsubWs = subscribeLiveCandles(symbol, interval as Timeframe, live => {
          if (cancelled) return
          const mgr = managerRef.current
          if (!mgr) return

          // Fast visual update: candlestick + volume only (O(1) series.update call).
          mgr.tickCandle(live)

          // Maintain the candles buffer — upsert by openTime.
          const prev = candlesRef.current
          const idx  = prev.findIndex(c => c.openTime === live.openTime)
          if (idx >= 0) {
            const next = prev.slice()
            next[idx]  = live
            candlesRef.current = next
          } else {
            candlesRef.current = prev.concat(live)
          }

          // On candle close, do a full update so EMAs and analysis overlays can refresh.
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
