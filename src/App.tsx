import { useCallback, lazy, Suspense, useState, useRef } from 'react'
import { Header } from './ui/components/layout/Header'
import { Sidebar } from './ui/components/layout/Sidebar'
import { BottomNav } from './ui/components/layout/BottomNav'
import { SkeletonDashboard } from './ui/components/shared/Skeleton'
import { useAnalyze } from './ui/hooks/useAnalyze'
import { useLocalStorage } from './ui/hooks/useLocalStorage'
import { resolveSymbol } from './ui/utils/symbolSearch'
import { getTransport } from './ui/transport'
import type { AppPage, RecentAnalysis } from './ui/types'
import type { HistoryEntry, HistoryMeta } from './ui/transport'

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

  const [savedEntry,  setSavedEntry ] = useState<HistoryMeta | null>(null)
  const [saving,      setSaving     ] = useState(false)
  const savingRef = useRef(false)

  const { data, loading, stage, error, analyze, loadData } = useAnalyze()

  const handleAnalyze = useCallback(async (symOverride?: string) => {
    const sym = resolveSymbol(symOverride ?? symbol)
    if (!sym) return
    if (sym !== symbol.trim().toUpperCase()) setSymbol(sym)
    setSavedEntry(null)
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
  }, [symbol, interval, analyze, setRecentAnalyses, setSymbol])

  const handleSaveAnalysis = useCallback(async () => {
    if (!data || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const meta = await getTransport().saveHistory(data, symbol, interval)
    savingRef.current = false
    setSaving(false)
    if (meta) setSavedEntry(meta)
  }, [data, symbol, interval])

  const handleSelectSymbol = useCallback((sym: string, iv?: string) => {
    setSymbol(sym)
    if (iv) setInterval(iv)
    setSavedEntry(null)
  }, [setSymbol, setInterval])

  const handleAddToWatchlist      = useCallback((sym: string) => setWatchlist(p => p.includes(sym) ? p : [...p, sym]), [setWatchlist])
  const handleRemoveFromWatchlist = useCallback((sym: string) => setWatchlist(p => p.filter(s => s !== sym)), [setWatchlist])
  const handleLoadEntry = useCallback((entry: HistoryEntry) => {
    const { result, ...meta } = entry
    setSymbol(entry.symbol)
    setInterval(entry.interval)
    setSavedEntry(meta)
    loadData(result)
  }, [setSymbol, setInterval, loadData])

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
        stage={stage}
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
                savedEntry={savedEntry}
                saving={saving}
                onAnalyze={handleAnalyze}
                onSave={handleSaveAnalysis}
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
                savedEntry={savedEntry}
                saving={saving}
                onAnalyze={handleAnalyze}
                onSave={handleSaveAnalysis}
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
                onLoadEntry={handleLoadEntry}
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
