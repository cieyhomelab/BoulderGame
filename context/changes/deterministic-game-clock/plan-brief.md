# Deterministic Game Clock — Plan Brief

> Full plan: `context/changes/deterministic-game-clock/plan.md`

## What & Why

The game has no concept of time — movement is resolved entirely inside a `keydown` handler, with
no loop, tick, or timer. Every gravity slice that follows (`S-02`, `S-03`, `S-04`) states its
acceptance criteria in milliseconds, and none of them can be verified without a clock a test can
drive. This change adds that clock, and the two tunable constants it carries.

## Starting Point

`GameEntry.tsx` is a single React island with a static board and reactive movement. The only
automated tests are Playwright E2E against 16 stable test IDs; there is no unit-test runner, so
the test seam has to be reachable from the browser rather than from Node.

## Desired End State

`src/lib/game-clock.ts` exports the 400 ms grace / 120 ms fall constants, a `GameClock`
interface, a real animation-frame clock, and a manual clock. Loading `/?clock=manual` publishes
the manual clock on `window`, so a Playwright test can step time by an exact number of
milliseconds instead of sleeping. Gameplay is completely unchanged.

## Key Decisions Made

| Decision                    | Choice                                                | Why (1 sentence)                                                                                    |
| --------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Where the test seam lives   | Browser `window`, gated by a `?clock=manual` query     | The only test runner is Playwright, so a Node-side injection point would be untestable.             |
| Real clock mechanism        | `requestAnimationFrame` + `performance.now()`          | Matches the PRD's "motion reads as continuous" guardrail; `setInterval` drifts and stutters.        |
| Manual `advance()` semantics| One tick per call, carrying the new `now()`            | Forces consumers to resolve *all* due transitions in a loop — which a backgrounded tab needs anyway.|
| Constants placement         | `GAME_TIMING` in the clock module                      | The PRD calls them tunable knobs; one home means tuning after playtest is a one-line edit.          |
| Scope of the wire-up        | Instantiate in `GameEntry`, subscribe nothing yet      | The roadmap names engine extraction as this item's specific scope-creep risk.                       |

## Scope

**In scope:** the clock module, ambient `Window` typing, one-line instantiation in `GameEntry`,
a new E2E spec, one `advanceGameClock` test helper.

**Out of scope:** gravity itself, extracting the simulation out of `GameEntry`, a unit-test
runner, pause/resume or time scaling, any change to existing test IDs or gameplay.

## Architecture / Approach

`resolveGameClock()` reads `window.location.search`. Manual mode returns a counter-backed clock
and publishes it on `window.__boulderGameClock`; normal mode returns an animation-frame clock and
publishes nothing. `GameEntry` calls it once on mount into a ref — the same line `S-02` will hang
its gravity subscription on.

## Phases at a Glance

| Phase                        | What it delivers                                    | Key risk                                                    |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| 1. The clock module          | `game-clock.ts` + ambient `Window` typing            | Touching `window` at module scope breaks SSR.               |
| 2. Wire-up + E2E proof       | Instantiation in `GameEntry`, new spec, test helper  | The wire-up leaking behaviour into the existing eight tests. |

**Prerequisites:** none — `F-01` has no roadmap prerequisites.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- Assumes an animation-frame loop is the right production driver. If boulder motion later needs
  to run while the tab is hidden, the frame clock is the piece that changes — the interface is not.
- The manual clock is reachable by anyone who visits `?clock=manual` in production. It is inert
  (nothing subscribes to it in this change, and it only affects the visitor's own tab), but it is
  a deliberate, visible seam rather than a hidden one.

## Success Criteria (Summary)

- A test can advance game time by an exact number of milliseconds with no `waitForTimeout`.
- The two gravity constants have exactly one declaration in the repo.
- All eight existing E2E tests pass with zero edits.
