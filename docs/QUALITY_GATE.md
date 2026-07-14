# Sentinel — Quality Gate

This document is the permanent **Definition of Done** for every module in the project.

A module is not complete until every section of this checklist is satisfied.
No exceptions. No deferrals to a later PR.

If a requirement cannot be met, the limitation must be recorded in
`KNOWN_LIMITATIONS.md` and explicitly accepted before the module is merged.

---

## 1. Code Quality

### 1.1 Clean Architecture

- [ ] The module has a single, clearly stated responsibility.
- [ ] The public API is minimal: only what callers need is exported.
- [ ] Internal implementation details are not exported.
- [ ] The module does not reach into sibling modules' internals — only their public APIs.
- [ ] There are no circular dependencies between modules.

### 1.2 No Dead Code

- [ ] Every exported function, type, and constant is used by at least one caller or test.
- [ ] No commented-out code blocks remain.
- [ ] No `console.log`, `console.warn`, or `debugger` statements.
- [ ] No TODO or FIXME comments — open items must be in `KNOWN_LIMITATIONS.md` instead.

### 1.3 No Duplicated Logic

- [ ] Every algorithm is implemented in exactly one place.
- [ ] If the same calculation appears twice, a shared utility has been extracted.
- [ ] Shared utilities live in the module that owns them (not scattered across modules).

### 1.4 Meaningful Naming

- [ ] Functions are named for what they return or do, not how they do it.
- [ ] Boolean variables start with `is`, `has`, or `detected`.
- [ ] Arrays are named in the plural.
- [ ] Config keys match the terminology in `ENGINE_RULES.md` or `INDICATOR_RULES.md`.
- [ ] No single-letter variable names outside of classic loop indices (`i`, `k`) or math aliases (`k` for EMA multiplier).

### 1.5 Modular Design

- [ ] The module can be imported and used without importing any other analysis module.
- [ ] The module accepts its inputs as function parameters (no global state, no singletons).
- [ ] Partial configuration is merged with `DEFAULT_CONFIG` at the call site, not buried inside sub-functions.

### 1.6 Public API Documented

- [ ] Every exported function has a JSDoc comment explaining:
  - What it computes (in one sentence).
  - What each parameter means.
  - What the return value represents.
  - The minimum input size, if applicable.
  - Any edge cases that produce degenerate output.
- [ ] Types used in the public API are exported from the module's `index.ts`.

### 1.7 Internal Implementation Encapsulated

- [ ] Sub-functions that are only called within the module are not exported.
- [ ] Internal types that only appear inside the module are not exported.
- [ ] The public API surface does not change when internal implementation is refactored.

---

## 2. Correctness

### 2.1 Deterministic Output

- [ ] Given the same inputs and the same config, the function always returns the same output.
- [ ] There is no randomness, no `Date.now()`, no network calls inside pure computation functions.
- [ ] A test explicitly verifies determinism by calling the function twice on the same input.

### 2.2 Explainable Output

- [ ] Every output field can be traced to a specific rule in `ENGINE_RULES.md` or `INDICATOR_RULES.md`.
- [ ] No output is computed by an AI model, a black-box heuristic, or undocumented logic.
- [ ] The `evidence` array (where applicable) contains a human-readable explanation of every conclusion.

### 2.3 No AI-Generated Calculations

- [ ] No LLM call appears anywhere in the analysis pipeline (Modules 1–8).
- [ ] All numbers are produced by deterministic mathematical formulas.
- [ ] AI is used only in the Writing Engine and only to transform pre-validated structured JSON into prose.

### 2.4 No Silent Failures

- [ ] When inputs are insufficient (too few candles, empty array, etc.), the function returns a typed empty/null result — never `undefined`, never `NaN` in any output field.
- [ ] When a required precondition fails, the function surfaces the failure through its return type, not through an exception swallowed by a caller.
- [ ] `Number.isFinite` checks pass on all numeric output fields in every code path.

### 2.5 No Magic Numbers

- [ ] All numeric thresholds and default values are documented in `DEFAULT_CONFIG` or an equivalent typed constant.
- [ ] No raw numbers appear inside algorithm functions — they reference config parameters.
- [ ] Exceptions: mathematically significant constants (`2` in EMA multiplier `2/(N+1)`, `100` in percentage formulas) are acceptable without aliasing.

### 2.6 Configurable Thresholds

- [ ] Every tunable parameter (period, window size, multiplier, threshold) is a named field in the module's config type.
- [ ] The config type is documented with a JSDoc comment explaining what each field controls and which `ENGINE_RULES.md` section it corresponds to.
- [ ] The default config is exported from `index.ts` so callers can inspect and override specific fields.

### 2.7 Numerical Stability

- [ ] Division by zero is guarded (`denominator > 0` before dividing).
- [ ] The function does not return `Infinity`, `-Infinity`, or `NaN` on any input that passes validation.
- [ ] Results involving percentages are clamped where appropriate (RSI to `[0, 100]`, confidence to `[0, 10]`).

### 2.8 Edge Cases Handled

The following inputs must not cause crashes or `NaN` output:
- [ ] Empty array `[]`.
- [ ] Array shorter than the minimum required length.
- [ ] All prices identical (zero volatility).
- [ ] Extreme volatility (prices differ by 10×).
- [ ] Prices extremely close together (below `equalThreshold`).
- [ ] Volume = 0 on every candle.

---

## 3. Testing

See `TESTING_STRATEGY.md` for the full testing handbook. This section summarises
the minimum bar every module must clear.

### 3.1 Required Test Categories

| Category | Description | Required? |
|----------|-------------|-----------|
| Unit tests | Each function tested in isolation with controlled inputs | **Yes** |
| Integration tests | Public API tested end-to-end with realistic candle sequences | **Yes** |
| Regression tests | Named tests that lock specific past bug fixes | **Yes, when a bug is fixed** |
| Boundary tests | Inputs exactly at min/max/threshold boundaries | **Yes** |
| Invalid input tests | Too-short arrays, empty arrays, degenerate values | **Yes** |
| Determinism test | Same input → same output, called twice | **Yes** |

### 3.2 Coverage Expectations

Coverage is a floor, not a goal. Every branch of every algorithm must be tested, but
passing a coverage threshold does not substitute for testing correctness.

- [ ] Every code path through the algorithm is exercised by at least one test.
- [ ] Every condition that changes output (e.g., `score > threshold`) is tested above and below the boundary.
- [ ] The happy path is tested with a realistic multi-step candle sequence (not just toy examples).

### 3.3 Test Quality

- [ ] Test descriptions read as behaviour specifications, not code descriptions.
  - Good: `'returns BOS when close exceeds the last swing high'`
  - Bad: `'test detectBosChoch function'`
- [ ] No test asserts implementation details — only observable output.
- [ ] Test factories (helpers that build typed candle/swing objects) are used instead of repeating literal object construction.
- [ ] No test depends on execution order or shared mutable state between tests.

---

## 4. Documentation

No documentation drift is acceptable. A module is not complete until every document below is updated.

### 4.1 Required Document Updates

| Document | What to update |
|----------|----------------|
| `docs/ARCHITECTURE.md` | Add module to the pipeline diagram, module responsibilities section, and shared data structure schema if applicable |
| `docs/CHANGELOG.md` | Add a version entry listing every new file, function, and test count |
| `docs/ROADMAP.md` | Mark module as complete with test count; update progress percentage |
| `docs/ENGINE_RULES.md` | Ensure every algorithm rule used by the module is documented |
| `docs/INDICATOR_RULES.md` | Add or update entries for any indicator introduced by the module |
| `docs/KNOWN_LIMITATIONS.md` | Record any deferred enhancement or accepted tradeoff |

### 4.2 Prohibited Patterns

- [ ] No `TODO` comments in source code — open items go to `KNOWN_LIMITATIONS.md`.
- [ ] No `@deprecated` without a replacement reference.
- [ ] No stale footer timestamps — update footers when the document changes.
- [ ] No document section that contradicts another document (e.g., `confidence` described as `0–100` in one place and `0–10` in another).

---

## 5. Performance

### 5.1 Allocation

- [ ] No allocation inside a hot loop that could be pre-allocated once.
- [ ] `Array.filter(...).filter(...)` chains are collapsed into single passes where the combined predicate is readable.
- [ ] Input arrays are not unnecessarily cloned — pass by reference unless mutation is required.

### 5.2 Redundant Calculation

- [ ] A sub-result computed more than once is stored in a local variable.
- [ ] The same candle series is not iterated more times than the algorithm requires.
- [ ] EMA/SMA series needed for multiple indicators are computed once and shared.

### 5.3 Complexity

- [ ] O(n²) or worse algorithms require a comment explaining why O(n) is not feasible, or a ticket in `KNOWN_LIMITATIONS.md`.
- [ ] The function can handle 1 000 candles without perceptible latency in a browser tab.

### 5.4 Future Scalability

- [ ] The function signature accepts an array of candles and a config object. It does not pull from global state or a data store.
- [ ] Adding support for a second symbol or a second timeframe does not require internal refactoring.

---

## 6. Architecture

### 6.1 Module Boundaries

- [ ] The module does not import from a sibling module's sub-files — only from its `index.ts`.
- [ ] Data flows strictly downward through the pipeline (Module 1 → 2 → 3 → … → 9). No upstream dependency.
- [ ] Configuration is passed as a parameter, not imported as a file-level constant from another module.

### 6.2 No Circular Dependencies

- [ ] Running `tsc --noEmit` produces zero errors.
- [ ] No import cycle exists in the module graph (`A` imports `B` imports `A`).

### 6.3 Shared Contracts

- [ ] The module's input types are defined in its own `types.ts`, not duplicated from a dependency.
- [ ] When consuming another module's output, the consuming module imports the canonical type from that module's `index.ts`.
- [ ] The `Candle` type from `src/modules/binance` is the single source of truth for raw candle data across all modules.

---

## 7. Engineering Review Checklist

Answer yes to all of these before merging:

| Question | Answer |
|----------|--------|
| Can another engineer understand the module's purpose in 5 minutes? | |
| Can it be extended (new indicator, new rule) without modifying existing tests? | |
| Can it be tested independently without spinning up any other service? | |
| Can every numeric output field be explained by citing a specific rule in the docs? | |
| Would I trust this calculation in a production market analysis product? | |
| Are all known limitations and deferred items recorded in `KNOWN_LIMITATIONS.md`? | |

---

## Definition of Done

A module is **complete** when:

- [ ] All Code Quality checks pass (§1).
- [ ] All Correctness checks pass (§2).
- [ ] All required test categories are present and passing (§3).
- [ ] All required documents have been updated (§4).
- [ ] Performance is acceptable for 1 000-candle inputs (§5).
- [ ] Architecture checks pass (§6).
- [ ] All seven Engineering Review questions are answered yes (§7).
- [ ] `npm test` exits with zero failures.
- [ ] `tsc --noEmit` exits with zero errors.
- [ ] The module is committed and pushed on the designated feature branch.

---

*Last updated: RC1*
