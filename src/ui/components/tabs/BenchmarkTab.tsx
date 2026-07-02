import { FlaskConical, Clock, Database } from 'lucide-react'

export function BenchmarkTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-in">
      <div className="w-16 h-16 rounded-2xl bg-surface-700 border border-border-subtle flex items-center justify-center mb-5">
        <FlaskConical size={28} className="text-slate-500" />
      </div>

      <h3 className="text-base font-semibold text-slate-200 mb-2">Benchmark Engine</h3>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
        Historical replay benchmarking is reserved for Module 11 datasets.
        This tab will display comparative accuracy reports once reference datasets are available.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <div className="card p-3 flex items-start gap-3 text-left opacity-50">
          <Database size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-slate-300">Historical Datasets</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Stored in <code className="text-blue-400 bg-surface-600 px-1 rounded text-[10px]">test-fixtures/</code>
            </p>
          </div>
        </div>
        <div className="card p-3 flex items-start gap-3 text-left opacity-50">
          <Clock size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-slate-300">Replay Comparison</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Run engine against known data and compare to expected outputs
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-600 mt-8">
        See <code className="text-slate-500">KNOWN_LIMITATIONS.md</code> for the benchmark roadmap.
      </p>
    </div>
  )
}
