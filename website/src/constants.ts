import type { CSSProperties } from 'react'

export const GITHUB = 'https://github.com/fakej3/Sentinel'
export const RELEASES = `${GITHUB}/releases`
export const LATEST_RELEASE = `${GITHUB}/releases/latest`
export const BLOB = `${GITHUB}/blob/main`

export const STAGES = [
  { id: 1, name: 'Candle Fetch', desc: 'OHLCV data from Binance REST API — up to 1,000 candles per request.', category: 'Data' },
  { id: 2, name: 'Indicators', desc: 'EMA 9/21/50/200, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI.', category: 'Compute' },
  { id: 3, name: 'Market Structure', desc: 'HH/HL/LH/LL, Break of Structure, Change of Character, pullback identification.', category: 'Compute' },
  { id: 4, name: 'Support & Resistance', desc: 'Zone detection from pivots, strength scoring, confluence with indicator levels.', category: 'Compute' },
  { id: 5, name: 'Volume Analysis', desc: 'Buy/sell pressure ratios, climax detection, VWAP deviation, A/D, OBV divergence.', category: 'Compute' },
  { id: 6, name: 'Trend Synthesis', desc: 'Full trend label from 9 bull/bear/neutral conditions weighted across all modules.', category: 'Synthesis' },
  { id: 7, name: 'Evidence Builder', desc: 'Converts module output into typed evidence items: direction, impact, source stage.', category: 'Synthesis' },
  { id: 8, name: 'Validation', desc: 'Cross-module consistency checks, data quality gates, contradictory signal detection.', category: 'Validation' },
  { id: 9, name: 'Confidence Scoring', desc: 'Evidence-weighted score 0–10, letter grade A–F, trust rating from data completeness.', category: 'Scoring' },
  { id: 10, name: 'Trade Plan', desc: 'Entry zone, stop loss, three targets, risk/reward ratio, maturity and quality scores.', category: 'Output' },
  { id: 11, name: 'Writer', desc: 'Deterministic narrative from structured data. Optional Gemini AI for richer prose.', category: 'Output' },
] as const

export const CATEGORY_COLOR: Record<string, string> = {
  Data: '#7a8ba8',
  Compute: '#2f7bff',
  Synthesis: '#a78bfa',
  Validation: '#f0a830',
  Scoring: '#22c55e',
  Output: '#e8edf5',
}

export const FEATURES = [
  { tag: 'Architecture', title: 'No server. No account.', body: 'The entire 11-stage pipeline runs in-process inside the desktop app. Nothing to deploy, no subscription, no data leaving your machine.' },
  { tag: 'Privacy', title: 'Offline-first by design', body: 'Candle data is fetched from Binance when connected — then everything else is local. Analysis results, history, and settings never leave your device.' },
  { tag: 'Indicators', title: '10+ built-in indicators', body: 'EMA 9/21/50/200, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI — all computed from first principles against raw candle data.' },
  { tag: 'Market Structure', title: 'Structural pattern detection', body: 'Higher highs, higher lows, lower highs, lower lows, Break of Structure, Change of Character, pullbacks, consolidation ranges — all rule-based.' },
  { tag: 'Confidence', title: 'Evidence-weighted scoring', body: 'Each module produces typed evidence items. The confidence engine aggregates them, detects contradictions, and outputs a score from 0–10 with a letter grade.' },
  { tag: 'Volume', title: 'Volume pressure analysis', body: 'Buy/sell volume ratios, volume climax detection, VWAP deviation, Accumulation/Distribution, OBV divergence from price — all computed, not approximated.' },
  { tag: 'S/R Zones', title: 'Dynamic support & resistance', body: 'Zone detection from pivot points and price reactions, strength scoring, and confluence mapping with EMA and VWAP levels.' },
  { tag: 'Trade Planning', title: 'Structured trade plans', body: 'Entry zone, stop loss, three profit targets, risk/reward ratio, maturity score, setup quality — every number derived from the pipeline, never invented.' },
  { tag: 'Timeframes', title: 'Full timeframe coverage', body: 'Any symbol across 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M candles from Binance spot and USD-M futures.' },
  { tag: 'History', title: 'Local analysis history', body: 'Every saved analysis is stored in local AppData. Review past setups, compare confidence across timeframes, and track how your edge evolves.' },
  { tag: 'AI Layer', title: 'Optional AI narration', body: 'After the deterministic pipeline completes, Gemini can write richer prose. The AI only writes — it never calculates, decides, or invents a number.' },
  { tag: 'Open Source', title: 'MIT licensed — fully open', body: 'Audit every line of analysis logic. Fork it, self-host it, extend it. The entire pipeline is open to inspection and contribution.' },
] as const

export const ROADMAP = [
  { phase: 'Now', title: 'Desktop v1', items: ['11-stage analysis pipeline', 'Binance spot + futures', 'Local history & persistence', 'Gemini AI narration', 'Windows / macOS / Linux'], status: 'current' },
  { phase: 'Now', title: 'Website', items: ['Public marketing site', 'Documentation portal', 'Download distribution', 'GitHub Pages hosting'], status: 'current' },
  { phase: 'H2 2026', title: 'Mobile', items: ['iOS (SwiftUI)', 'Android (Kotlin)', 'Offline-first same pipeline', 'Optional desktop sync'], status: 'planned' },
  { phase: '2027', title: 'Backend', items: ['Self-hostable server', 'Team analysis sharing', 'Webhook alerts', 'REST API'], status: 'planned' },
  { phase: '2027+', title: 'API & Integrations', items: ['Developer REST API', 'TradingView bridge', 'Bybit + Coinbase', 'Custom indicator plugins'], status: 'future' },
  { phase: 'Future', title: 'More Exchanges', items: ['Bybit', 'Coinbase Advanced', 'OKX', 'Kraken', 'Hyperliquid'], status: 'future' },
] as const

export const ROADMAP_STATUS_STYLE: Record<string, CSSProperties> = {
  current: { color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' },
  active:  { color: '#2f7bff', background: 'rgba(47,123,255,0.1)', border: '1px solid rgba(47,123,255,0.2)' },
  planned: { color: '#f0a830', background: 'rgba(240,168,48,0.08)', border: '1px solid rgba(240,168,48,0.2)' },
  future:  { color: 'var(--text-dim)', background: 'var(--surface-high)', border: '1px solid var(--border)' },
}

export const ROADMAP_STATUS_LABEL: Record<string, string> = {
  current: 'Current',
  active:  'In Progress',
  planned: 'Planned',
  future:  'Future',
}

export const FAQ = [
  { q: 'Why desktop-first and not a web app?', a: "A desktop app runs entirely on your machine — no server sees your analysis, API keys, or trading activity. The Tauri architecture gives us native performance, a local database, and the ability to work offline. A web app would require a backend, which would mean storing your data on someone else's server." },
  { q: 'Does Sentinel use AI to make trading decisions?', a: "No. The 11-stage pipeline is entirely deterministic. Indicators use published formulas. Market structure follows documented rules. Confidence is computed from evidence items using fixed weights. The optional Gemini integration is a writer — it receives the finished result and formats it into prose. It never drives the analysis." },
  { q: 'Does anything leave my machine?', a: "Two things: Binance API calls to fetch candle data, and Gemini API calls if you enable AI narration. Your analysis results, history, settings, and any API keys you configure are stored locally in AppData. Nothing is sent to Sentinel servers — there are no Sentinel servers." },
  { q: 'Which exchanges does Sentinel support?', a: "Currently Binance — both spot and USD-M futures pairs. Bybit, Coinbase Advanced, OKX, and Kraken support are on the roadmap. The architecture is exchange-agnostic; adding a new exchange means implementing a single fetch adapter." },
  { q: 'Why do I need a Gemini API key for AI narration?', a: "The Gemini key is stored locally and used to call Google's API directly from your machine. Sentinel never sees or proxies your key. If you don't add a key, the deterministic writer produces a complete analysis report without AI enhancement." },
  { q: 'Is Sentinel free? Will it always be free?', a: "Yes, and yes. Sentinel is MIT licensed. The core analysis engine will always be open source and free. Future premium features like backend sync or team sharing may be optional paid additions, but the desktop app itself stays free." },
  { q: 'How do I build from source?', a: "Clone the repo, install Rust and Node 20, then run `npm install && npm run tauri:dev` from the `desktop/` directory. See CONTRIBUTING.md for the full setup guide. Building from source gives you a fully auditable, locally compiled binary." },
  { q: 'How is confidence calculated?', a: "Each analysis module produces typed evidence items with a direction (bull/bear/neutral) and impact level (strong/moderate/weak). The confidence engine sums bull vs bear evidence, weights by impact, checks for contradictions, and applies a data completeness penalty. Score is 0–10. Grade: A (≥8.5), B (≥7.0), C (≥5.0), D (≥3.0), F (<3.0)." },
] as const

export const DOCS_LINKS = [
  { title: 'Architecture', desc: 'Pipeline design, module contracts, data flow diagram', path: 'desktop/docs/ARCHITECTURE.md' },
  { title: 'Roadmap', desc: 'Planned features, phases, and delivery timeline', path: 'desktop/docs/ROADMAP.md' },
  { title: 'Versioning', desc: 'Release process, tagging convention, and signing setup', path: 'desktop/docs/VERSIONING.md' },
  { title: 'Changelog', desc: 'What changed in each release, version by version', path: 'desktop/docs/CHANGELOG.md' },
  { title: 'Contributing', desc: 'Development setup, code style guide, PR process', path: 'CONTRIBUTING.md' },
] as const
