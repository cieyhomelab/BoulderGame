# Diggable Dirt Corridors Implementation Plan

## Overview

Redefine the tile that means "empty walkable floor" as **Dirt** — solid, diggable, and (later) a
support for boulders — and introduce a new tile kind for the open space digging leaves behind.
Promote the board from a module-level constant to per-attempt state so a dug corridor persists
for the rest of the attempt and "Play again" restores it.

This is roadmap `S-01`, the load-bearing model change every gravity slice reads.

## Current State Analysis

- `LEVEL_BOARD` is a module-level `const` built once by `parseLevelRows()`
  (`GameEntry.tsx:140`). **The board is never mutated.** `LEVEL_CELLS` is a flattened copy used
  directly by the render loop (`GameEntry.tsx:245`).
- `getTileAt` closes over `LEVEL_BOARD` (`GameEntry.tsx:90`) — it takes a position but no board,
  so it cannot read per-attempt state.
- Gem collection is tracked *outside* the board, as `collectedGemKeys: string[]` of `"row:col"`
  strings, with the render loop re-deriving "this gem is gone" per cell
  (`GameEntry.tsx:247-248`). With a mutable board this indirection stops earning its keep.
- The player-start marker `p` lives in the board and is patched out at render time
  (`GameEntry.tsx:248`, the `cell.tile === "p" ? "."` branch).
- `"."` currently *renders* as `DirtGround` art while meaning "empty" — the artwork is already
  lying, which is why the PRD calls this a redefinition rather than a new tile.
- `DirtGround` is also used as the backdrop inside `Boulder`, `Gem`, and `Miner`
  (`TileArt.tsx:125,144,156`).
- `noUncheckedIndexedAccess` is **off** (CLAUDE.md): `board[row][col]` type-checks even out of
  bounds. Bounds checks are the author's responsibility.

## Desired End State

- Moving into a Dirt tile removes it and leaves open space that stays open for the rest of the
  attempt. Moving back over it costs nothing and removes nothing.
- Walls remain non-diggable — the move is rejected exactly as today.
- "Play again" restores every dug tile and every collected gem.
- Open space is visually distinct from Dirt, so a corridor reads as a corridor.
- All existing E2E tests pass **unchanged** — Dirt is walkable exactly where empty floor was, so
  no existing route through the level changes.

### Key Discoveries:

- The `p` marker should be **resolved away at parse time**: extract the start coordinate, then
  write open space into that cell. The Miner has by definition already dug where they stand, and
  it deletes the render-time `p` patch. `"p"` survives as a `Tile` value only because the render
  loop overlays the Miner sprite on the player's cell.
- Collected gems can stop being tracked separately. Collecting a gem writes open space into the
  board, so re-entry is a no-op by construction and a plain `collectedGemCount: number` replaces
  the key array plus its two render-time derivations.
- Deliberate consequence: a collected gem becomes open space, so it stops being a boulder
  support. That is correct under the PRD (an *uncollected* gem is the support) and is the first
  place digging and gravity interact.
- `Boulder`'s and `Gem`'s `DirtGround` backdrop stays (both are solid, embedded in the cave), but
  `Miner`'s must become open space — the Miner always stands in a tile that has been dug.

## What We're NOT Doing

- No gravity, no falling, no instability. Boulders stay static impassable obstacles until `S-02`.
- Not re-authoring the level layout — that is `S-04`. The existing 12×8 layout keeps working
  because Dirt is walkable wherever empty floor was.
- Not touching the attempt counter, replay wiring, win/lose rules, or the clock from `F-01`.
- No unwinnable-state detection (PRD Non-Goals): digging into a dead end is the player's problem.
- Not renaming any of the 16 existing test IDs — additions only.

## Implementation Approach

Three phases, each independently verifiable.

Phase 1 extends the tile vocabulary and the artwork with no behavioural change — open space
simply has no occurrences in the level yet. Phase 2 moves the board into `GameState` and makes
movement mutate it. Phase 3 adds E2E coverage for digging, persistence, and reset.

The encoding for open space is the **space character `" "`**. In `LEVEL_ROWS` this makes carved
corridors read as literal blank space against `.` Dirt, which is what makes `S-04`'s hand-authored
gravity layout reviewable by eye.

## Critical Implementation Details

**State sequencing** — `resolveMove` must compute the next board and the next player position
from the *same* snapshot, and the tile the Miner steps onto is read **before** it is dug. Reading
after the dig would see open space and lose the gem/spike branch entirely.

**Board copying** — the per-attempt board must be a fresh row-level copy of the template on every
`createInitialGameState()` call, not a shared reference. A shallow `LEVEL_TEMPLATE.slice()` copies
the outer array but leaves the rows shared, so a dig in attempt 1 would leak into attempt 2 and
silently break the replay guardrail.

> **Correction (recorded during Phase 3).** The claim above is wrong as implemented. `withTile`
> is purely immutable — it clones the row it writes rather than mutating in place — so the
> template's rows are never mutated and a shallow copy would *not* leak between attempts. The
> row-level copy is kept as cheap defence-in-depth against a future in-place writer, but it is
> not load-bearing today. Discovered by the Phase 3 deliberate-break check, which passed when it
> should have failed. The guarantee the replay test actually protects is that
> `handleReplayClick` installs a *fresh* board rather than carrying the dug one forward; breaking
> that does fail the spec.

## Phase 1: Tile vocabulary and open-space artwork

### Overview

Teach the tile model that open space exists, and give it artwork distinct from Dirt.

### Changes Required:

#### 1. Tile type and artwork

**File**: `src/components/game/TileArt.tsx`

**Intent**: Add open space as a first-class tile kind with its own art, and correct the Miner's
backdrop so a standing Miner reads as being in a dug-out cavity rather than inside solid Dirt.

**Contract**:

- `Tile` gains `" "`: `"." | " " | "#" | "g" | "p" | "r" | "e" | "h"`.
- A new `OpenSpace` art component — a dark cavity, clearly darker and flatter than `DirtGround`,
  with a subtle top edge so an open tile reads as a hole rather than an unrendered gap. Register
  it in `TILE_ART` under `" "`.
- `Miner` swaps its `DirtGround` backdrop for `OpenSpace`. `Boulder` and `Gem` keep `DirtGround`.
- Any gradient the new art needs is declared once in `TileDefs`, following the existing
  "declare once per page, reference from every tile" comment at `TileArt.tsx:17`.

#### 2. New guardrail test IDs

**File**: `src/lib/game-guardrails.ts`

**Intent**: Give E2E a stable handle on the two tile states this change introduces, so a test can
assert a tile *became* open space rather than inferring it from artwork.

**Contract**: Add `dirt: "game-dirt"` and `openSpace: "game-open-space"` to
`GAME_GUARDRAIL_TEST_IDS`. Additions only — no existing key is renamed or removed.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- All existing E2E tests still pass: `npx playwright test`

#### Manual Verification:

- Open space is visually distinguishable from Dirt at board scale.

---

## Phase 2: Per-attempt mutable board and digging

### Overview

Move the board into game state and make movement dig.

### Changes Required:

#### 1. Board as per-attempt state

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Make the board something an attempt owns and mutates, so a dug corridor persists and
"Play again" restores it.

**Contract**:

- `LEVEL_TEMPLATE: readonly (readonly Tile[])[]` replaces `LEVEL_BOARD`/`LEVEL_CELLS` as the
  parsed, immutable source. Parsing resolves `p` away: it records the start coordinate and writes
  `" "` into that cell.
- `GameState` gains `board: Tile[][]`. `createInitialGameState()` produces a fresh row-level copy
  of the template (see Critical Implementation Details).
- `collectedGemKeys: string[]` → `collectedGemCount: number`. `getPositionKey` and the render-time
  `isCollectedGem` derivation are removed as orphans of this change.
- A bounds-checked accessor replaces `getTileAt`:
  `tileAt(board: Tile[][], row: number, col: number): Tile | undefined`, returning `undefined`
  outside the grid. This is the accessor CLAUDE.md's "Board indexing" section prescribes, and
  `S-02`'s support resolution depends on it existing.
- `isWalkable` accepts Dirt, open space, gem, exit and spikes; wall and boulder stay rejected.
  It no longer needs a `"p"` case — `p` is not in the board any more.

#### 2. Digging in move resolution

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Moving into Dirt removes it; collecting a gem removes it; everything else leaves the
board untouched.

**Contract**: `resolveMove` returns a `board` alongside the other state. It copies only the row it
writes to (structural sharing keeps the render cheap and the change obvious in DevTools). Dirt and
gem targets become `" "`; spikes and exit are entered without mutation. The win/lose rules are
untouched: spikes lose, exit with the gem quota wins.

#### 3. Render from state

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Draw the live board rather than the frozen template, and tag Dirt and open space for
tests.

**Contract**: The render loop iterates `gameState.board`, overlaying `"p"` on the player's
coordinate. `data-testid` resolution extends the existing ternary chain with the two new IDs; the
player, hazard and exit branches keep priority so no existing locator changes meaning. `data-row`
/ `data-col` stay on every cell.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- All existing E2E tests still pass **unchanged**: `npx playwright test`
- Build passes: `npm run build`

#### Manual Verification:

- Walking a straight line carves a visible corridor that stays open.
- "Play again" restores the full Dirt field and all gems.

---

## Phase 3: E2E coverage for digging

### Overview

Lock the new behaviour in with browser tests.

### Changes Required:

#### 1. Dig assertions

**File**: `tests/e2e/guardrail-assertions.ts`

**Intent**: Give the dig spec typed locators for the two new tile states.

**Contract**: `expectOpenSpaceAt(page, row, col)` and `expectDirtAt(page, row, col)`, following
the exact shape of the existing `expectHazardAt` (`guardrail-assertions.ts:71`) — a
`[data-testid][data-row][data-col]` locator assertion. Add-only.

#### 2. Digging spec

**File**: `tests/e2e/digging.spec.ts` (new)

**Intent**: Cover the three US-01 acceptance criteria plus the replay guardrail.

**Contract**: Four tests:

1. A tile that was Dirt becomes open space once the Miner moves through it.
2. The corridor persists — after moving several tiles away, the dug tile is still open space,
   and stepping back over it changes nothing and costs no state.
3. A wall is not diggable — the move is rejected, the player does not move, and the wall tile is
   still not open space.
4. "Play again" restores dug Dirt — dig a corridor, lose on the spike, replay, and the tile that
   was dug is Dirt again.

### Success Criteria:

#### Automated Verification:

- New digging spec passes: `npx playwright test digging`
- Full suite passes: `npx playwright test`
- Linting passes: `npm run lint`

#### Manual Verification:

- The digging spec fails if the board copy is made shallow (deliberate-break check).

---

## Testing Strategy

### Integration (E2E) Tests:

- Dig, persist, re-enter, wall rejection, replay restore.
- Regression: all nine existing guardrail tests must pass with **zero edits**. Dirt is walkable
  wherever empty floor was, so any required edit means movement semantics drifted.

### Manual Testing Steps:

1. `npm run dev`, walk right five tiles — a corridor of open space is visible behind the Miner.
2. Walk back over it — nothing changes, no double-count in the HUD.
3. Walk into the wall — rejected, no dig.
4. Lose on the spike, "Play again" — the corridor is gone and all three gems are back.

## Performance Considerations

The board is 96 cells and is copied once per accepted move, with only the written row cloned. This
is negligible next to the React re-render the move already triggers, and the 100 ms input
acknowledgement threshold has three orders of magnitude of headroom.

## References

- Roadmap item: `context/foundation/roadmap.md` → `S-01`
- PRD: US-01, FR-001, FR-002, FR-010, FR-013, FR-014; "Scope of Change → Tile model"
- Bounds-checking rule: `CLAUDE.md` → "Board indexing"
- Locator precedent: `tests/e2e/guardrail-assertions.ts:71`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Tile vocabulary and open-space artwork

#### Automated

- [x] 1.1 Type checking passes — d358ce6
- [x] 1.2 Linting passes — d358ce6
- [x] 1.3 All existing E2E tests still pass — d358ce6

#### Manual

- [x] 1.4 Open space is visually distinguishable from Dirt — d358ce6

### Phase 2: Per-attempt mutable board and digging

#### Automated

- [x] 2.1 Type checking passes — 928b1fa
- [x] 2.2 Linting passes — 928b1fa
- [x] 2.3 All existing E2E tests still pass unchanged — 928b1fa
- [x] 2.4 Build passes — 928b1fa

#### Manual

- [x] 2.5 Walking carves a visible corridor that stays open — 928b1fa
- [x] 2.6 "Play again" restores the full Dirt field and all gems — 928b1fa

### Phase 3: E2E coverage for digging

#### Automated

- [x] 3.1 New digging spec passes — 6635035
- [x] 3.2 Full suite passes — 6635035
- [x] 3.3 Linting passes — 6635035

#### Manual

- [x] 3.4 Deliberate-break check: replay that carries the dug board forward fails the spec (original shallow-copy break was invalid — see Correction) — 6635035
