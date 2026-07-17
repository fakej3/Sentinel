## Description

<!-- What does this PR do? Why? Link to any related issue: "Closes #123" -->



## Type of change

- [ ] Bug fix
- [ ] New feature / enhancement
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Tests only
- [ ] Other: <!-- describe -->

## Testing

<!-- How did you verify this change? List the commands you ran and what you observed. -->

```bash
npm test
```

- [ ] All existing tests pass (`npm test`)
- [ ] New tests added for changed analysis logic
- [ ] Determinism verified — same input produces same output after change
- [ ] Ran the app manually and exercised the changed code path

## Analysis logic changes

<!-- If you changed anything in src/modules/, answer these: -->

- [ ] Not applicable — no analysis logic changed
- [ ] Corresponding rule added / updated in `docs/ENGINE_RULES.md`
- [ ] No AI calls introduced in the analysis path
- [ ] Pipeline interface (`analyzeMarket()`) not broken

## Screenshots

<!-- For UI changes, include a before/after screenshot or a screen recording. -->

## Checklist

- [ ] Code follows the conventions in `desktop/CONTRIBUTING.md`
- [ ] No secrets, API keys, or credentials included
- [ ] PR title is descriptive (e.g. `fix: confidence score ignores neutral evidence items`)
