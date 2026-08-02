<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Gravity-Aware Level Layout

- **Plan**: `context/changes/gravity-aware-level-layout/plan.md`
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-08-02
- **Verdict**: APPROVED
- **Findings**: 1 critical (fixed), 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (after F1 fix) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Layout invariants verified programmatically before any test was written: all rows 12 wide, no
boulder unsupported at t=0, no boulder in the exit's column, spikes present, both quota gems and
the exit reachable without moving a boulder, and the bonus gem unreachable without moving one.

## Findings

### F1 — A chain reaction resolved differently under one large clock jump than under many frames

- **Severity**: CRITICAL
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/boulder-simulation.ts` → `stepSimulation` drain loop
- **Detail**: Surfaced by the FR-009 test the moment the layout could produce a chain. A boulder
  that lost its support *during* a drain pass had its grace window registered at `nowMs` rather
  than at the moment support was actually lost. Advancing 800 ms in one step therefore left the
  upper boulder still falling at t=1200, while two 400 ms steps landed it at t=800. `S-02` had
  applied this "advance from the due time, not from now" rule to fall cadence but not to newly
  registered grace windows, and no level could expose the difference. This directly violates the
  PRD's determinism property — "the same inputs issued at the same moments produce the same
  outcome". Under the real 60 Hz clock the divergence is bounded by one frame, so it would have
  shipped as an invisible-but-real inconsistency.
- **Fix**: `applyNextDueMove` now reports the time the move actually happened, and the drain loop
  syncs at that time rather than at `nowMs`.
- **Decision**: FIXED

### F2 — Every gameplay spec's routes were rewritten

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Scope Discipline
- **Location**: `tests/e2e/*.spec.ts`
- **Detail**: Unavoidable — the specs encode board coordinates and the board changed. Coordinates
  and key sequences changed; assertions did not. The one test that could not survive verbatim
  ("losing by stepping from the bonus gem into the adjacent hazard" — the new layout has no gem
  adjacent to spikes) was replaced by "a collected gem's score survives losing on the way onward",
  which covers the same guardrail, and the bonus gem gained its own dedicated FR-011 spec.
- **Decision**: ACCEPTED — no coverage was lost.

### F3 — A decorative dead-end pocket at column 10, rows 2–5

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/components/game/GameEntry.tsx` → `LEVEL_ROWS`
- **Detail**: The right-hand column above the exit is a reachable dead end with nothing in it. It
  is harmless (no boulder can enter that column, which is what keeps the exit unsealable) and adds
  cave texture, but it carries no decision.
- **Decision**: ACCEPTED — candidate for a future tuning pass, not a defect.
