import { useState } from 'react'
import { fetchMarketData, BinanceApiError } from './modules/binance'
import type { MarketData } from './modules/binance'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
const TIMEFRAMES = ['1h', '4h', '1d', '1w'] as const

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '1d' | '1w'>('4h')
  const [data, setData] = useState<MarketData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await fetchMarketData(symbol, timeframe, {
        candleLimit: 200,
        includeFunding: false,
        includeOpenInterest: false,
      })
      setData(result)
    } catch (e) {
      if (e instanceof BinanceApiError) {
        setError(`Binance API error: ${e.message}`)
      } else {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 1.5rem' }}>Sentinel — Module 1 Validation</h2>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <select value={symbol} onChange={e => setSymbol(e.target.value)}>
          {SYMBOLS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={timeframe} onChange={e => setTimeframe(e.target.value as typeof timeframe)}>
          {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button onClick={run} disabled={loading}>
          {loading ? 'Fetching…' : 'Fetch Market Data'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#e55', background: '#2a0000', padding: '0.75rem', borderRadius: '4px' }}>
          {error}
        </p>
      )}

      {data && (
        <div>
          <p style={{ color: '#888', marginBottom: '0.5rem' }}>
            {data.symbol} · {data.timeframe} · {data.candles.length} candles ·
            fetched at {new Date(data.fetchedAt).toLocaleTimeString()}
          </p>
          <pre style={{
            background: '#111', color: '#0f0', padding: '1rem',
            borderRadius: '4px', overflow: 'auto', fontSize: '0.8rem',
          }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
