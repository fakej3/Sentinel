import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { createChart, type IChartApi } from 'lightweight-charts'
import { fetchCandles } from '../../../modules/binance/endpoints'
import type { Timeframe } from '../../../modules/market/types'
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
}

interface TradingViewChartProps {
  symbol: string
  interval: string
  data: PipelineResult | null
}

export const TradingViewChart = forwardRef<TradingViewChartHandle, TradingViewChartProps>(
function TradingViewChart({ symbol, interval, data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const managerRef = useRef<OverlayManager | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useImperativeHandle(ref, () => ({
    highlight(key: string | null) { managerRef.current?.highlight(key) },
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
        vertLines: { color: '#1a2035' },
        horzLines: { color: '#1a2035' },
      },
      crosshair: {
        vertLine: { color: '#334155', width: 1, style: 2, labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#334155', width: 1, style: 2, labelBackgroundColor: '#1e293b' },
      },
      timeScale: {
        borderColor: '#1e2a3a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1e2a3a',
      },
    })

    const manager = new OverlayManager(chart)

    // Market data overlays (driven by fetchCandles)
    manager.add(new CandlestickOverlay())
    manager.add(new VolumeOverlay())
    manager.add(new EmaOverlay({ period: 20,  color: '#3b82f6' }))
    manager.add(new EmaOverlay({ period: 50,  color: '#f59e0b' }))
    manager.add(new EmaOverlay({ period: 100, color: '#10b981' }))
    manager.add(new EmaOverlay({ period: 200, color: '#8b5cf6' }))

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

  // Fetch and load market data whenever symbol or interval changes.
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setErrorMsg('')

    fetchCandles(symbol, interval as Timeframe)
      .then(candles => {
        if (cancelled) return
        const manager = managerRef.current
        if (!manager) return

        manager.updateAll(candles)
        chartRef.current?.timeScale().fitContent()
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch chart data')
        setStatus('error')
      })

    return () => { cancelled = true }
  }, [symbol, interval])

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
