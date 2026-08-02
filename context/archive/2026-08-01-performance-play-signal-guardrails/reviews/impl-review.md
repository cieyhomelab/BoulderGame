<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Performance Play Signal Guardrails

- **Plan**: `context/changes/performance-play-signal-guardrails/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-08-01
- **Verdict**: APPROVED AFTER TRIAGE
- **Findings**: 1 critical, 4 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 - Runtime dependencies have high-severity audit failures

- **Severity**: CRITICAL
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality
- **Location**: `package.json`, `package-lock.json`
- **Detail**: `npm audit --omit=dev --audit-level=moderate` failed on the runtime dependency chain, including `astro`.
- **Fix**: Ran `npm audit fix --force`, upgraded `astro` to `^7.1.6`, upgraded `@astrojs/cloudflare` to `^14.1.7`, and updated the `vite` override to `^8.0.13` to match Astro 7.
- **Decision**: FIXED

### F2 - Attempt counter can throw on unavailable sessionStorage

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/lib/game-guardrails.ts`
- **Detail**: Storage access could throw in privacy-restricted browser contexts.
- **Fix**: Wrapped storage resolution and read/write/remove operations in defensive `try/catch` paths.
- **Decision**: FIXED

### F3 - Playwright smoke can pass against the wrong app

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: `playwright.config.ts`, `tests/e2e/guardrails.spec.ts`
- **Detail**: Local Playwright could reuse an unrelated server on the configured port, and the smoke assertion was too generic.
- **Fix**: Disabled server reuse, forced Astro dev foreground mode for Playwright with `ASTRO_DEV_BACKGROUND: "0"`, and added app-specific title/H1 assertions.
- **Decision**: FIXED

### F4 - CI targets master while repo branch is main

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `.github/workflows/ci.yml`
- **Detail**: CI branch filters did not include the current `main` branch.
- **Fix**: Added `main` to push and pull request branch filters while keeping `master`.
- **Decision**: FIXED

### F5 - Phase 3 commit included broad scaffold snapshot

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Scope Discipline
- **Location**: commit `134a054`
- **Detail**: The user-approved `Stage all` commit included scaffold and context files beyond the phase-3 docs scope.
- **Fix**: No code change; accepted as an explicit user decision for this implementation.
- **Decision**: ACCEPTED

### F6 - Future guardrail expectations are not reusable helpers

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `tests/e2e/guardrails.spec.ts`
- **Detail**: Future guardrail expectations were inline in a skipped test rather than reusable helper functions.
- **Fix**: Added `tests/e2e/guardrail-assertions.ts` and updated the skipped contract test to use the exported helpers.
- **Decision**: FIXED

## Final Verification

- `npm audit --audit-level=moderate` - passed, 0 vulnerabilities
- `npm run lint` - passed, with existing Astro parser warnings
- `npm run build` - passed, with existing sitemap `site` warning
- `npm run test:e2e` - passed, 1 skipped and 1 passed
