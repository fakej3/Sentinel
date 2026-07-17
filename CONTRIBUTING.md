# Contributing to Sentinel

Thank you for considering a contribution. This file covers the essentials — the full guide with PR checklist, test conventions, and documentation standards is at [`desktop/CONTRIBUTING.md`](desktop/CONTRIBUTING.md).

---

## Where the code lives

All application code is in the `desktop/` folder. That is the only folder that is actively developed right now. `website/` is the static marketing site. `backend/` and `mobile/` are empty placeholders for future work.

```
desktop/src/modules/   ← analysis engine — needs tests for every change
desktop/src/ui/        ← React dashboard
desktop/src/api/       ← Express REST API
desktop/src/cli/       ← CLI tool
desktop/src-tauri/     ← Rust/Tauri desktop shell
```

## Core rules

1. **Every change to `src/modules/` requires a matching test.** The test must fail before your change and pass after.
2. **Do not break determinism.** Same candle data → same output, always. No randomness in analysis functions.
3. **No AI in the analysis path.** Gemini runs only in the `writer` module, after all calculation is done.
4. **Every numeric constant needs a documented rule** in `desktop/docs/ENGINE_RULES.md`.

## Quick start

```bash
cd desktop
npm install
npm run dev       # starts API (port 3000) + frontend (port 5173)
npm test          # all tests + typecheck — must pass before submitting a PR
```

See [`desktop/docs/LOCAL_DEVELOPMENT.md`](desktop/docs/LOCAL_DEVELOPMENT.md) for the full setup guide.

## Reporting bugs

Open a [Bug Report issue](https://github.com/fakej3/Sentinel/issues/new?template=bug_report.yml). Include the symbol, interval, full error message, and the output of `npm test` if it fails locally.

## Security issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the private reporting process.
