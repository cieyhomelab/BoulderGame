# Boulder Gravity and Fall Implementation Plan

## Overview

Make boulders obey gravity. A boulder whose support is dug out becomes visibly unstable for
400 ms, then falls one tile per 120 ms until it rests on Dirt, a wall, a gem or another boulder.
Chain reactions fall out of the same rule rather than being a separate feature.

This is roadmap `S-02` — the first slice where the board changes **without the player pressing a
key**, so it is also where three preserved guardrails get exercised at once: input stays
acknowledged under 100 ms while boulders move, motion reads as continuous, and "Play again"
returns every boulder to its start position.

## Current State Analysis

- `F-01` landed `src/lib/game-clock.ts`: `GAME_TIMING.boulderGraceWindowMs` (400) and
  `boulderFallIntervalMs` (120), a `GameClock` interface, an animation-frame clock and a manual
  clock published on `window.__boulderGameClock` under `?clock=manual`. `GameEntry` already
  resolves one clock per mounted board into `gameClockRef` — **nothing subscribes to it yet.**
- `S-01` landed the mutable board: `GameState.board: Tile[][]`, the bounds-checked
  `tileAt(board, row, col): Tile | undefined`, `withTile()` for immutable single-cell writes, and
  `" "` as open space. `resolveMove` digs Dirt and gems.
- Boulders (`"r"`) are still static: `isWalkable` rejects them, nothing else reads them.
- `createInitialGameState()` deep-copies `LEVEL.template`, so boulder start positions already
  reset correctly for free — the replay guardrail is satisfied by construction, not by new code.
- The board is 12×8 = 96 cells; at most a handful of boulders are ever in motion.

## Desired End State

- Digging the Dirt under a boulder makes it visibly unstable for 400 ms, during which it does not
  move at all, then it falls one tile per 120 ms until supported.
- A boulder resting on another boulder that falls away becomes unstable in turn.
- Movement input is accepted and acknowledged immediately throughout — grace window and fall.
- "Play again" returns every boulder to its start position with no residue.
- A test can drive the whole lifecycle deterministically with `advanceGameClock`, no sleeping.

### Key Discoveries:

- **The player is not a support.** A Miner standing directly below a boulder occupies open space,
  so the boulder is unsupported and will fall on them. The PRD's "standing under a *stable*
  boulder is safe indefinitely" describes a boulder further up the column with something solid
  between — not the Miner acting as a prop.
- **Support is the complement of open space.** FR-006 lists Dirt, wall, gem and boulder; spikes
  and the exit are the only other tile kinds, and both are solid enough to stop a boulder. So the
  rule is simply "supported unless the tile below is `" "`", plus `undefined` (outside the board)
  counting as supported — exactly the case CLAUDE.md's "Board indexing" section warns about for a
  boulder on the bottom row.
- **The simulation must run on the move path too, not only on ticks.** The PRD states the rule as
  "after every change to the board, the cave decides which boulders have lost their support". If
  instability were only registered on the next tick, the grace window would start up to a frame
  late — and under the manual clock it would not start at all until the first `advance`, making
  every timing test off by one window.
- **A tick that changes nothing must return the identical state object.** The animation-frame
  clock fires ~60×/s; returning a fresh object each time would re-render the whole 96-cell board
  continuously and put the "motion reads as continuous" guardrail at risk.

## What We're NOT Doing

- **No crush death.** A boulder landing on the Miner does not yet end the level — that is `S-03`,
  deliberately kept separate so this slice can be verified without the terminal path.
- No boulder pushing, no diagonal sliding, no falling gems, no accelerating fall (PRD Non-Goals).
- No unwinnable-state detection — a player who buries the last gem hits "Play again".
- Not re-authoring the level (`S-04`). The existing layout has both boulders resting on Dirt, so
  nothing falls at t=0.
- Not extracting the simulation into a separate engine module beyond one pure function file.

## Implementation Approach

A pure `stepSimulation(state, nowMs): GameState` in a new `src/lib/boulder-simulation.ts`, called
from two places in `GameEntry`: after every accepted move, and on every clock tick.

Boulder motion lives in `GameState` as a record keyed by `"row:col"`, holding a phase
(`"grace" | "falling"`) and the timestamp the next transition is due. Each call first **syncs**
the record against the board (unsupported boulders gain a grace entry; supported ones lose their
entry), then **drains** every transition already due at `nowMs` in a loop, so one large clock jump
resolves the same way many small ones would.

Boulders are processed **bottom-up** within a drain pass, so a boulder can move into a cell the
boulder beneath it vacated in the same pass.

## Critical Implementation Details

**Timing & lifecycle** — the grace window expiring *is* the first fall step: the boulder moves one
tile at `dueAtMs`, then every `boulderFallIntervalMs` after. This makes the 400 ms the PRD calls
"time to react" the actual time between the dig and the boulder arriving in the next tile, rather
than 400 + 120.

**State sequencing** — the drain loop must re-derive support after every individual boulder move,
because moving one boulder changes what is under the boulder above it. Sync-then-drain-once is
wrong for chain reactions; the loop must be sync → move → sync → move.

**Termination** — each drain iteration either moves a boulder strictly downward (bounded by 8
rows) or pushes a due timestamp beyond `nowMs`. Both are monotone, but the loop still carries an
explicit iteration cap so a logic error degrades into a dropped frame rather than a hung tab.

**Performance constraints** — `stepSimulation` must return the *same* `GameState` reference when
a tick produces no change. This is what keeps the 60 Hz subscription from re-rendering the board.

## Phase 1: The simulation core

### Overview

A pure, framework-free module that resolves boulder support and motion against a clock time.

### Changes Required:

#### 1. Boulder simulation module

**File**: `src/lib/boulder-simulation.ts` (new)

**Intent**: Own the whole "which boulders are unstable, which are falling, where do they land"
rule, as pure functions over a board and a timestamp, so it is testable and `GameEntry` stays a
view.

**Contract**:

- `type BoulderPhase = "grace" | "falling"`.
- `interface BoulderMotion { phase: BoulderPhase; dueAtMs: number }`.
- `type BoulderMotions = Record<string, BoulderMotion>` keyed by `"row:col"` — the key moves with
  the boulder.
- `isSupported(board, row, col): boolean` — true unless the tile directly below is `" "`; a tile
  outside the board counts as supported (bottom-row boulders do not fall out of the cave).
- `stepSimulation(input: SimulationInput, nowMs: number): SimulationResult`, where the input
  carries the board and the motions and the result carries a possibly-new board, motions, and the
  list of coordinates a boulder moved into during this step. **Returns the input's own board and
  motions objects by reference when nothing changed** (see Critical Implementation Details).
- The moved-into coordinate list is what `S-03` will read to detect a crush; this slice ignores it
  beyond keeping it accurate.

The board and tile helpers (`tileAt`, `withTile`, the `Tile`/`Board` types) currently live inside
`GameEntry.tsx`. Move the four board primitives into this module and import them back — the
simulation cannot be a pure module otherwise, and this is the minimum extraction that achieves it.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Full E2E suite still passes: `npx playwright test`

#### Manual Verification:

- No gameplay change yet — the module is not wired in.

---

## Phase 2: Wire gravity into the game

### Overview

Subscribe the board to the clock and run the simulation on both the tick and the move path.

### Changes Required:

#### 1. Boulder motion in game state

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Give an attempt somewhere to hold boulder motion, reset with everything else.

**Contract**: `GameState` gains `boulderMotions: BoulderMotions`, initialised empty by
`createInitialGameState()`. Boulder *positions* need no reset code — they live in `board`, which
already deep-copies from the template.

#### 2. Simulation on the move path and the clock tick

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Run the cave's rule after every board change and on every frame.

**Contract**:

- `resolveMove` runs `stepSimulation` on its result before returning, at the clock's current time,
  so digging registers instability in the same state update that produced the hole.
- A new mount effect subscribes to `gameClockRef.current` and, per tick, calls `setGameState` with
  a `stepSimulation` at the tick's time. The effect must unsubscribe on unmount.
- The keydown handler needs the clock's `now()`; read it from the ref inside the handler, not from
  a captured value.
- When the level is not `active`, the simulation is a no-op — a boulder does not keep falling
  after the level ends.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Full E2E suite still passes: `npx playwright test`
- Build passes: `npm run build`

#### Manual Verification:

- Digging under a boulder makes it fall, and it stops on the next solid tile.
- The board does not visibly re-render or flicker when nothing is moving.

---

## Phase 3: The instability telegraph

### Overview

Make "this boulder is about to fall" visible during the 400 ms window, and audible to the live
status region without flooding it.

### Changes Required:

#### 1. Unstable boulder artwork

**File**: `src/components/game/TileArt.tsx`, `src/styles/global.css`

**Intent**: Telegraph the grace window, since 400 ms of nothing happening is the whole reaction
budget and an untelegraphed boulder is indistinguishable from a stable one.

**Contract**: A `wobble` keyframe in `global.css` (Tailwind 4 is CSS-first — no
`tailwind.config.js`), and a `TileArt` prop or tile variant that renders the existing `Boulder`
art with the wobble class applied. The boulder's own geometry is unchanged; only its transform
animates. Honour `prefers-reduced-motion` by falling back to a static tint rather than motion.

#### 2. Telegraph test IDs and the live region

**File**: `src/lib/game-guardrails.ts`, `src/components/game/GameEntry.tsx`

**Intent**: Give tests a handle on boulder state, and give a screen-reader user *some* signal that
the cave is in motion.

**Contract**:

- Add `boulder: "game-boulder"` and `unstableBoulder: "game-unstable-boulder"` to
  `GAME_GUARDRAIL_TEST_IDS`. Additions only.
- The `aria-live="polite"` region gains a count of currently unstable boulders. It is a **count,
  not an event**, so it announces once when the cave becomes unsettled and once when it settles —
  which is what keeps it from flooding on every wobble. This is a deliberate, minimal answer to
  PRD Open Question 1; it is not a full accessibility design.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Full E2E suite still passes: `npx playwright test`

#### Manual Verification:

- An undermined boulder visibly shakes before it drops.
- With reduced motion enabled, the unstable state is still distinguishable.

---

## Phase 4: E2E coverage for the fall lifecycle

### Overview

Lock the timing model in with deterministic, clock-driven browser tests.

### Changes Required:

#### 1. Boulder assertions

**File**: `tests/e2e/guardrail-assertions.ts`

**Intent**: Typed locators for the two boulder states, matching the existing `expectHazardAt`
shape.

**Contract**: `expectBoulderAt(page, row, col)`, `expectUnstableBoulderAt(page, row, col)`, and
`expectNoBoulderAt(page, row, col)`. Add-only.

#### 2. Gravity spec

**File**: `tests/e2e/boulder-gravity.spec.ts` (new)

**Intent**: Cover US-02's acceptance criteria and FR-009, all under `?clock=manual`.

**Contract**: Tests covering —

1. **The grace window is real**: dig out a boulder's support; advance 399 ms; the boulder has not
   moved and is marked unstable. Advance 1 ms more; it has moved exactly one tile.
2. **Fall speed**: from the first fall step, each further 120 ms advances exactly one tile.
3. **Landing**: the boulder stops on the first supporting tile and its motion entry clears — it
   does not pass through a gem.
4. **Chain reaction (FR-009)**: a boulder resting on a boulder becomes unstable once the lower one
   falls away, and lands on top of it.
5. **Input stays responsive**: a keypress issued mid-fall is acknowledged within the existing
   100 ms threshold via `pressAndExpectInputResponse`.
6. **Replay resets boulders**: after a fall, "Play again" puts the boulder back at its start.

> **Coverage gap recorded during Phase 4 — FR-005 cadence and FR-009 chain reactions are
> implemented but not E2E-covered.** The current level cannot produce either. Its only
> undermineable boulder is at `(5,3)`: its support at `(6,3)` is Dirt, and the tile below *that*
> is the bottom wall — so it falls exactly one tile and lands. The other boulder at `(1,8)` rests
> directly on a wall and can never move. A multi-tile fall needs a vertical shaft and a chain
> reaction needs two stacked boulders; neither exists in this layout.
>
> Rather than write a test that asserts nothing, both are **deferred to `S-04`**, which
> re-authors the level for gravity and must include a shaft deep enough to observe the 120 ms
> cadence and a boulder stack to observe FR-009. `S-04` is not complete without them.

### Success Criteria:

#### Automated Verification:

- New gravity spec passes: `npx playwright test boulder-gravity`
- Full suite passes: `npx playwright test`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Deliberate-break check: removing the grace window (grace = 0) fails test 1 specifically.

---

## Testing Strategy

### Integration (E2E) Tests:

- Grace window boundary at 399/400 ms, per-tile fall cadence, landing on each support kind, chain
  reaction, input responsiveness during motion, replay reset.
- Regression: all 16 existing tests must keep passing. The current level's two boulders both rest
  on Dirt, so none of them starts moving at t=0 and no existing route changes.

### Manual Testing Steps:

1. `npm run dev`. Walk under the boulder at row 5 and dig its support — it shakes, then drops.
2. Keep moving during the shake and the fall — the Miner responds instantly.
3. Let it land on a gem — it stops on top rather than passing through.
4. "Play again" — the boulder is back where it started.

## Performance Considerations

The subscription fires at animation-frame rate, so `stepSimulation` runs ~60×/s. With ≤ a handful
of boulders and a 96-cell board this is trivial arithmetic — but the identity-stability rule is
what keeps it free: an unchanged tick returns the same object and React bails out before touching
the DOM. If that rule is broken, the board re-renders 60×/s and the "motion reads as continuous"
guardrail is the first thing to fail.

## References

- Roadmap item: `context/foundation/roadmap.md` → `S-02`
- PRD: US-02, FR-003 … FR-006, FR-009, FR-010; "Timing model" (model B)
- PRD Open Question 1 (screen-reader parity for the telegraph) — partially addressed in Phase 3
- Clock and constants: `src/lib/game-clock.ts` (`F-01`)
- Board primitives: `src/components/game/GameEntry.tsx` (`S-01`), CLAUDE.md → "Board indexing"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: The simulation core

#### Automated

- [x] 1.1 Type checking passes — 8fbef8d
- [x] 1.2 Linting passes — 8fbef8d
- [x] 1.3 Full E2E suite still passes — 8fbef8d

#### Manual

- [x] 1.4 No gameplay change yet — 8fbef8d

### Phase 2: Wire gravity into the game

#### Automated

- [x] 2.1 Type checking passes — 91d9121
- [x] 2.2 Linting passes — 91d9121
- [x] 2.3 Full E2E suite still passes — 91d9121
- [x] 2.4 Build passes — 91d9121

#### Manual

- [x] 2.5 Digging under a boulder makes it fall and stop on the next solid tile — 91d9121
- [x] 2.6 The board does not re-render when nothing is moving — 91d9121

### Phase 3: The instability telegraph

#### Automated

- [x] 3.1 Type checking passes — 6b80acf
- [x] 3.2 Linting passes — 6b80acf
- [x] 3.3 Full E2E suite still passes — 6b80acf

#### Manual

- [x] 3.4 An undermined boulder visibly shakes before it drops — 6b80acf
- [x] 3.5 Reduced-motion users still get a distinguishable unstable state — 6b80acf

### Phase 4: E2E coverage for the fall lifecycle

#### Automated

- [x] 4.1 New gravity spec passes — ded187e
- [x] 4.2 Full suite passes — ded187e
- [x] 4.3 Linting passes — ded187e
- [x] 4.4 Build passes — ded187e

#### Manual

- [x] 4.5 Deliberate-break check: grace window of 0 fails the grace-window test — ded187e
