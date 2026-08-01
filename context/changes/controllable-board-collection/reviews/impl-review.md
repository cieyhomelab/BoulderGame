<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Controllable Board and Collection

- **Plan**: `context/changes/controllable-board-collection/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-08-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

No open findings remain after triage.

## Triage Decisions

### F1 — Input guardrail timing started after keypress

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: `tests/e2e/guardrails.spec.ts`, `tests/e2e/guardrail-assertions.ts`
- **Decision**: FIXED
- **Fix**: Added `pressAndExpectInputResponse`, which records time immediately before `page.keyboard.press`, asserts the input marker before player-position assertions, and enforces the remaining 100ms budget.

### F2 — Movement updater mixed state transition and side effects

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: `src/components/game/GameEntry.tsx`
- **Decision**: FIXED
- **Fix**: Replaced split movement state updates with one `GameState` object and a pure `resolveMove` transition. Keyboard default prevention now happens outside the state updater.

### F3 — Movement and collection changes were not announced to assistive tech

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Accessibility
- **Location**: `src/components/game/GameEntry.tsx`
- **Decision**: FIXED
- **Fix**: Added a polite screen-reader status for current player position, gems remaining, and score.

## Verification

- `npx prettier --check README.md AGENTS.md src/lib/game-guardrails.ts src/components/game/GameEntry.tsx tests/e2e/guardrails.spec.ts tests/e2e/guardrail-assertions.ts context/changes/controllable-board-collection/plan.md context/changes/controllable-board-collection/plan-brief.md` passed before review fixes.
- `npm run lint` passed before and after review fixes, with existing Astro parser warnings.
- `npm run build` passed before and after review fixes.
- `npm audit --audit-level=moderate` passed before review fixes.
- `npm run test:e2e` passed before and after review fixes: 3 passed, 1 skipped.
- Desktop and mobile screenshot probe after collection passed before review fixes with player `3,8`, gems `02`, score `100`, and input `5:3,8`.
