import { lazy, Suspense } from 'react'
import { Activity, Save, Check } from 'lucide-react'
import { Tabs, TabPanel } from '../components/shared/Tabs'
import { SkeletonDashboard } from '../components/shared/Skeleton'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { AppTab, PipelineResult, HistoryMeta } from '../types'
import type { TabDef } from '../components/shared/Tabs'

const SummaryTab    = lazy(() => import('../components/tabs/SummaryTab').then(m => ({ default: m.SummaryTab })))
const TradeTab      = lazy(() => import('../components/tabs/TradeTab').then(m => ({ default: m.TradeTab })))
const OverviewTab   = lazy(() => import('../components/tabs/OverviewTab').then(m => ({ default: m.OverviewTab })))
const EvidenceTab   = lazy(() => import('../components/tabs/EvidenceTab').then(m => ({ default: m.EvidenceTab })))
const IndicatorsTab = lazy(() => import('../components/tabs/IndicatorsTab').then(m => ({ default: m.IndicatorsTab })))
const StructureTab  = lazy(() => import('../components/tabs/StructureTab').then(m => ({ default: m.StructureTab })))
const VolumeTab     = lazy(() => import('../components/tabs/VolumeTab').then(m => ({ default: m.VolumeTab })))
const ValidationTab = lazy(() => import('../components/tabs/ValidationTab').then(m => ({ default: m.ValidationTab })))
const WriterTab     = lazy(() => import('../components/tabs/WriterTab').then(m => ({ default: m.WriterTab })))
const BenchmarkTab  = lazy(() => import('../components/tabs/BenchmarkTab').then(m => ({ default: m.BenchmarkTab })))

interface AnalysisPageProps {
  data: PipelineResult | null
  loading: boolean
  stage: string | null
  savedEntry: HistoryMeta | null
  saving: boolean
  onAnalyze: () => void
  onSave: () => void
  symbol: string
}

export function AnalysisPage({ data, loading, onAnalyze, onSave, symbol, savedEntry, saving }: AnalysisPageProps) {
  const [activeTab, setActiveTab] = useLocalStorage<AppTab>('sentinel_analysis_tab', 'summary')

  if (loading) return <SkeletonDashboard />

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8 py-16 animate-fade-in">
        <div className="mb-4 w-14 h-14 rounded-2xl bg-surface-700 flex items-center justify-center">
          <Activity size={24} className="text-slate-500" />
        </div>
        <h2 className="text-sm font-semibold text-slate-400 mb-1.5">No analysis yet</h2>
        <p className="text-xs text-slate-600 max-w-xs leading-relaxed mb-5">
          Run an analysis first to see the full AI report here.
        </p>
        <button
          onClick={onAnalyze}
          disabled={!symbol.trim()}
          className="h-8 px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg
                     transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Analyze {symbol || '…'}
        </button>
      </div>
    )
  }

  const evidenceCount = data.analysis.evidence.length
  const issueCount    = data.validation.issues.length

  const tabs: TabDef[] = [
    { id: 'summary',    label: 'Summary' },
    { id: 'trade',      label: 'Trade' },
    { id: 'evidence',   label: 'Evidence',   count: evidenceCount },
    { id: 'overview',   label: 'Overview' },
    { id: 'indicators', label: 'Indicators' },
    { id: 'structure',  label: 'Structure' },
    { id: 'volume',     label: 'Volume' },
    { id: 'validation', label: 'Validation', count: issueCount },
    { id: 'writer',     label: 'Writer' },
    { id: 'benchmark',  label: 'Benchmark' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Save action bar */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-border-subtle bg-surface-900/50">
        <button
          onClick={onSave}
          disabled={saving || !!savedEntry}
          className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium rounded-md border transition-colors
                     disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500
                     text-slate-400 hover:text-slate-200 border-border-subtle hover:border-slate-500 disabled:opacity-50"
        >
          {saving ? (
            <>
              <span aria-hidden="true" className="w-3 h-3 border border-slate-500 border-t-slate-300 rounded-full animate-spin" />
              Saving…
            </>
          ) : savedEntry ? (
            <>
              <Check size={11} className="text-emerald-400" />
              <span className="text-emerald-400">Saved</span>
            </>
          ) : (
            <>
              <Save size={11} />
              Save analysis
            </>
          )}
        </button>
      </div>
      <Tabs tabs={tabs} active={activeTab} onChange={tab => setActiveTab(tab as AppTab)} />
      <Suspense fallback={<SkeletonDashboard />}>
        <TabPanel>
          {activeTab === 'summary'    && <SummaryTab    result={data} />}
          {activeTab === 'trade'      && <TradeTab      result={data} />}
          {activeTab === 'overview'   && <OverviewTab   result={data} />}
          {activeTab === 'evidence'   && <EvidenceTab   result={data} />}
          {activeTab === 'indicators' && <IndicatorsTab result={data} />}
          {activeTab === 'structure'  && <StructureTab  result={data} />}
          {activeTab === 'volume'     && <VolumeTab     result={data} />}
          {activeTab === 'validation' && <ValidationTab result={data} />}
          {activeTab === 'writer'     && <WriterTab     result={data} />}
          {activeTab === 'benchmark'  && <BenchmarkTab result={data} />}
        </TabPanel>
      </Suspense>
    </div>
  )
}
