import { useState } from 'react'
import { Settings, Trash2, Database, Wifi, Key, Eye, EyeOff, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useApiStatus } from '../hooks/useApiStatus'
import { isTauriEnv } from '../transport'

const isDesktop = isTauriEnv()

interface SettingsPageProps {
  onClearHistory: () => void
  onClearWatchlist: () => void
  onClearAll: () => void
}

export function SettingsPage({ onClearHistory, onClearWatchlist, onClearAll }: SettingsPageProps) {
  const apiStatus = useApiStatus()

  return (
    <div className="p-4 pb-20 md:pb-4 space-y-4 animate-fade-in max-w-xl">
      <div className="flex items-center gap-2">
        <Settings size={14} className="text-slate-500" />
        <h1 className="text-sm font-semibold text-slate-300">Settings</h1>
      </div>

      {/* Engine / API Status */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={13} className="text-slate-500" />
          <p className="text-xs font-semibold text-slate-300">
            {isDesktop ? 'Analysis Engine' : 'API Connection'}
          </p>
        </div>

        {isDesktop ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Engine running locally</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className={clsx(
              'w-2 h-2 rounded-full flex-shrink-0',
              apiStatus === 'connected' ? 'bg-emerald-400'
                : apiStatus === 'offline' ? 'bg-red-400'
                : 'bg-slate-500 animate-pulse',
            )} />
            <span className={clsx(
              'text-xs font-medium',
              apiStatus === 'connected' ? 'text-emerald-400'
                : apiStatus === 'offline' ? 'text-red-400'
                : 'text-slate-500',
            )}>
              {apiStatus === 'connected' ? 'Connected'
                : apiStatus === 'offline' ? 'Offline — check your backend server'
                : 'Checking…'}
            </span>
          </div>
        )}

        <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
          {isDesktop
            ? 'The analysis pipeline runs directly in the desktop app. No backend server is required.'
            : <>
                Start the full stack with{' '}
                <code className="font-mono bg-surface-600 px-1 rounded text-slate-400">npm run dev</code>
                {' '}(API + frontend). API URL:{' '}
                <code className="font-mono bg-surface-600 px-1 rounded text-slate-400">
                  {import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}
                </code>
              </>
          }
        </p>
      </div>

      {/* Gemini API Key — desktop only */}
      {isDesktop && <GeminiKeySection />}

      {/* Data Management */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={13} className="text-slate-500" />
          <p className="text-xs font-semibold text-slate-300">Data Management</p>
        </div>
        <div className="space-y-3">

          <DataRow
            label="Clear Analysis History"
            description="Removes all recent analysis records"
            onAction={onClearHistory}
          />
          <div className="border-t border-border-subtle" />
          <DataRow
            label="Clear Watchlist"
            description="Resets to default symbols"
            onAction={onClearWatchlist}
          />
          <div className="border-t border-border-subtle" />
          <DataRow
            label="Reset All Data"
            description="Clears all local storage"
            onAction={onClearAll}
            danger
          />

        </div>
      </div>

      {/* About */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-300">About Sentinel</p>
          <span className="text-[10px] text-slate-600 font-mono">v{__APP_VERSION__}</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          AI-powered crypto analysis platform. Runs a multi-module analysis engine locally,
          providing trend analysis, technical indicators, market structure, volume analysis,
          support & resistance, confidence scoring, and trade setup generation.
        </p>
      </div>
    </div>
  )
}

function GeminiKeySection() {
  const [key, setKey]         = useState(() => localStorage.getItem('sentinel_gemini_key') ?? '')
  const [visible, setVisible] = useState(false)
  const [saved, setSaved]     = useState(false)

  function handleSave() {
    localStorage.setItem('sentinel_gemini_key', key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Key size={13} className="text-slate-500" />
        <p className="text-xs font-semibold text-slate-300">Gemini AI Key</p>
      </div>
      <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
        Optional. When set, AI-generated narrative is added to each analysis.
        Leave blank to run the engine without AI commentary.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? 'text' : 'password'}
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="AIza..."
            className={clsx(
              'w-full text-xs font-mono rounded-lg border px-3 py-2 pr-8',
              'bg-surface-600 border-border-subtle text-slate-300 placeholder-slate-600',
              'focus:outline-none focus:ring-1 focus:ring-slate-500',
            )}
          />
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
            aria-label={visible ? 'Hide key' : 'Show key'}
          >
            {visible ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
        <button
          onClick={handleSave}
          className={clsx(
            'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors flex-shrink-0',
            'focus-visible:outline-none focus-visible:ring-1',
            saved
              ? 'text-emerald-400 border-emerald-500/30 focus-visible:ring-emerald-500'
              : 'text-slate-400 border-border-subtle hover:text-slate-300 hover:border-slate-500 focus-visible:ring-slate-500',
          )}
        >
          {saved ? <Check size={11} /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function DataRow({ label, description, onAction, danger = false }: {
  label: string
  description: string
  onAction: () => void
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-xs ${danger ? 'text-red-400' : 'text-slate-400'}`}>{label}</p>
        <p className="text-[10px] text-slate-600">{description}</p>
      </div>
      <button
        onClick={onAction}
        className={clsx(
          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex-shrink-0',
          'focus-visible:outline-none focus-visible:ring-1',
          danger
            ? 'text-red-500 hover:text-red-400 border-red-500/30 hover:border-red-400/50 focus-visible:ring-red-500'
            : 'text-slate-500 hover:text-red-400 border-border-subtle hover:border-red-400/30 focus-visible:ring-red-500',
        )}
      >
        <Trash2 size={11} />
        {danger ? 'Reset' : 'Clear'}
      </button>
    </div>
  )
}
