# Changelog

All notable user-facing changes to Sentinel are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> For the full implementation history (module-by-module development logs),
> see [archive/IMPLEMENTATION_LOG.md](archive/IMPLEMENTATION_LOG.md).

---

## [1.0.0-rc.1] — 2026-07-14

### Added
- Tauri v2 desktop application packaging (.deb and .rpm on Linux; .dmg on macOS; .msi on Windows)
- Window state persistence — size and position survive restarts (`tauri-plugin-window-state`)
- Gemini API key management in desktop Settings (stored locally via localStorage)
- Analysis history stored in `$APPDATA/sentinel/history.json` (desktop) or `data/history.json` (web server)
- **Reset All Data** now clears every Sentinel setting, the Gemini key, and all saved history, then reloads to first-launch state
- App version number displayed in Settings → About (`v1.0.0-rc.1`)

### Changed
- Desktop transport runs the full analysis pipeline directly in the Tauri webview — no backend server required for desktop builds
- Settings page shows "Analysis Engine — running locally" (always green) instead of API connection status when in desktop mode
- Window title updates dynamically to reflect the current symbol and interval

### Removed
- Confidence debug panel ("Benchmark" tab) removed from the analysis view — it was an internal investigation artifact, not production output

---

## [0.19.0] — 2026-07-02

### Added
- Multi-page SPA architecture: Dashboard, Chart, Analysis, Watchlist, History, Settings
- Persistent navigation sidebar on desktop; fixed bottom navigation bar on mobile
- Dashboard page with AI-first hero section (confidence meter, trend badge, price, 24h stats, key metrics grid)
- Chart page — TradingView advanced chart fills the full remaining viewport
- Watchlist page with per-symbol quick-analyze and last-analysis scores
- History page with symbol search and clear-all
- Settings page with API/engine status, data management, and about section
- Keyboard shortcuts: `Ctrl/Cmd+R` and `F5` trigger analysis; `Escape` cancels an in-flight analysis

---

## [0.18.0] — 2026-07-02

### Changed
- Full UI/UX redesign: natural page-scroll layout replacing the fixed-viewport split-panel design
- Sticky header and desktop sidebar; mobile bottom drawer navigation
- PriceHeader activated as the primary data display whenever analysis results are available
- TradingView chart moved to its own dedicated Chart page

---

## [0.17.0] — 2026-07-02

### Added
- Compact market summary bar (56 px) with live price and 24h change stats
- Watchlist grade scores — confidence grade visible at a glance per symbol
- Hover elevation micro-interactions on analysis cards

---

## [0.16.0] — 2026-07-01

### Added
- Collapsible sidebar with smooth CSS width transition (state persisted to localStorage)
- Resizable chart panel via drag handle (height persisted to localStorage)
- Full keyboard accessibility throughout the dashboard
- `prefers-reduced-motion` support — all animations disabled when the OS requests it

---

## [0.15.0] — 2026-07-01

### Added
- `SentinelApiError` with typed error kinds: `network`, `timeout`, `http`, `parse`, `abort`
- Friendly, user-readable error messages for all failure modes
- AbortController cancellation — pressing `Escape` or starting a new analysis cancels in-flight requests
- Live API health indicator dot in the header (green / red / pulsing)

---

## [0.14.0] — 2026-06-30

### Added
- React dashboard with 9 analysis tabs: Summary, Trade, Evidence, Overview, Indicators, Structure, Volume, Validation, Writer
- TradingView advanced chart widget integration
- Shared component library: Badge, Card, ConfidenceMeter, ProgressBar, Tabs

---

## [0.13.0] — 2026-06-30

### Added
- CLI: `npx tsx src/cli/index.ts analyze BTCUSDT 1h`
- Six output formats: `pretty` (default), `json`, `summary`, `bullet`, `headline`, `social`
- `--output FILE` — write results to a file instead of stdout
- `--template TEMPLATE` — select the writer format
- `--no-color` — plain text output for scripting

---

## [0.12.0] — 2026-06-30

### Added
- Express REST API with three endpoints: `GET /health`, `GET /version`, `POST /analyze`
- `X-Response-Time` header on all responses
- Structured error responses: `{ error: { code, message, module? } }`

---

## [0.11.0] — 2026-06-29

### Added
- Historical Replay & Benchmark Engine: walk-forward backtesting over a candle history
- `runBenchmark()` — field-by-field regression testing against JSON fixture files
- Markdown and HTML validation reports
- `test-fixtures/` — sample dataset and expected output for writing fixture tests

---

## [0.10.0] — 2026-06-29

### Added
- `analyzeMarket()` — single public entry point orchestrating the complete analysis pipeline
- Per-stage wall-clock timings in `PipelineResult.metadata.timings`
- Trade decision, trade plan, market context, and Trade Maturity Score
- `PipelineError` with typed error codes for each pipeline stage

---

## [0.1.0 – 0.9.0] — 2026-06-28 to 2026-06-29

Initial construction of the analysis engine:

- **Binance Data Engine** — candles, ticker, funding rate, open interest
- **Technical Indicator Engine** — EMA×4, SMA×3, RSI, MACD, ATR, ADX, VWAP, Bollinger Bands, StochRSI, OBV, MFI, CCI, Volume MA
- **Market Structure Engine** — swing detection, HH/HL/LH/LL labels, BOS, CHoCH, consolidation, breakout, pullback
- **Support & Resistance Engine** — ATR-sized price zones, greedy merge, interaction detection, zone state machine, strength scoring
- **Volume Analysis Engine** — relative volume, buy/sell pressure, climax detection, accumulation/distribution, OBV, VWAP analysis
- **Analysis Engine** — full trend synthesis, EMA/indicator/S&R/volume context, evidence collection
- **Validation Engine** — completeness, consistency, contradiction, and structural checks
- **Confidence Engine** — evidence-weighted scoring (0–10) with grades A through E
- **AI Writing Engine** — deterministic report generation in 6 formats; optional LLM enhancement via Gemini
