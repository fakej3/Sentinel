import { Radar } from 'lucide-react'

export function ScannerPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-800 border border-border-subtle flex items-center justify-center">
        <Radar size={24} className="text-slate-600" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold text-slate-300">Multi-Symbol Scanner</h2>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          Scan multiple symbols simultaneously for high-confidence setups.
          Coming in a future release.
        </p>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-800 border border-border-subtle">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
        <span className="text-[11px] text-slate-500">Coming soon</span>
      </div>
    </div>
  )
}
