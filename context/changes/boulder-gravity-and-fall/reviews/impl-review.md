<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Boulder Gravity and Fall

- **Plan**: `context/changes/boulder-gravity-and-fall/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-08-02
- **Verdict**: NEEDS ATTENTION — one accepted coverage gap carried into `S-04`
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING — two FRs implemented but not covered (F1) |

Automated criteria re-run at review time: `npx tsc --noEmit` clean, `npm run lint` clean,
`npx playwright test` 22/22 passing, `npm run build` succeeds. Deliberate-break check confirmed
the grace-window tests fail when the grace window is set to 0.

## Findings

### F1 — FR-005 cadence and FR-009 chain reactions are implemented but not covered

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `tests/e2e/boulder-gravity.spec.ts`
- **Detail**: The plan called for a per-tile cadence test and a chain-reaction test. Neither can
  be written against the current level: its only undermineable boulder at `(5,3)` sits one tile
  above the bottom wall, so it falls exactly one tile; the other at `(1,8)` rests directly on a
  wall and can never move. A multi-tile fall needs a vertical shaft; a chain reaction needs two
  stacked boulders. The drain loop that implements both is exercised only indirectly.
- **Fix**: Deferred to `S-04`, which re-authors the level for gravity and must include a shaft
  deep enough to observe the 120 ms cadence and a boulder stack to observe FR-009. Recorded as a
  blockquote in the plan and as an explicit `S-04` completion requirement.
- **Decision**: ACCEPTED — deferred, with the requirement written into `S-04`'s scope rather than
  left implicit.

### F2 — The animation-frame subscription calls `setGameState` ~60×/s even when idle

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Architecture
- **Location**: `src/components/game/GameEntry.tsx` → clock subscription effect
- **Detail**: `applySimulation` correctly returns the *same* state object on an idle tick, so
  React bails out before touching the DOM — the identity-stability rule the plan called for holds,
  and `stepSimulation` itself allocates nothing new when nothing changed. But the setter is still
  invoked every frame for the lifetime of the page, which schedules (and immediately discards) a
  React update ~60×/s forever.
- **Fix**: Leave as is for now. The 100 ms input-responsiveness test passes with the loop running,
  and the board demonstrably does not thrash. Suspending the subscription while there are no
  motions would need the effect to observe motion state, re-introducing exactly the coupling the
  pure-module split removed.
- **Decision**: ACCEPTED — measured, within guardrail, revisit only if a playtest reports jank.

### F3 — Spikes and the exit act as boulder supports

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: `src/lib/boulder-simulation.ts` → `isSupported`
- **Detail**: FR-006 enumerates Dirt, wall, gem and boulder. The implementation defines support as
  "anything that is not open space", which additionally makes spikes and the exit hold a boulder.
  This was a deliberate reading recorded in the plan's Key Discoveries — the alternative lets a
  boulder pass *through* the exit portal, which no requirement asks for and which would interact
  badly with FR-012's "no boulder seals the exit" guardrail.
- **Decision**: ACCEPTED — intentional and documented.

### F4 — A boulder can currently move into the Miner's tile harmlessly

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Scope Discipline
- **Location**: `src/lib/boulder-simulation.ts` → `stepSimulation`
- **Detail**: `landedOn` accurately reports every tile a boulder moved into, but nothing consumes
  it yet, so a boulder that lands on the Miner passes through without consequence.
- **Decision**: ACCEPTED — this is exactly the `S-03` seam the plan carved out on purpose.
