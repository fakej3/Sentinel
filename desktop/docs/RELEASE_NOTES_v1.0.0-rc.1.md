# Sentinel v1.0.0-rc.1

First release candidate for Sentinel v1.0.0 — a local-first crypto analysis desktop app for Windows, macOS, and Linux.

This RC is **feature-complete** for the v1.0 scope. It is ready for broad testing before a stable release. No breaking changes are expected between RC1 and v1.0.0.

---

## Highlights

- **11-stage deterministic analysis pipeline** runs entirely on your machine — no subscription, no backend, no data leaving your device
- **Tauri v2 desktop app** with native window chrome on Windows, macOS, and Linux
- **1,531 tests** across 77 test files validate the analysis engine end-to-end
- **Optional Gemini AI narration** — adds AI-written prose after all deterministic computation completes; never calculates or decides
- **Local analysis history** stored in AppData, persistent across restarts

---

## What's Included

### Desktop App (Tauri v2)

- Native installers for Windows (`.msi`, `.exe`), macOS (`.dmg` universal binary), and Linux (`.deb`, `.rpm`, `.AppImage`)
- Window size and position persistence across restarts (`tauri-plugin-window-state`)
- Window title updates dynamically to reflect the current symbol and interval
- Gemini API key stored locally in desktop Settings (never transmitted externally)
- "Reset All Data" clears all local storage, history, and the Gemini key, then reloads to first-launch state
- App version displayed in Settings → About

### Analysis Pipeline

- **Stage 1 — Candle Fetch:** raw OHLCV data from Binance REST API (spot and USD-M futures), up to 1,000 candles per request
- **Stage 2 — Indicators:** EMA 9/21/50/200, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI — all computed from first principles
- **Stage 3 — Market Structure:** Higher Highs/Higher Lows/Lower Highs/Lower Lows, Break of Structure, Change of Character, pullback identification
- **Stage 4 — Support & Resistance:** zone detection from pivots, strength scoring, EMA and VWAP confluence
- **Stage 5 — Volume Analysis:** buy/sell pressure ratios, climax detection, VWAP deviation, Accumulation/Distribution, OBV divergence
- **Stage 6 — Trend Synthesis:** full trend label (strong/moderate/weak bullish · ranging · weak/moderate/strong bearish) from 9 conditions weighted across all modules
- **Stage 7 — Evidence Builder:** converts module output to typed evidence items with direction, impact, and source stage
- **Stage 8 — Validation:** cross-module consistency checks, data quality gates, contradictory signal detection
- **Stage 9 — Confidence Scoring:** evidence-weighted score 0–10, letter grade A–F, trust rating from data completeness
- **Stage 10 — Trade Plan:** entry zone, stop loss, three profit targets, risk/reward ratio, Trade Maturity Score (0–100), setup quality classification
- **Stage 11 — Writer:** deterministic narrative from structured data; optional Gemini enhancement for richer prose

### UI — Nine Analysis Views

Summary · Trade Plan · Evidence · Indicators · Structure · Volume · Validation · Writer · Overview

### Additional Features

- Multi-page SPA: Dashboard, Chart, Analysis, Watchlist, History, Settings
- Dashboard with confidence meter, trend badge, price and 24h stats, key metrics grid
- TradingView advanced chart widget (Chart page)
- Watchlist with per-symbol last-analysis score
- History with symbol search and clear-all
- Keyboard shortcuts: `Ctrl/Cmd+R` / `F5` to trigger analysis; `Escape` to cancel in-flight analysis
- Responsive layout: sticky sidebar on desktop, fixed bottom navigation on mobile

---

## Improvements in RC1 (from pre-release audit)

- **Evidence engine:** EMA scoring no longer inflates the bull/bear score when EMA values are null due to insufficient candles; null EMAs are now excluded from scoring rather than counted as misaligned
- **Full-trend synthesis:** The last candle no longer receives a "bounce" bearish signal when it is touching (not breaching) support; the structural bounce credit is only awarded when a candle closes above the touched level
- **StochRSI:** Fixed a scale mismatch in test helpers that caused synthetic candle data to produce out-of-range StochRSI values; test fixtures now generate candles with the correct price spread for the indicator's period
- **Trade plan invalidation:** Entry zone midpoint is used consistently for stop and target distance calculations; previous version used `entryZone.lower` for one direction and midpoint for the other, causing asymmetric R/R ratios
- **Support/resistance interactions:** Interaction type precedence is now deterministic for candles that simultaneously qualify as `breakout`, `retest`, and `touch` — the most significant type is chosen by a documented priority rule
- **Validation contradictions:** RSI divergence contradiction check now requires both RSI and OBV divergence to be confirmed before flagging; previously it fired on RSI divergence alone regardless of volume confirmation
- **Confidence scoring:** The `agreementBonus` weight was pre-wired to 1.0 in the dead-weight section but never applied; the config entry has been removed and the variable is eliminated
- **CI (deploy.yml):** Deploy job now explicitly depends on the build job (`needs: build`) so a failed website build cannot trigger a deployment with a stale artifact
- **API (routes.ts):** The `/analyze` endpoint now validates `symbol` (non-empty string ≤ 20 chars) and `interval` (valid Timeframe enum value) before running the pipeline; previously, invalid inputs reached the pipeline and produced opaque errors
- **Website:** Roadmap dates updated from stale Q3/Q4 2025 placeholders to accurate H2 2026 / 2027 milestones

---

## Known Limitations

| ID | Description |
|----|-------------|
| LIM-001 | **VWAP is cumulative, not session-based** — values differ from TradingView on longer timeframes where multiple sessions span the candle series. On shorter timeframes (1h, 4h with < 24h of data) the difference is negligible. |
| LIM-002 | **Indicator parity with TradingView unverified** — implementations follow published formulas but have not been empirically cross-checked against TradingView reference values. |
| LIM-003 | **Escape key cannot cancel the network fetch** — the Binance client uses an internal 10-second timeout; the UI shows cancelled state but the underlying HTTP request runs to completion. |
| LIM-004 | **macOS Gatekeeper warning on unsigned builds** — macOS installers require a valid Apple Developer ID certificate and notarization secrets configured in repository secrets. Without them the `.dmg` will trigger an unsigned-app warning. The Windows and Linux installers are unaffected. |

See [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) for the full list with detailed descriptions and risk assessments.

---

## Installation

Download the installer for your platform from the **[Assets](https://github.com/fakej3/Sentinel/releases/tag/v1.0.0-rc.1)** section below.

| Platform | File |
|----------|------|
| Windows | `Sentinel_1.0.0-rc.1_x64-setup.exe` or `Sentinel_1.0.0-rc.1_x64_en-US.msi` |
| macOS | `Sentinel_1.0.0-rc.1_universal.dmg` |
| Linux (Debian/Ubuntu) | `sentinel_1.0.0-rc.1_amd64.deb` |
| Linux (Fedora/RHEL) | `sentinel-1.0.0-rc.1-1.x86_64.rpm` |
| Linux (any) | `sentinel_1.0.0-rc.1_amd64.AppImage` |

**Building from source:** see [`desktop/docs/LOCAL_DEVELOPMENT.md`](https://github.com/fakej3/Sentinel/blob/main/desktop/docs/LOCAL_DEVELOPMENT.md).

---

## Reporting Issues

Please report bugs at **[GitHub Issues](https://github.com/fakej3/Sentinel/issues/new?template=bug_report.yml)**.

Include: Sentinel version, OS and version, symbol and timeframe, whether Gemini narration was enabled, and steps to reproduce.
