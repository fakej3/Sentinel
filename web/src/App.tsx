import { useEffect, useRef, lazy, Suspense } from 'react'
import type { Timeframe } from '@engine/market/types'
import { Header } from '@ui/components/layout/Header'
import { SkeletonDashboard } from '@ui/components/shared/Skeleton'
import { WebSidebar } from './components/WebSidebar'
import { WebBottomNav } from './components/WebBottomNav'
import { useAppState } from './hooks/useAppState'

const DashboardPage  = lazy(() => import('@ui/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ChartPage      = lazy(() => import('@ui/pages/ChartPage').then(m => ({ default: m.ChartPage })))
const ReplayPage     = lazy(() => import('@ui/pages/ReplayPage').then(m => ({ default: m.ReplayPage })))
const ScannerPage    = lazy(() => import('./pages/ScannerPage').then(m => ({ default: m.ScannerPage })))
const WebSettingsPage = lazy(() => import('./pages/WebSettingsPage').then(m => ({ default: m.WebSettingsPage })))

const DEFAULT_SYMBOL = 'BTCUSDT'

export default function App() {
  const {
    symbol, setSymbol,
    interval, setInterval,
    page, setPage,
    sidebarCollapsed,
    recentAnalyses,
    savedEntry,
    saving,
    data, loading, stage, error, cancel,
    handleAnalyze,
    handleSaveAnalysis,
    handleSelectSymbol,
    handleToggleSidebar,
    handleClearHistory,
    handleClearWatchlist,
    handleClearAll,
  } = useAppState()

  const handleAnalyzeRef = useRef(handleAnalyze)
  const cancelRef        = useRef(cancel)
  const loadingRef       = useRef(loading)
  useEffect(() => { handleAnalyzeRef.current = handleAnalyze }, [handleAnalyze])
  useEffect(() => { cancelRef.current        = cancel        }, [cancel])
  useEffect(() => { loadingRef.current       = loading       }, [loading])

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
          onNavigate={setPage}
        />

        <main className={
          isChartPage || isReplayPage
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
        onNavigate={setPage}
      />
    </div>
  )
}
