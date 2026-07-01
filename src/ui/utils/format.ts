export function formatPrice(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return '—'
  const d = decimals ?? (value >= 1000 ? 2 : value >= 1 ? 4 : 6)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export function formatPercent(value: number, showSign = true): string {
  if (!Number.isFinite(value)) return '—'
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toFixed(2)
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatGrade(grade: string): string {
  return grade.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatInterval(interval: string): string {
  const map: Record<string, string> = {
    '1m': '1 min', '3m': '3 min', '5m': '5 min', '15m': '15 min',
    '30m': '30 min', '1h': '1H', '2h': '2H', '4h': '4H',
    '6h': '6H', '8h': '8H', '12h': '12H', '1d': '1D', '3d': '3D',
    '1w': '1W', '1M': '1M',
  }
  return map[interval] ?? interval
}

export function clampTo01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export function pctOf10(score: number): number {
  return clampTo01(score / 10) * 100
}
