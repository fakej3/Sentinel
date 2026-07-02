import { useState, useCallback, lazy, Suspense } from 'react'
import { AlertCircle, TrendingUp, ChevronDown } from 'lucide-react'
import { Header } from './ui/components/layout/Header'
import { LeftSidebar } from './ui/components/layout/LeftSidebar'
import { RightPanel } from './ui/components/layout/RightPanel'
import { PriceHeader } from './ui/components/layout/PriceHeader'
import { TradingViewChart } from './ui/components/layout/TradingViewChart'
import { ResizeDivider } from './ui/components/layout/ResizeDivider'
import { Tabs, TabPanel } from './ui/components/shared/Tabs'
import { SkeletonDashboard, SkeletonPriceHeader } from './ui/components/shared/Skeleton'
import { useAnalyze } from './ui/hooks/useAnalyze'
import { useLocalStorage } from './ui/hooks/useLocalStorage'
import { useResizablePanel, CHART_HEIGHT_DEFAULT, CHART_HEIGHT_MIN, CHART_HEIGHT_MAX } from './ui/hooks/useResizablePanel'
import type { AppTab, RecentAnalysis } from './ui/types'
import type { TabDef } from './ui/components/shared/Tabs'

const OverviewTab    = lazy(() => import('./ui/components/tabs/OverviewTab').then(m => ({ default: m.OverviewTab })))
const EvidenceTab    = lazy(() => import('./ui/components/tabs/EvidenceTab').then(m => ({ default: m.EvidenceTab })))
const IndicatorsTab  = lazy(() => import('./ui/components/tabs/IndicatorsTab').then(m => ({ default: m.IndicatorsTab })))
const StructureTab   = lazy(() => import('./ui/components/tabs/StructureTab').then(m => ({ default: m.StructureTab })))
const VolumeTab      = lazy(() => import('./ui/components/tabs/VolumeTab').then(m => ({ default: m.VolumeTab })))
const ValidationTab  = lazy(() => import('./ui/components/tabs/ValidationTab').then(m => ({ default: m.ValidationTab })))
const WriterTab      = lazy(() => import('./ui/components/tabs/WriterTab').then(m => ({ default: m.WriterTab })))
const BenchmarkTab   = lazy(() => import('./ui/components/tabs/BenchmarkTab').then(m => ({ default: m.BenchmarkTab })))

const DEFAULT_SYMBOL   = 'BTCUSDT'
const DEFAULT_INTERVAL = '1h'
const MAX_RECENT       = 5

export default function App() {
  const [symbol,           setSymbol          ] = useLocalStorage('sentinel_symbol', DEFAULT_SYMBOL)
  const [interval,         setInterval        ] = useLocalStorage('sentinel_interval', DEFAULT_INTERVAL)
  const [activeTab,        setActiveTab       ] = useLocalStorage<AppTab>('sentinel_active_tab', 'overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('sentinel_sidebar_collapsed', false)
  const [watchlist,        setWatchlist       ] = useLocalStorage<string[]>('sentinel_watchlist', [])
  const [recentAnalyses,   setRecentAnalyses  ] = useLocalStorage<RecentAnalysis[]>('sentinel_recent', [])

  const { data, loading, error, errorDetail, analyze } = useAnalyze()
  const { size: chartHeight, containerRef: chartRef, startDrag } = useResizablePanel(
    'sentinel_chart_height',
    CHART_HEIGHT_DEFAULT,
    CHART_HEIGHT_MIN,
    CHART_HEIGHT_MAX,
  )

  const handleAnalyze = useCallback(async () => {
    const sym = symbol.trim().toUpperCase()
    if (!sym) return
    const result = await analyze({ symbol: sym, interval })
    if (result) {
      setRecentAnalyses(prev => {
        const entry: RecentAnalysis = {
          symbol: sym,
          interval,
          timestamp: Date.now(),
          grade: result.confidence.grade,
          score: result.confidence.score,
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

  const handleAddToWatchlist    = useCallback((sym: string) => setWatchlist(p => p.includes(sym) ? p : [...p, sym]), [setWatchlist])
  const handleRemoveFromWatchlist = useCallback((sym: string) => setWatchlist(p => p.filter(s => s !== sym)), [setWatchlist])

  const evidenceCount = data?.analysis.evidence.length ?? 0
  const issueCount    = data?.validation.issues.length ?? 0

  const tabs: TabDef[] = [
    { id: 'overview',    label: 'Overview' },
    { id: 'evidence',    label: 'Evidence',   count: evidenceCount },
    { id: 'indicators',  label: 'Indicators' },
    { id: 'structure',   label: 'Structure' },
    { id: 'volume',      label: 'Volume' },
    { id: 'validation',  label: 'Validation', count: issueCount },
    { id: 'writer',      label: 'Writer' },
    { id: 'benchmark',   label: 'Benchmark' },
  ]

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-950 text-slate-200">
      {/* Global header */}
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

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left sidebar — collapses to w-0 */}
        <LeftSidebar
          collapsed={sidebarCollapsed}
          symbol={symbol}
          watchlist={watchlist}
          recentAnalyses={recentAnalyses}
          onAddToWatchlist={handleAddToWatchlist}
          onRemoveFromWatchlist={handleRemoveFromWatchlist}
          onSelectSymbol={handleSelectSymbol}
        />

        {/* Center */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Price header */}
          {loading ? (
            <SkeletonPriceHeader />
          ) : data ? (
            <PriceHeader result={data} />
          ) : (
            <div className="flex-shrink-0 px-6 py-4 border-b border-border-subtle">
              <p className="text-base font-bold text-slate-400 tracking-tight">{symbol || 'Sentinel'}</p>
              <p className="text-sm text-slate-600 mt-0.5">Enter a symbol and click Analyze</p>
            </div>
          )}

          {/* Resizable chart panel */}
          <div
            ref={chartRef}
            style={{ height: chartHeight }}
            className="flex-shrink-0 overflow-hidden"
          >
            <TradingViewChart symbol={symbol || DEFAULT_SYMBOL} interval={interval} />
          </div>

          {/* Resize handle */}
          <ResizeDivider onMouseDown={startDrag} />

          {/* Analysis panel */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {data && (
              <Tabs tabs={tabs} active={activeTab} onChange={tab => setActiveTab(tab as AppTab)} />
            )}

            <div className="flex-1 min-h-0 overflow-hidden">
              {loading ? (
                <SkeletonDashboard />
              ) : error ? (
                <ErrorState message={error} detail={errorDetail} onRetry={handleAnalyze} />
              ) : data ? (
                <Suspense fallback={<SkeletonDashboard />}>
                  <TabPanel>
                    {activeTab === 'overview'   && <OverviewTab   result={data} />}
                    {activeTab === 'evidence'   && <EvidenceTab   result={data} />}
                    {activeTab === 'indicators' && <IndicatorsTab result={data} />}
                    {activeTab === 'structure'  && <StructureTab  result={data} />}
                    {activeTab === 'volume'     && <VolumeTab     result={data} />}
                    {activeTab === 'validation' && <ValidationTab result={data} />}
                    {activeTab === 'writer'     && <WriterTab     result={data} />}
                    {activeTab === 'benchmark'  && <BenchmarkTab />}
                  </TabPanel>
                </Suspense>
              ) : (
                <EmptyState onAnalyze={handleAnalyze} symbol={symbol} loading={loading} />
              )}
            </div>
          </div>
        </main>

        {/* Right panel */}
        {data && !loading && (
          <RightPanel result={data} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ onAnalyze, symbol, loading }: { onAnalyze: () => void; symbol: string; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-surface-700 border border-border-subtle flex items-center justify-center mb-4">
        <TrendingUp size={24} className="text-blue-400" />
      </div>
      <h2 className="text-base font-semibold text-slate-200 mb-2">Ready to analyze</h2>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-5">
        Enter a symbol in the header and click Analyze to run the engine.
      </p>
      <button
        onClick={onAnalyze}
        disabled={loading || !symbol.trim()}
        className="btn-primary px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Analyze {symbol || '…'}
      </button>
    </div>
  )
}

function ErrorState({ message, detail, onRetry }: { message: string; detail?: string; onRetry: () => void }) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center mb-4">
        <AlertCircle size={24} className="text-red-400" />
      </div>
      <h2 className="text-base font-semibold text-red-400 mb-2">Analysis failed</h2>
      <p className="text-sm text-slate-300 max-w-sm leading-relaxed mb-4">{message}</p>

      {detail && (
        <div className="w-full max-w-sm mb-4">
          <button
            onClick={() => setShowDetail(d => !d)}
            aria-expanded={showDetail}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-400 transition-colors mx-auto
                       focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
          >
            <ChevronDown
              size={12}
              aria-hidden="true"
              className={`transition-transform duration-150 ${showDetail ? 'rotate-180' : ''}`}
            />
            {showDetail ? 'Hide' : 'Show'} technical details
          </button>
          {showDetail && (
            <div className="mt-2 px-3 py-2 bg-surface-800 border border-border-subtle rounded-lg text-left">
              <p className="text-[11px] font-mono text-slate-500 break-all leading-relaxed">{detail}</p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onRetry}
        className="btn-primary bg-red-600 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        Try again
      </button>
    </div>
  )
}
