<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Deterministic Game Clock

- **Plan**: `context/changes/deterministic-game-clock/plan.md`
- **Scope**: Phases 1–2 of 2 (full plan)
- **Date**: 2026-08-02
- **Verdict**: APPROVED (after triage)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS (after F1 fix) |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automated criteria re-run at review time: `npx tsc --noEmit` clean, `npm run lint` clean,
`npx playwright test` 12/12 passing, `npm run build` succeeds.

## Findings

### F1 — Clock specs gated on an SSR-rendered marker, so they did not prove hydration

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `tests/e2e/game-clock.spec.ts:26`
- **Detail**: The specs waited on `expectInputResponseMarker`, which asserts visibility of a
  server-rendered element. That marker appears before React hydrates, so
  "normal play does not expose the manual clock" would have passed identically on a page that
  never hydrated — a false green — and the advance test raced hydration without a poll to absorb it.
- **Fix**: Added `expectGameHydrated`, which waits for the attempt counter to become numeric.
  The counter renders as `-` on the server and only becomes a number once the mount effect runs,
  making it the cheapest available proof that client code — including clock resolution — has run.
- **Decision**: FIXED

### F2 — Suspected redundant type assertions on `window[key]`

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `tests/e2e/game-clock.spec.ts`, `tests/e2e/guardrail-assertions.ts`
- **Detail**: Initially flagged as noise. **Withdrawn on verification** — Playwright's `evaluate`
  overloads widen the literal argument to `string`, and annotating the callback parameter instead
  breaks overload resolution outright. The in-body assertion is the only form that compiles.
- **Decision**: DISMISSED (finding was incorrect)

### F3 — `gameClockRef` is write-only

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Architecture
- **Location**: `src/components/game/GameEntry.tsx:159`
- **Detail**: The clock is currently load-bearing only through `resolveGameClock()`'s side effect
  of publishing the manual clock on `window`; nothing reads the ref. This is exactly what the plan
  specified — `S-02` (`boulder-gravity-and-fall`) is the consumer that subscribes to it.
- **Decision**: ACCEPTED — intentional per plan; revisit if `S-02` does not land.
