# Gravity-Aware Level Layout Implementation Plan

## Overview

Re-author the level for gravity. The current layout was designed for a static board: it has one
undermineable boulder that falls a single tile onto the bottom wall, one boulder cemented against
a wall that can never move, and no gem that requires the player to make a decision. This change
replaces it with a layout authored *against* the live simulation.

Roadmap `S-04`. It also carries a debt: `S-02` deferred FR-005 (per-tile fall cadence) and FR-009
(chain reactions) because the old level could not produce either. **This change is not complete
without covering both.**

## Current State Analysis

- `LEVEL_ROWS` (`GameEntry.tsx:20`) is the only thing that needs to change to re-author the level —
  everything downstream reads the parsed template. `parseLevel` resolves `p` to open space, counts
  gems, and records the start.
- `INITIAL_GEM_COUNT` and `OPTIONAL_GEM_COUNT` derive from the layout, so gem placement drives the
  Quota and Bonus panels automatically.
- Frozen by the PRD while the level is re-authored: 12×8 dimensions, the two-gem win quota, all
  existing test IDs, and spikes must remain present so the archived `level-end-states` change keeps
  its coverage.
- **Every existing E2E spec encodes the old layout's coordinates and routes.** All four
  gameplay specs need their routes re-derived; the assertion helpers themselves do not change.

## Desired End State

A 12×8 cave of solid Dirt with carved starting spaces where:

- The quota (2 gems) plus the exit is reachable from the start **without touching a boulder** —
  the level is safely winnable, so FR-012 holds.
- The third gem sits in a chamber walled on every side except one tile, and that tile holds a
  boulder. It is obtainable *only* by deliberately undermining that boulder — FR-011.
- A boulder falls three tiles down a pre-carved shaft, making the 120 ms cadence observable.
- Two stacked boulders produce a chain reaction when the lower one's support is dug out.
- No boulder is unsupported at t=0, and no boulder can reach the exit's column.

### Key Discovery:

**Dirt is walkable, so walls are the only real barrier.** "A gem only obtainable by undermining"
therefore means the gem must be enclosed by *walls* on every side but one, with a boulder standing
in the remaining gap. Any design that relies on Dirt to gate access fails immediately — the player
just digs through it.

## The layout

```
        c0 c1 c2 c3 c4 c5 c6 c7 c8 c9 c10 c11
 r0     #  #  #  #  #  #  #  #  #  #  #   #
 r1     #  .  .  .  r  .  .  .  r  g  #   #
 r2     #  .  .  .  r  .  .  .  .  #  .   #
 r3     #     p  .  .  .  .  .     #  .   #
 r4     #  .  #  .  .  .  #  .     #  .   #
 r5     #  .  #  g  .  h  #  g  .  .  .   #
 r6     #  .  .  .  .  .  .  .  .  .  e   #
 r7     #  #  #  #  #  #  #  #  #  #  #   #
```

- **Start** `(3,2)`, in a small carved chamber with `(3,1)`.
- **Quota gems** `(5,3)` and `(5,7)`; **bonus gem** `(1,9)`, walled by `(0,9)`, `(2,9)`, `(1,10)` —
  its only opening is `(1,8)`, which holds a boulder.
- **Spikes** `(5,5)`. **Exit** `(6,10)`.
- **The shaft** `(3,8)`, `(4,8)` is pre-carved open space; the boulder at `(1,8)` rests on the Dirt
  plug at `(2,8)`. Digging that plug drops it three tiles onto `(5,8)`.
- **The stack** `(1,4)` on `(2,4)`, resting on the Dirt at `(3,4)`. Digging `(3,4)` drops the lower
  boulder, which un-supports the upper one — FR-009.

## What We're NOT Doing

- No new mechanics. This is a layout change plus the test re-derivation it forces.
- No solver and no unwinnable-state detection — a player who buries a gem hits "Play again".
- Not changing dimensions, the quota, the gem total (3), or any test ID.

## Phase 1: Re-author the level

### Changes Required:

#### 1. The level rows

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Replace `LEVEL_ROWS` with the gravity-authored layout above.

**Contract**: Eight 12-character strings. `" "` is carved open space, `.` is Dirt. Gem total stays
3 so Bonus remains `x/1`. A comment above the constant states the invariants a future edit must
preserve: no boulder unsupported at t=0, no boulder in the exit's column, spikes present, quota
reachable without touching a boulder.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Nothing moves on load — no boulder falls at t=0.

---

## Phase 2: Re-derive the existing specs

### Changes Required:

#### 1. Route and coordinate updates

**File**: `tests/e2e/guardrails.spec.ts`, `tests/e2e/digging.spec.ts`,
`tests/e2e/boulder-gravity.spec.ts`, `tests/e2e/boulder-crush.spec.ts`

**Intent**: Point every existing test at the new geometry without weakening a single assertion.

**Contract**: Coordinates and key sequences change; the *assertions* do not. Every guardrail the
suite covered before it must still cover: win path, spike loss, bonus gem, replay loop, mobile
viewport, digging persistence, wall rejection, grace window, crush, and survival.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `npx playwright test`
- Linting passes: `npm run lint`

#### Manual Verification:

- The suite still covers the same guardrails — no assertion was deleted to make a test pass.

---

## Phase 3: Close the deferred FR-005 and FR-009 coverage

### Changes Required:

#### 1. Cadence and chain-reaction tests

**File**: `tests/e2e/boulder-gravity.spec.ts`

**Intent**: Cover the two requirements `S-02` could not, now that the layout supports them.

**Contract**: Two tests under `?clock=manual`:

- **FR-005 cadence** — undermine the shaft boulder at `(1,8)`, then advance the grace window and
  each fall interval one at a time, asserting the boulder is at `(2,8)`, `(3,8)`, `(4,8)` in turn
  and stops there.
- **FR-009 chain reaction** — dig `(3,4)`, escape, and assert the lower boulder falls first, then
  the upper one becomes unstable and follows, ending stacked at `(2,4)` / `(3,4)`.

#### 2. The undermine-gated gem

**File**: `tests/e2e/undermine-gated-gem.spec.ts` (new)

**Intent**: Prove FR-011 — the bonus gem is unreachable until the player undermines the boulder.

**Contract**: Two tests: the gem's chamber cannot be entered while the boulder stands, and after
undermining it the player walks in and collects it, taking Bonus to `1/1`.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `npx playwright test`
- Linting passes: `npx run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Deliberate-break check: shortening the shaft so the boulder falls one tile fails the cadence test.

---

## References

- Roadmap item: `context/foundation/roadmap.md` → `S-04`
- PRD: FR-011, FR-012, FR-013; "Frozen while the level is re-authored"
- Deferred coverage: `context/changes/boulder-gravity-and-fall/plan.md` → Phase 4 blockquote

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Re-author the level

#### Automated

- [x] 1.1 Type checking passes
- [x] 1.2 Linting passes
- [x] 1.3 Build passes

#### Manual

- [x] 1.4 Nothing moves on load — no boulder falls at t=0

### Phase 2: Re-derive the existing specs

#### Automated

- [x] 2.1 Full suite passes — 9190130
- [x] 2.2 Linting passes — 9190130

#### Manual

- [x] 2.3 The suite still covers the same guardrails — 9190130

### Phase 3: Close the deferred FR-005 and FR-009 coverage

#### Automated

- [x] 3.1 Full suite passes
- [x] 3.2 Linting passes
- [x] 3.3 Build passes

#### Manual

- [x] 3.4 Deliberate-break check: a one-tile shaft fails the cadence test
