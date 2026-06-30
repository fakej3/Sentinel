# Sentinel — Versioning Strategy

This document defines the version numbering scheme, release process, branching
strategy, and stability expectations for the project.

All version numbers follow **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`).

---

## Semantic Versioning Rules

### PATCH — `x.y.Z`

Increment PATCH for:

- Bug fixes that do not change the public API or algorithm contracts.
- Documentation corrections.
- Test additions or corrections.
- Performance improvements with no observable output change.
- Internal refactors that produce identical outputs (verified by test suite).

A PATCH release must not change any value returned by a public function when
given the same inputs. If a bug fix *does* change output values (e.g., fixing a
wrong formula), it is a MINOR release, not a PATCH.

**Examples:**
- `0.4.0 → 0.4.1`: Fix a typo in an evidence string.
- `0.5.0 → 0.5.1`: Add a missing boundary test.
- `1.0.0 → 1.0.1`: Fix a divide-by-zero guard that previously returned `NaN`.

---

### MINOR — `x.Y.0`

Increment MINOR for:

- A new complete module added to the pipeline.
- A new public function or exported type added to an existing module.
- A bug fix that changes output values (correcting a wrong calculation).
- A new configuration parameter added with a backward-compatible default.
- A meaningful documentation addition (new sections, new decision records).

A MINOR release must not remove or rename any existing public API without a
deprecation path documented in `CHANGELOG.md`.

**Examples:**
- `0.4.0 → 0.5.0`: Foundation Stabilization — confidence scale fixed to 0–10, volume MA bug fixed.
- `0.5.0 → 0.6.0`: Module 4 (Support & Resistance Engine) complete.
- `1.0.0 → 1.1.0`: Add multi-timeframe confluence detection.

---

### MAJOR — `X.0.0`

Increment MAJOR for:

- A breaking change to any public API (renamed function, removed export, changed parameter types).
- A change to the canonical output format that requires callers to be updated.
- A platform pivot that fundamentally changes how the system works.

During `0.x.x` development, MAJOR is locked at `0`. Breaking changes between
analysis modules are permitted because the API consumers (Modules 6–9) have not
yet been built. Once `1.0.0` is released, breaking changes require a new MAJOR.

---

## Development Milestones

The following roadmap shows the intended version series. Exact scope may be
adjusted as implementation reveals complexity.

### `0.x.x` — Internal Development

No API stability guarantees. Breaking changes between minor versions are allowed.
The goal is to build and validate all deterministic analysis modules.

| Version | Milestone |
|---------|-----------|
| `0.1.0` | Project documentation suite (ARCHITECTURE, ENGINE_RULES, VALIDATION_RULES, etc.) |
| `0.2.0` | Module 1 — Binance Data Engine complete (34 tests) |
| `0.3.0` | Module 2 — Technical Indicator Engine complete (97 tests) |
| `0.4.0` | Module 3 — Market Structure Engine complete (88 tests) |
| `0.5.0` | Foundation Stabilization — post-audit critical/high fixes (227 tests) |
| `0.6.0` | Module 4 — Support & Resistance Engine |
| `0.7.0` | Module 5 — Volume Analysis Engine |
| `0.8.0` | Module 6 — Evidence Engine |
| `0.9.0` | Module 7 — Validation Engine |
| `0.10.0` | Module 8 — Confidence Engine (full cross-module 0–10 scoring) |

### `1.0.0` — Complete Deterministic Analysis Engine

**Release criteria:**

- Modules 1–8 complete, tested, and passing the full Quality Gate.
- Full JSON analysis payload produced end-to-end for any Binance symbol.
- No Critical or High issues open in `KNOWN_LIMITATIONS.md`.
- `tsc --noEmit` clean.
- Full test suite passing with ≥ 400 tests.
- All public APIs documented and stable.

The `1.0.0` release represents the complete non-AI analysis engine. No content
generation is required for this milestone — only the deterministic JSON output.

### `1.5.0` — AI Writing Engine

- Module 9 (AI Writing Engine) and Module 10 (Content Generator) integrated.
- End-to-end: Binance API → analysis JSON → validated prose.
- Multiple writing styles supported (Professional, Beginner, Institutional, Quick Summary).

### `2.0.0` — Multi-Exchange Support

- Exchange abstraction layer replacing the Binance-specific Module 1.
- Additional supported exchanges (e.g. Bybit, OKX).
- Breaking change: `fetchMarketData` API updated for exchange parameterisation.

### `3.0.0` — Institutional-Grade Platform

- Real-time streaming data.
- Multi-timeframe confluence engine.
- Order book analysis.
- On-chain metrics integration.
- Historical replay validation suite.
- Performance tracking with 24h/3d/7d accuracy reports.

---

## Branching Strategy

### Main Branch

`main` is always production-ready. It contains only released, fully-tested code.
Direct commits to `main` are not permitted. All changes arrive via pull requests.

### Feature Branches

Naming convention: `<prefix>/<short-description>`

| Prefix | Use |
|--------|-----|
| `feat/` | New module or significant new capability |
| `fix/` | Bug fix |
| `docs/` | Documentation-only changes |
| `refactor/` | Internal restructure with no output change |
| `test/` | Test additions or corrections only |

Example: `feat/module-4-support-resistance`, `fix/ema-seed-precision`.

### Claude Code Agent Branches

Branches created by Claude Code sessions follow the pattern:
`claude/<description>-<short-id>` (e.g. `claude/crypto-analysis-platform-smo2hl`).
These are treated as feature branches and follow the same merge rules.

---

## Release Process

1. **Verify the test suite:** `npm test` must exit with zero failures.
2. **Verify types:** `tsc --noEmit` must exit with zero errors.
3. **Check the Quality Gate:** Walk through `QUALITY_GATE.md` for the completed module.
4. **Update `CHANGELOG.md`:** Add a new version entry (`## [X.Y.Z] — YYYY-MM-DD`).
5. **Update `ROADMAP.md`:** Mark completed items; update progress percentage.
6. **Update `KNOWN_LIMITATIONS.md`:** Record any deferred items accepted in this release.
7. **Commit** with a message following the format: `feat|fix|docs|refactor(<scope>): <description>`.
8. **Open a pull request** to `main`. The PR must link to the CHANGELOG entry.
9. **Merge** after review.
10. **Tag** the merge commit: `git tag vX.Y.Z`.

---

## Stability Expectations by Version Series

| Series | API Stability | Breaking Changes | Recommended Use |
|--------|--------------|------------------|-----------------|
| `0.x.x` | None | Permitted between minors | Internal development only |
| `1.0.x` | Stable | PATCH: none; MINOR: additive only | Integration by content pipeline |
| `1.x.0` | Stable, additive | MINOR: new fields/functions allowed | Production deployment |
| `2.0.0+` | Full semver | MAJOR only | Multi-exchange production use |

---

*Last updated: Milestone 0.4 — Engineering Standards*
