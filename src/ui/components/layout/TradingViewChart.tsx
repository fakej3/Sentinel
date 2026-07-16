import { useEffect, useRef } from 'react'

const TV_INTERVAL_MAP: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '6h': '360', '8h': '480',
  '12h': '720', '1d': 'D', '3d': '3D', '1w': 'W', '1M': 'M',
}

interface TradingViewChartProps {
  symbol: string
  interval: string
}

export function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLScriptElement | null>(null)

  const tvInterval = TV_INTERVAL_MAP[interval] ?? '60'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous widget
    container.innerHTML = ''
    if (widgetRef.current) {
      widgetRef.current.remove()
      widgetRef.current = null
    }

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.height = '100%'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${symbol}`,
      interval: tvInterval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#0c0f18',
      gridColor: '#1a2035',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      studies: ['RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
      show_popup_button: false,
      popup_width: '1000',
      popup_height: '650',
    })
    container.appendChild(script)
    widgetRef.current = script

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove()
        widgetRef.current = null
      }
    }
  }, [symbol, tvInterval])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full h-full"
      style={{ minHeight: 0 }}
    />
  )
}
