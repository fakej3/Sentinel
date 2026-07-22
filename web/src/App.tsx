import { useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import type { AppPage } from '@ui/types'
import type { Timeframe } from '@engine/market/types'
import { Header } from '@ui/components/layout/Header'
import { SkeletonDashboard } from '@ui/components/shared/Skeleton'
import { WebSidebar } from './components/WebSidebar'
import { WebBottomNav } from './components/WebBottomNav'
import { useAppState } from './hooks/useAppState'

const WEB_PAGES = new Set<AppPage>([
  'dashboard', 'chart', 'analysis', 'watchlist', 'history',
  'replay', 'scanner', 'settings',
])

const DashboardPage   = lazy(() => import('@ui/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ChartPage       = lazy(() => import('@ui/pages/ChartPage').then(m => ({ default: m.ChartPage })))
const AnalysisPage    = lazy(() => import('@ui/pages/AnalysisPage').then(m => ({ default: m.AnalysisPage })))
const WatchlistPage   = lazy(() => import('@ui/pages/WatchlistPage').then(m => ({ default: m.WatchlistPage })))
const HistoryPage     = lazy(() => import('@ui/pages/HistoryPage').then(m => ({ default: m.HistoryPage })))
const ReplayPage      = lazy(() => import('@ui/pages/ReplayPage').then(m => ({ default: m.ReplayPage })))
const ScannerPage     = lazy(() => import('./pages/ScannerPage').then(m => ({ default: m.ScannerPage })))
const WebSettingsPage = lazy(() => import('./pages/WebSettingsPage').then(m => ({ default: m.WebSettingsPage })))

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

  const cancelRef  = useRef(cancel)
  const loadingRef = useRef(loading)
  useEffect(() => { cancelRef.current  = cancel  }, [cancel])
  useEffect(() => { loadingRef.current = loading }, [loading])

  // Escape cancels an in-progress analysis; F5/Ctrl+R are left to the browser.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && loadingRef.current) cancelRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleNavigate = useCallback((p: AppPage) => {
    if (!WEB_PAGES.has(p)) setPage('dashboard')
    else setPage(p)
  }, [setPage])

  // Guard: if localStorage holds a page not supported here, reset once on mount.
  useEffect(() => {
    if (!WEB_PAGES.has(page)) setPage('dashboard')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isChartPage  = page === 'chart'
  const isReplayPage = page === 'replay'

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
        <WebSidebar
          collapsed={sidebarCollapsed}
          activePage={page}
          onNavigate={handleNavigate}
        />

        <main className={
          isChartPage || isReplayPage
            ? 'flex-1 min-w-0 flex flex-col overflow-hidden pb-14 md:pb-0'
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
                onNavigate={handleNavigate}
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
                onNavigate={handleNavigate}
                onLoadEntry={handleLoadEntry}
              />
            )}
            {page === 'replay' && (
              <ReplayPage
                initialSymbol={symbol || DEFAULT_SYMBOL}
                initialInterval={interval as Timeframe}
              />
            )}
            {page === 'scanner' && <ScannerPage />}
            {page === 'settings' && (
              <WebSettingsPage
                onClearHistory={handleClearHistory}
                onClearWatchlist={handleClearWatchlist}
                onClearAll={handleClearAll}
              />
            )}
          </Suspense>
        </main>
      </div>

      <WebBottomNav
        activePage={page}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
