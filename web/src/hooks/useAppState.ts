import { useCallback, useState, useRef } from 'react'
import { useAnalyze } from './useAnalyze'
import { useLocalStorage } from '@ui/hooks/useLocalStorage'
import { resolveSymbol } from '@ui/utils/symbolSearch'
import { getTransport } from '../transport'
import { STORAGE_KEYS } from '@ui/constants/storageKeys'
import type { AppPage, RecentAnalysis } from '@ui/types'
import type { HistoryMeta, HistoryEntry } from '../transport'

const DEFAULT_SYMBOL   = 'BTCUSDT'
const DEFAULT_INTERVAL = '1h'
const MAX_RECENT       = 10

export function useAppState() {
  const [symbol,           setSymbol          ] = useLocalStorage(STORAGE_KEYS.symbol,           DEFAULT_SYMBOL)
  const [interval,         setInterval        ] = useLocalStorage(STORAGE_KEYS.interval,         DEFAULT_INTERVAL)
  const [page,             setPage            ] = useLocalStorage<AppPage>(STORAGE_KEYS.page,    'dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage(STORAGE_KEYS.sidebarCollapsed, false)
  const [watchlist,        setWatchlist       ] = useLocalStorage<string[]>(STORAGE_KEYS.watchlist, [])
  const [recentAnalyses,   setRecentAnalyses  ] = useLocalStorage<RecentAnalysis[]>(STORAGE_KEYS.recent, [])

  const [savedEntry,  setSavedEntry ] = useState<HistoryMeta | null>(null)
  const [saving,      setSaving     ] = useState(false)
  const savingRef = useRef(false)

  const { data, loading, stage, error, analyze, cancel, loadData } = useAnalyze()

  const handleAnalyze = useCallback(async (symOverride?: string) => {
    const sym = resolveSymbol(symOverride ?? symbol)
    if (!sym) return
    if (sym !== symbol.trim().toUpperCase()) setSymbol(sym)
    setSavedEntry(null)
    const result = await analyze({ symbol: sym, interval })
    if (result) {
      setRecentAnalyses(prev => {
        const entry: RecentAnalysis = {
          symbol:    sym,
          interval,
          timestamp: Date.now(),
          grade:     result.confidence.grade,
          score:     result.confidence.score,
          decision:  result.decision?.label,
          bias:      result.analysis.fullTrend.trend,
        }
        const filtered = prev.filter(r => !(r.symbol === sym && r.interval === interval))
        return [entry, ...filtered].slice(0, MAX_RECENT)
      })
    }
  }, [symbol, interval, analyze, setRecentAnalyses, setSymbol])

  const handleSaveAnalysis = useCallback(async () => {
    if (!data || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const meta = await getTransport().saveHistory(data, symbol, interval)
    savingRef.current = false
    setSaving(false)
    if (meta) setSavedEntry(meta)
  }, [data, symbol, interval])

  const handleSelectSymbol = useCallback((sym: string, iv?: string) => {
    setSymbol(sym)
    if (iv) setInterval(iv)
    setSavedEntry(null)
  }, [setSymbol, setInterval])

  const handleToggleSidebar       = useCallback(() => setSidebarCollapsed(c => !c), [setSidebarCollapsed])
  const handleAddToWatchlist      = useCallback((sym: string) => setWatchlist(p => p.includes(sym) ? p : [...p, sym]), [setWatchlist])
  const handleRemoveFromWatchlist = useCallback((sym: string) => setWatchlist(p => p.filter(s => s !== sym)), [setWatchlist])

  const handleLoadEntry = useCallback((entry: HistoryEntry) => {
    const { result, ...meta } = entry
    setSymbol(meta.symbol)
    setInterval(meta.interval)
    setSavedEntry(meta)
    loadData(result)
  }, [setSymbol, setInterval, loadData])

  const handleClearHistory   = useCallback(() => setRecentAnalyses([]), [setRecentAnalyses])
  const handleClearWatchlist = useCallback(() => setWatchlist([]), [setWatchlist])

  const handleClearAll = useCallback(async () => {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('sentinel_')) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
    setRecentAnalyses([])
    setWatchlist([])
    await getTransport().clearAllHistory()
    window.location.reload()
  }, [setRecentAnalyses, setWatchlist])

  return {
    symbol, setSymbol,
    interval, setInterval,
    page, setPage,
    sidebarCollapsed, setSidebarCollapsed,
    watchlist,
    recentAnalyses,
    savedEntry,
    saving,
    data, loading, stage, error, cancel,
    loadData,
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
  }
}
