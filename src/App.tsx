import { useEffect, useRef, lazy, Suspense } from 'react'
import { Header } from './ui/components/layout/Header'
import { Sidebar } from './ui/components/layout/Sidebar'
import { BottomNav } from './ui/components/layout/BottomNav'
import { SkeletonDashboard } from './ui/components/shared/Skeleton'
import { useAppState } from './ui/hooks/useAppState'
import { isTauriEnv } from './ui/transport'

const isDesktop = isTauriEnv()

const DashboardPage = lazy(() => import('./ui/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ChartPage     = lazy(() => import('./ui/pages/ChartPage').then(m => ({ default: m.ChartPage })))
const AnalysisPage  = lazy(() => import('./ui/pages/AnalysisPage').then(m => ({ default: m.AnalysisPage })))
const WatchlistPage = lazy(() => import('./ui/pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })))
const HistoryPage   = lazy(() => import('./ui/pages/HistoryPage').then(m => ({ default: m.HistoryPage })))
const SettingsPage  = lazy(() => import('./ui/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

const DEFAULT_SYMBOL = 'BTCUSDT'

export default function App() {
  const {
    symbol, setSymbol,
    interval, setInterval,
    page, setPage,
    sidebarCollapsed,
    watchlist,
    recentAnalyses,
    savedEntry,
    saving,
    data, loading, stage, error, cancel,
    handleAnalyze,
    handleSaveAnalysis,
    handleSelectSymbol,
    handleToggleSidebar,
    handleAddToWatchlist,
    handleRemoveFromWatchlist,
    handleLoadEntry,
    handleClearHistory,
    handleClearWatchlist,
    handleClearAll,
  } = useAppState()

  // Refs so the keyboard handler is installed once and always sees current values.
  const handleAnalyzeRef = useRef(handleAnalyze)
  const cancelRef        = useRef(cancel)
  const loadingRef       = useRef(loading)
  useEffect(() => { handleAnalyzeRef.current = handleAnalyze }, [handleAnalyze])
  useEffect(() => { cancelRef.current        = cancel        }, [cancel])
  useEffect(() => { loadingRef.current       = loading       }, [loading])

  // Global keyboard shortcuts — registered once, never torn down.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inInput = (e.target as Element)?.tagName === 'INPUT' || (e.target as Element)?.tagName === 'TEXTAREA'
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey && !inInput) {
        e.preventDefault()
        handleAnalyzeRef.current()
      }
      if (e.key === 'F5' && !inInput) {
        e.preventDefault()
        handleAnalyzeRef.current()
      }
      if (e.key === 'Escape' && loadingRef.current) {
        cancelRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, []) // empty deps — install once, use refs for current values

  // Window title — update to reflect current symbol in Tauri
  useEffect(() => {
    if (!isDesktop) return
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      const title = symbol.trim() ? `Sentinel — ${symbol.trim()} · ${interval}` : 'Sentinel'
      getCurrentWindow().setTitle(title).catch(() => {})
    }).catch(() => {})
  }, [symbol, interval])

  const isChartPage = page === 'chart'

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-950 text-slate-200">
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
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
