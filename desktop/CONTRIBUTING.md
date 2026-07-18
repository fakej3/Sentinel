# Contributing to Sentinel

Thank you for your interest in contributing. This document explains how the project is structured, what the rules are, and how to get a change accepted.

---

## Ground Rules

1. **Do not change trading logic without a matching test.** Every change to `src/modules/` must come with a test that fails before the change and passes after.
2. **Do not break determinism.** Given identical inputs, the engine must return identical outputs. No randomness, no time-dependent defaults, no side effects in analysis functions.
3. **Do not change the public pipeline interface** (`analyzeMarket()` in `src/modules/pipeline/index.ts`) without a major version bump.
4. **Every constant must have a rule.** Thresholds and weights in `config.ts` files must be documented in `docs/ENGINE_RULES.md`. If you add a new constant, add the rule first.
5. **No AI in the analysis path.** The Gemini integration is optional and only runs in the `writer` module after all deterministic analysis is complete. Analysis modules must not make AI calls.

---

## Development Setup

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for setup instructions.

```bash
npm install
npm run dev        # starts both API server and Vite frontend
npm test           # run all tests + typecheck
```

---

## Project Structure

```
src/
├── modules/           # Analysis engine — do not change logic without a test
│   ├── binance/       # Stage 1: Candle fetch
│   ├── indicators/    # Stage 2: Technical indicators
│   ├── market-structure/  # Stage 3: Market structure (HH/HL/LH/LL, BOS, CHoCH)
│   ├── support-resistance/ # Stage 4: Support & resistance zones
│   ├── volume-analysis/   # Stage 5: Volume analysis
│   ├── analysis/      # Stages 6–7: Trend synthesis and evidence builder
│   ├── validation/    # Stage 8: Cross-module validation
│   ├── confidence/    # Stage 9: Evidence-weighted confidence scoring
│   ├── pipeline/      # Stage 10: Trade plan and pipeline orchestration
│   ├── writer/        # Stage 11: Report generation
│   ├── ai/            # Optional: Gemini AI narration (runs after stage 11)
│   ├── historical-validation/  # Walk-forward backtesting
│   └── benchmark/     # Field-by-field regression testing
├── api/               # Express REST API
├── cli/               # CLI tool
├── ui/                # React dashboard
└── server.ts          # API server entry point
src-tauri/             # Tauri desktop configuration
```

---

## Writing Tests

All test files live in `__tests__/` directories next to the module they test.
Tests use [Vitest](https://vitest.dev/).

```bash
npm run test:watch    # interactive watch mode during development
```

The test suite must pass before any PR is merged:
```bash
npm test              # vitest run + tsc type-check
```

Helper factories for building test inputs live in `__tests__/helpers.ts`
inside each module. Use the existing helpers before writing new ones.

---

## Documentation Standards

- Engine rules and thresholds go in `docs/ENGINE_RULES.md`.
- Architecture decisions go in `docs/DECISIONS.md` as numbered ADRs.
- Known limitations go in `docs/KNOWN_LIMITATIONS.md` with a LIM-XXX identifier.
- User-facing changes go in `docs/CHANGELOG.md` under `[Unreleased]`.

---

## Pull Request Checklist

Before submitting a PR:

- [ ] `npm test` passes (all tests + typecheck)
- [ ] New logic has corresponding tests
- [ ] New constants are documented in `docs/ENGINE_RULES.md`
- [ ] New architecture decisions are in `docs/DECISIONS.md`
- [ ] `docs/CHANGELOG.md` has an entry under `[Unreleased]`
- [ ] No `console.log`, `TODO`, `FIXME`, or `HACK` comments in production code

---

## Reporting Issues

Open a GitHub issue with:
- The symbol and interval you were analyzing
- The full error message or unexpected output
- The `npm test` result if it's a reproducible failure
