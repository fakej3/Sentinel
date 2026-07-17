# Roadmap

Sentinel is feature-complete for its initial RC1 scope. The engine, API, CLI, and desktop app are all shipped. This document describes what's next.

---

## Current Status: RC1 (Release Candidate 1)

| Layer | Status |
|-------|--------|
| Analysis engine (10 modules) | ✅ Complete |
| REST API | ✅ Complete |
| CLI | ✅ Complete |
| React web dashboard | ✅ Complete |
| Tauri v2 desktop app | ✅ RC1 |
| Historical validation engine | ✅ Complete |

---

## Near-term (v1.x)

### Cloud History Sync
Allow analysis history to sync across devices for desktop users via an optional backend. Currently history is stored locally in `$APPDATA/sentinel/history.json`.

### Performance Tracker
Evaluate past trade setups by checking whether the predicted direction played out at 24h, 3d, and 7d after analysis. Requires the History Database to be filled over time.

### TradingView Indicator Parity
Verify all indicator calculations (EMA, RSI, ATR, MACD, Bollinger Bands, etc.) against TradingView reference values for the same candle series. Document any known divergences.

### Multi-Coin Comparison
Analyze multiple symbols simultaneously and rank them by confidence score and setup quality.

### Desktop Notifications
Alert the user when a watchlist symbol meets a configurable confidence threshold.

---

## Medium-term (v2.x)

### Additional Technical Concepts
- Order block detection
- Fair value gap (FVG) detection
- Fibonacci retracement zones
- Liquidity sweep detection

### Multi-Timeframe Confluence
Detect alignment between timeframes (e.g., 1h and 4h both showing bullish structure) and incorporate into the confidence score.

### Configurable Confidence Weights
Let users adjust the weight given to each evidence factor in the confidence scoring system, with a reset-to-defaults option.

### macOS / Windows Installers
Currently producing Linux packages (.deb, .rpm). macOS (.dmg) and Windows (.msi) require platform-specific build runners.

---

## Known Limitations

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for the full list of intentional tradeoffs and accepted technical debt.

Key limitations for the current release:

- **VWAP is cumulative, not session-based** — values differ from TradingView on longer timeframes (LIM-001)
- **Indicator parity with TradingView unverified** — implementations follow published formulas but have not been empirically cross-checked (LIM-002)
- **Escape key cannot cancel the network fetch** — the Binance client uses an internal 10s timeout; the UI shows cancelled state but the underlying fetch runs to completion (desktop limitation)
- **Icons not visually verified** — the `icon.png` has 96.9% transparent pixels; visual confirmation is needed on each target platform before shipping

---

## Not Planned

These are explicitly out of scope for Sentinel:

- **Order execution / trading bot** — Sentinel is an analysis tool, not a trading system
- **Price predictions or forecasts** — every output is a deterministic interpretation of current data, never a forward price claim
- **Machine learning models** — the engine uses rule-based analysis only; ML adds non-determinism that cannot be audited against ENGINE_RULES.md
