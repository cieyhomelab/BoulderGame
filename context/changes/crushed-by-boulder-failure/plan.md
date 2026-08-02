# Crushed by Boulder — Failed Implementation Plan

## Overview

Make the player-authored death real: a boulder that moves into the Miner's tile ends the level
immediately with a **Failed** outcome. This is roadmap `S-03` and the roadmap's **north star** —
the first point where the PRD's Primary criterion ("the reaction window is real … both outcomes
are reachable by a first-time playtester without instruction") can be observed on a real person.

## Current State Analysis

- `S-02` landed `stepSimulation`, which already reports `landedOn: Coordinate[]` — every tile a
  boulder moved *into* during a step. **Nothing consumes it yet**, so a boulder currently passes
  through the Miner harmlessly. That field exists precisely as this slice's seam.
- `applySimulation` in `GameEntry.tsx` returns early when `status !== "active"`, so once the level
  ends the cave freezes — no further falling after a terminal outcome.
- The losing status already exists and is driven by spikes; `outcomeMessage` maps `"lost"` to
  "Cave-in. Play again?". The status set stays `active | lost | won` per the PRD — being crushed
  is a **new cause of the existing losing status, not a new status value**.
- `isWalkable` rejects `"r"`, so walking into a boulder is already a rejected move. FR-008's
  asymmetry is satisfied by construction; this slice must not weaken it.

## Desired End State

- A boulder arriving on the Miner's tile ends the level as `lost`, with a Failed-flavoured message
  distinct from the spike cave-in, and the replay prompt behaves exactly as it does for spikes.
- Moving into a boulder's tile is still a rejected move and never a death.
- Standing where a *supported* boulder is above stays safe no matter how much time passes.
- Escaping during the grace window survives — both outcomes reachable, which is the whole point.

### Key Discoveries:

- The crush check belongs in `applySimulation`, not in the simulation module. `stepSimulation` is
  a pure rule about the cave and does not know where the Miner is; keeping the player out of it
  preserves the split `S-02` established.
- The check must compare against the player position **in the state the step was applied to**. On
  the move path the Miner has already moved, so the comparison uses the post-move position — a
  boulder falling into the tile the Miner just vacated is not a death.

## What We're NOT Doing

- Not adding a new status value. `won | lost | active` is frozen by the PRD's backward-compat
  section, and everything keying on the losing status keeps working.
- Not making a stable boulder dangerous, and not making walking into a boulder fatal (FR-008).
- Not touching the attempt counter, the replay reset, or the win path.
- Not re-authoring the level (`S-04`).

## Phase 1: Crush detection and the Failed outcome

### Changes Required:

#### 1. Loss cause in game state

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Let the level distinguish *why* it was lost so the player-facing message can differ,
without adding a status value.

**Contract**: `GameState` gains `lossCause: "spikes" | "crushed" | null`, `null` while active or
won. `resolveMove` sets `"spikes"` when the Miner steps onto `h`. `createInitialGameState()`
resets it to `null`.

#### 2. Crush detection

**File**: `src/components/game/GameEntry.tsx`

**Intent**: End the level when a boulder moves into the tile the Miner occupies.

**Contract**: `applySimulation` inspects `result.landedOn` for a coordinate equal to the state's
player position; on a match the returned state carries `status: "lost"` and
`lossCause: "crushed"`. The identity-stability rule from `S-02` is unaffected — a step that
produces no movement produces no `landedOn` entries and still returns the same state object.

#### 3. Failed outcome message and test hook

**File**: `src/components/game/GameEntry.tsx`, `src/lib/game-guardrails.ts`

**Intent**: Tell the player they were crushed rather than caved in, and give tests a stable handle
on the cause.

**Contract**: `outcomeMessage` branches on `lossCause` — `"crushed"` reads
"Failed — crushed by a falling boulder. Play again?", `"spikes"` keeps "Cave-in. Play again?"
verbatim so the existing spike test is untouched. Add `lossCause: "game-loss-cause"` to
`GAME_GUARDRAIL_TEST_IDS`, rendered as an `sr-only` element carrying the cause.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Full E2E suite still passes: `npx playwright test`
- Build passes: `npm run build`

#### Manual Verification:

- Standing under an undermined boulder and waiting ends the level as Failed.

---

## Phase 2: E2E coverage for the crush

### Changes Required:

#### 1. Crush spec

**File**: `tests/e2e/boulder-crush.spec.ts` (new)

**Intent**: Cover US-03's three acceptance criteria plus the survival half of the reaction window.

**Contract**: Five tests under `?clock=manual`:

1. **Crushed** — undermine the boulder, stay put, advance the grace window; status is `lost`,
   cause is `crushed`, the message reads Failed, and the replay button is visible.
2. **Escape survives** — same setup but step clear first; the level is still `active` after the
   boulder lands.
3. **Walking into a boulder is rejected, never a death** — the move is refused, the position and
   move count are unchanged, and the level stays `active`.
4. **A stable boulder is safe indefinitely** — with support intact, advancing far past several
   fall intervals changes nothing.
5. **Replay after a crush** — the attempt counter increments and the board resets, exactly as it
   does after a spike loss.

### Success Criteria:

#### Automated Verification:

- New crush spec passes: `npx playwright test boulder-crush`
- Full suite passes: `npx playwright test`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Deliberate-break check: ignoring `landedOn` fails the crush test specifically.

---

## References

- Roadmap item: `context/foundation/roadmap.md` → `S-03` (north star)
- PRD: US-03, FR-007, FR-008, FR-014; "Backward compatibility → level end-state model"
- Seam established by `S-02`: `src/lib/boulder-simulation.ts` → `SimulationResult.landedOn`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Crush detection and the Failed outcome

#### Automated

- [x] 1.1 Type checking passes — 49fa10f
- [x] 1.2 Linting passes — 49fa10f
- [x] 1.3 Full E2E suite still passes — 49fa10f
- [x] 1.4 Build passes — 49fa10f

#### Manual

- [x] 1.5 Standing under an undermined boulder ends the level as Failed — 49fa10f

### Phase 2: E2E coverage for the crush

#### Automated

- [x] 2.1 New crush spec passes — 14f8525
- [x] 2.2 Full suite passes — 14f8525
- [x] 2.3 Linting passes — 14f8525
- [x] 2.4 Build passes — 14f8525

#### Manual

- [x] 2.5 Deliberate-break check: ignoring landedOn fails the crush test — 14f8525
