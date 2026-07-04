import { useCallback, lazy, Suspense } from 'react'
import { Header } from './ui/components/layout/Header'
import { Sidebar } from './ui/components/layout/Sidebar'
import { BottomNav } from './ui/components/layout/BottomNav'
import { SkeletonDashboard } from './ui/components/shared/Skeleton'
import { useAnalyze } from './ui/hooks/useAnalyze'
import { useLocalStorage } from './ui/hooks/useLocalStorage'
import { resolveSymbol } from './ui/utils/symbolSearch'
import type { AppPage, RecentAnalysis } from './ui/types'

const DashboardPage = lazy(() => import('./ui/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ChartPage     = lazy(() => import('./ui/pages/ChartPage').then(m => ({ default: m.ChartPage })))
const AnalysisPage  = lazy(() => import('./ui/pages/AnalysisPage').then(m => ({ default: m.AnalysisPage })))
const WatchlistPage = lazy(() => import('./ui/pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })))
const HistoryPage   = lazy(() => import('./ui/pages/HistoryPage').then(m => ({ default: m.HistoryPage })))
const SettingsPage  = lazy(() => import('./ui/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

const DEFAULT_SYMBOL   = 'BTCUSDT'
const DEFAULT_INTERVAL = '1h'
const MAX_RECENT       = 10

export default function App() {
  const [symbol,           setSymbol          ] = useLocalStorage('sentinel_symbol', DEFAULT_SYMBOL)
  const [interval,         setInterval        ] = useLocalStorage('sentinel_interval', DEFAULT_INTERVAL)
  const [page,             setPage            ] = useLocalStorage<AppPage>('sentinel_page', 'dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('sentinel_sidebar_collapsed', false)
  const [watchlist,        setWatchlist       ] = useLocalStorage<string[]>('sentinel_watchlist', [])
  const [recentAnalyses,   setRecentAnalyses  ] = useLocalStorage<RecentAnalysis[]>('sentinel_recent', [])

  const { data, loading, error, analyze } = useAnalyze()

  const handleAnalyze = useCallback(async () => {
    const sym = resolveSymbol(symbol)
    if (!sym) return
    // Update the displayed symbol to the resolved form (e.g. "ETH" → "ETHUSDT")
    if (sym !== symbol.trim().toUpperCase()) setSymbol(sym)
    const result = await analyze({ symbol: sym, interval })
    if (result) {
      setRecentAnalyses(prev => {
        const entry: RecentAnalysis = {
          symbol: sym,
          interval,
          timestamp: Date.now(),
          grade: result.confidence.grade,
          score: result.confidence.score,
          decision: result.decision?.label,
          bias: result.analysis.fullTrend.trend,
        }
        const filtered = prev.filter(r => !(r.symbol === sym && r.interval === interval))
        return [entry, ...filtered].slice(0, MAX_RECENT)
      })
    }
  }, [symbol, interval, analyze, setRecentAnalyses])

  const handleSelectSymbol = useCallback((sym: string, iv?: string) => {
    setSymbol(sym)
    if (iv) setInterval(iv)
  }, [setSymbol, setInterval])

  const handleAddToWatchlist      = useCallback((sym: string) => setWatchlist(p => p.includes(sym) ? p : [...p, sym]), [setWatchlist])
  const handleRemoveFromWatchlist = useCallback((sym: string) => setWatchlist(p => p.filter(s => s !== sym)), [setWatchlist])
  const handleClearHistory        = useCallback(() => setRecentAnalyses([]), [setRecentAnalyses])
  const handleClearWatchlist      = useCallback(() => setWatchlist([]), [setWatchlist])
  const handleClearAll            = useCallback(() => { setRecentAnalyses([]); setWatchlist([]) }, [setRecentAnalyses, setWatchlist])

  const isChartPage = page === 'chart'

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-950 text-slate-200">
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(c => !c)}
        symbol={symbol}
        interval={interval}
        loading={loading}
        onSymbolChange={setSymbol}
        onIntervalChange={setInterval}
        onAnalyze={handleAnalyze}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          activePage={page}
          onNavigate={setPage}
        />

        <main className={
          isChartPage
            ? 'flex-1 min-w-0 flex flex-col overflow-hidden'
            : 'flex-1 min-w-0 overflow-y-auto'
        }>
          <Suspense fallback={<SkeletonDashboard />}>
            {page === 'dashboard' && (
              <DashboardPage
                symbol={symbol}
                interval={interval}
                loading={loading}
                error={error}
                data={data}
                recentAnalyses={recentAnalyses}
                onAnalyze={handleAnalyze}
                onSymbolSelect={handleSelectSymbol}
                onNavigate={setPage}
              />
            )}
            {page === 'chart' && (
              <ChartPage
                symbol={symbol || DEFAULT_SYMBOL}
                interval={interval}
                data={data}
              />
            )}
            {page === 'analysis' && (
              <AnalysisPage
                data={data}
                loading={loading}
                onAnalyze={handleAnalyze}
                symbol={symbol}
              />
            )}
            {page === 'watchlist' && (
              <WatchlistPage
                symbol={symbol}
                watchlist={watchlist}
                recentAnalyses={recentAnalyses}
                onAddToWatchlist={handleAddToWatchlist}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
                onSelectSymbol={handleSelectSymbol}
                onAnalyze={handleAnalyze}
              />
            )}
            {page === 'history' && (
              <HistoryPage
                recentAnalyses={recentAnalyses}
                onSelectSymbol={handleSelectSymbol}
                onClearHistory={handleClearHistory}
                onNavigate={setPage}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                onClearHistory={handleClearHistory}
                onClearWatchlist={handleClearWatchlist}
                onClearAll={handleClearAll}
              />
            )}
          </Suspense>
        </main>
      </div>

      <BottomNav
        activePage={page}
        onNavigate={setPage}
        hasData={!!data}
      />
    </div>
  )
}
