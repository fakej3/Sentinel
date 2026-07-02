import { useState, useCallback, lazy, Suspense } from 'react'
import { AlertCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { Header } from './ui/components/layout/Header'
import { LeftSidebar } from './ui/components/layout/LeftSidebar'
import { MarketSummaryBar } from './ui/components/layout/MarketSummaryBar'
import { MobileNav } from './ui/components/layout/MobileNav'
import { TradingViewChart } from './ui/components/layout/TradingViewChart'
import { ResizeDivider } from './ui/components/layout/ResizeDivider'
import { Tabs, TabPanel } from './ui/components/shared/Tabs'
import { SkeletonDashboard } from './ui/components/shared/Skeleton'
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
  const [mobileMenuOpen,   setMobileMenuOpen  ] = useState(false)

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
    setMobileMenuOpen(false)
  }, [setSymbol, setInterval])

  const handleAddToWatchlist    = useCallback((sym: string) => setWatchlist(p => p.includes(sym) ? p : [...p, sym]), [setWatchlist])
  const handleRemoveFromWatchlist = useCallback((sym: string) => setWatchlist(p => p.filter(s => s !== sym)), [setWatchlist])

  const evidenceCount = data?.analysis.evidence.length ?? 0
  const issueCount    = data?.validation.issues.length ?? 0

  // 'overview' is always rendered inline below chart; detailTab drives the tabbed section
  const detailTab: AppTab = activeTab === 'overview' ? 'evidence' : activeTab

  const detailTabs: TabDef[] = [
    { id: 'evidence',    label: 'Evidence',   count: evidenceCount },
    { id: 'indicators',  label: 'Indicators' },
    { id: 'structure',   label: 'Structure' },
    { id: 'volume',      label: 'Volume' },
    { id: 'validation',  label: 'Validation', count: issueCount },
    { id: 'writer',      label: 'Writer' },
    { id: 'benchmark',   label: 'Benchmark' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-surface-950 text-slate-200" id="top">
      {/* Sticky global header */}
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(c => !c)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        symbol={symbol}
        interval={interval}
        loading={loading}
        onSymbolChange={setSymbol}
        onIntervalChange={setInterval}
        onAnalyze={handleAnalyze}
      />

      {/* Body row */}
      <div className="flex flex-1">
        {/* Sidebar — desktop sticky, mobile drawer */}
        <LeftSidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          symbol={symbol}
          watchlist={watchlist}
          recentAnalyses={recentAnalyses}
          onAddToWatchlist={handleAddToWatchlist}
          onRemoveFromWatchlist={handleRemoveFromWatchlist}
          onSelectSymbol={handleSelectSymbol}
        />

        {/* Main content — naturally scrolling, extra bottom pad for mobile nav */}
        <main className="flex-1 min-w-0 flex flex-col pb-14 lg:pb-0">
          {/* Price header / market summary */}
          <MarketSummaryBar
            symbol={symbol}
            interval={interval}
            loading={loading}
            data={data}
          />

          {/* Chart panel */}
          <div id="chart" className="scroll-target">
            <div ref={chartRef} style={{ height: chartHeight }}>
              <TradingViewChart symbol={symbol || DEFAULT_SYMBOL} interval={interval} />
            </div>
            <ResizeDivider onMouseDown={startDrag} />
          </div>

          {/* Content below chart */}
          {loading ? (
            <SkeletonDashboard />
          ) : error ? (
            <ErrorState message={error} detail={errorDetail} onRetry={handleAnalyze} />
          ) : data ? (
            <>
              {/* Analysis overview — always inline, no tab required */}
              <section id="analysis" className="scroll-target border-b border-border-subtle">
                <Suspense fallback={<SkeletonDashboard />}>
                  <OverviewTab result={data} />
                </Suspense>
              </section>

              {/* Tabbed detail section */}
              <section id="detail" className="scroll-target">
                <Tabs
                  tabs={detailTabs}
                  active={detailTab}
                  onChange={tab => setActiveTab(tab as AppTab)}
                />
                <Suspense fallback={<SkeletonDashboard />}>
                  <TabPanel>
                    {detailTab === 'evidence'   && <EvidenceTab   result={data} />}
                    {detailTab === 'indicators' && <IndicatorsTab result={data} />}
                    {detailTab === 'structure'  && <StructureTab  result={data} />}
                    {detailTab === 'volume'     && <VolumeTab     result={data} />}
                    {detailTab === 'validation' && <ValidationTab result={data} />}
                    {detailTab === 'writer'     && <WriterTab     result={data} />}
                    {detailTab === 'benchmark'  && <BenchmarkTab />}
                  </TabPanel>
                </Suspense>
              </section>
            </>
          ) : (
            <EmptyState onAnalyze={handleAnalyze} symbol={symbol} loading={loading} />
          )}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav
        hasData={!!data}
        onOpenWatchlist={() => setMobileMenuOpen(true)}
      />
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function ChartIllustration() {
  return (
    <svg width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden="true" className="text-slate-700">
      <line x1="12" y1="18" x2="84" y2="18" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 3" />
      <line x1="12" y1="36" x2="84" y2="36" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 3" />
      <line x1="12" y1="54" x2="84" y2="54" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 3" />
      <line x1="12" y1="10" x2="12" y2="64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="64" x2="84" y2="64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <polyline
        points="12,52 26,46 40,48 52,34 64,24 76,18"
        stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.6"
      />
      <polygon
        points="12,52 26,46 40,48 52,34 64,24 76,18 76,64 12,64"
        fill="#3b82f6" fillOpacity="0.06"
      />
      <circle cx="52" cy="34" r="2.5" fill="#3b82f6" fillOpacity="0.5" />
      <circle cx="76" cy="18" r="2.5" fill="#3b82f6" fillOpacity="0.7" />
    </svg>
  )
}

function EmptyState({ onAnalyze, symbol, loading }: { onAnalyze: () => void; symbol: string; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-8 py-16 animate-fade-in select-none">
      <div className="mb-5 opacity-70">
        <ChartIllustration />
      </div>
      <h2 className="text-sm font-semibold text-slate-300 mb-1.5">Ready to analyze</h2>
      <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-5">
        Use the header to set a symbol and timeframe, then click Analyze to run the engine.
      </p>
      <button
        onClick={onAnalyze}
        disabled={loading || !symbol.trim()}
        className="h-8 px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg
                   transition-colors duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Analyze {symbol || '…'}
      </button>
    </div>
  )
}

// ── Error state ────────────────────────────────────────────────────────────────

function ErrorState({ message, detail, onRetry }: { message: string; detail?: string; onRetry: () => void }) {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-8 py-16 animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-red-400/8 border border-red-400/15 flex items-center justify-center mb-4">
        <AlertCircle size={22} className="text-red-400" />
      </div>
      <h2 className="text-sm font-semibold text-slate-200 mb-1.5">Analysis failed</h2>
      <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">{message}</p>

      <div className="w-full max-w-sm mb-4" style={{ minHeight: detail ? undefined : 0 }}>
        {detail && (
          <>
            <button
              onClick={() => setShowDetail(d => !d)}
              aria-expanded={showDetail}
              className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 transition-colors mx-auto
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded px-1"
            >
              <ChevronDown
                size={11}
                aria-hidden="true"
                className={`transition-transform duration-150 ${showDetail ? 'rotate-180' : ''}`}
              />
              {showDetail ? 'Hide' : 'Show'} technical details
            </button>
            {showDetail && (
              <div className="mt-2 px-3 py-2 bg-surface-800 border border-border-subtle rounded-lg text-left">
                <p className="text-[10px] font-mono text-slate-600 break-all leading-relaxed">{detail}</p>
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={onRetry}
        className="h-8 px-4 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold rounded-lg
                   transition-colors duration-150 active:scale-95 flex items-center gap-1.5
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <RefreshCw size={12} />
        Try again
      </button>
    </div>
  )
}
