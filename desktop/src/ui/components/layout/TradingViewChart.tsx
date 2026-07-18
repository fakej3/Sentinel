import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { fetchCandles } from '../../../modules/binance/endpoints'
import type { Candle, Timeframe } from '../../../modules/market/types'

interface TradingViewChartProps {
  symbol: string
  interval: string
}

export function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  // Create chart and series once — never recreated on prop changes.
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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  // Fetch and load data whenever symbol or interval changes.
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setErrorMsg('')

    fetchCandles(symbol, interval as Timeframe)
      .then((candles: Candle[]) => {
        if (cancelled) return
        const cs = candleSeriesRef.current
        const vs = volumeSeriesRef.current
        if (!cs || !vs) return

        cs.setData(candles.map((c: Candle) => ({
          time: Math.floor(c.openTime / 1000) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })))

        vs.setData(candles.map((c: Candle) => ({
          time: Math.floor(c.openTime / 1000) as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? '#26a69a40' : '#ef535040',
        })))

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
}
