import { useState, useCallback } from 'react'
import { AlertCircle, TrendingUp } from 'lucide-react'
import { LeftSidebar } from './ui/components/layout/LeftSidebar'
import { RightPanel } from './ui/components/layout/RightPanel'
import { PriceHeader } from './ui/components/layout/PriceHeader'
import { TradingViewChart } from './ui/components/layout/TradingViewChart'
import { Tabs, TabPanel } from './ui/components/shared/Tabs'
import { OverviewTab } from './ui/components/tabs/OverviewTab'
import { EvidenceTab } from './ui/components/tabs/EvidenceTab'
import { IndicatorsTab } from './ui/components/tabs/IndicatorsTab'
import { StructureTab } from './ui/components/tabs/StructureTab'
import { VolumeTab } from './ui/components/tabs/VolumeTab'
import { ValidationTab } from './ui/components/tabs/ValidationTab'
import { WriterTab } from './ui/components/tabs/WriterTab'
import { BenchmarkTab } from './ui/components/tabs/BenchmarkTab'
import { SkeletonDashboard, SkeletonPriceHeader } from './ui/components/shared/Skeleton'
import { useAnalyze } from './ui/hooks/useAnalyze'
import { useLocalStorage } from './ui/hooks/useLocalStorage'
import type { AppTab, RecentAnalysis } from './ui/types'
import type { TabDef } from './ui/components/shared/Tabs'

const DEFAULT_SYMBOL = 'BTCUSDT'
const DEFAULT_INTERVAL = '1h'
const MAX_RECENT = 5

export default function App() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [interval, setInterval] = useState(DEFAULT_INTERVAL)
  const [activeTab, setActiveTab] = useState<AppTab>('overview')
  const [watchlist, setWatchlist] = useLocalStorage<string[]>('sentinel_watchlist', [])
  const [recentAnalyses, setRecentAnalyses] = useLocalStorage<RecentAnalysis[]>('sentinel_recent', [])
  const { data, loading, error, analyze } = useAnalyze()

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

  const handleAddToWatchlist = useCallback((sym: string) => {
    setWatchlist(prev => prev.includes(sym) ? prev : [...prev, sym])
  }, [setWatchlist])

  const handleRemoveFromWatchlist = useCallback((sym: string) => {
    setWatchlist(prev => prev.filter(s => s !== sym))
  }, [setWatchlist])

  const handleSelectSymbol = useCallback((sym: string) => {
    setSymbol(sym)
  }, [])

  const evidenceCount = data?.analysis.evidence.length ?? 0
  const issueCount = data?.validation.issues.length ?? 0

  const tabs: TabDef[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'evidence', label: 'Evidence', count: evidenceCount },
    { id: 'indicators', label: 'Indicators' },
    { id: 'structure', label: 'Structure' },
    { id: 'volume', label: 'Volume' },
    { id: 'validation', label: 'Validation', count: issueCount },
    { id: 'writer', label: 'Writer' },
    { id: 'benchmark', label: 'Benchmark' },
  ]

  return (
    <div className="h-screen flex overflow-hidden bg-surface-950 text-slate-200">
      {/* Left Sidebar */}
      <LeftSidebar
        symbol={symbol}
        interval={interval}
        loading={loading}
        watchlist={watchlist}
        recentAnalyses={recentAnalyses}
        onSymbolChange={setSymbol}
        onIntervalChange={setInterval}
        onAnalyze={handleAnalyze}
        onAddToWatchlist={handleAddToWatchlist}
        onRemoveFromWatchlist={handleRemoveFromWatchlist}
        onSelectSymbol={handleSelectSymbol}
      />

      {/* Center */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Price Header */}
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

        {/* TradingView Chart */}
        <div className="flex-shrink-0" style={{ height: '320px' }}>
          <TradingViewChart symbol={symbol || DEFAULT_SYMBOL} interval={interval} />
        </div>

        {/* Tabs */}
        {data && (
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        )}

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <SkeletonDashboard />
          ) : error ? (
            <ErrorState message={error} onRetry={handleAnalyze} />
          ) : data ? (
            <TabPanel>
              {activeTab === 'overview' && <OverviewTab result={data} />}
              {activeTab === 'evidence' && <EvidenceTab result={data} />}
              {activeTab === 'indicators' && <IndicatorsTab result={data} />}
              {activeTab === 'structure' && <StructureTab result={data} />}
              {activeTab === 'volume' && <VolumeTab result={data} />}
              {activeTab === 'validation' && <ValidationTab result={data} />}
              {activeTab === 'writer' && <WriterTab result={data} />}
              {activeTab === 'benchmark' && <BenchmarkTab />}
            </TabPanel>
          ) : (
            <EmptyState onAnalyze={handleAnalyze} symbol={symbol} loading={loading} />
          )}
        </div>
      </main>

      {/* Right Panel */}
      {data && !loading && (
        <RightPanel result={data} />
      )}
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
        Select a symbol and timeframe in the sidebar, then click Analyze to run the engine.
      </p>
      <button
        onClick={onAnalyze}
        disabled={loading || !symbol.trim()}
        className="btn-primary px-6"
      >
        Analyze {symbol || '…'}
      </button>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center mb-4">
        <AlertCircle size={24} className="text-red-400" />
      </div>
      <h2 className="text-base font-semibold text-red-400 mb-2">Analysis failed</h2>
      <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-5">{message}</p>
      <button onClick={onRetry} className="btn-primary bg-red-600 hover:bg-red-500">
        Try again
      </button>
    </div>
  )
}
