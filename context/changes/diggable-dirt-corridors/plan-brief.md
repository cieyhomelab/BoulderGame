# Diggable Dirt Corridors — Plan Brief

> Full plan: `context/changes/diggable-dirt-corridors/plan.md`

## What & Why

The Miner walks corridors someone else already dug — the board never changes, so nothing the
player does can create a hazard or a decision. This change makes the walkable tile **Dirt** and
gives the player the one verb the whole game is built on: digging. It is the model change every
gravity slice downstream reads.

## Starting Point

The board is a module-level constant parsed once and never mutated. `"."` means "empty walkable
floor" while already *rendering* as dirt artwork — the art is lying. Gem collection is tracked
outside the board as an array of `"row:col"` strings, re-derived per cell at render time.

## Desired End State

Moving into Dirt removes it and leaves open space that persists for the whole attempt; walls stay
non-diggable; "Play again" restores every dug tile and every gem. Open space is visually distinct,
so a carved corridor reads as a corridor. All nine existing E2E tests pass with zero edits.

## Key Decisions Made

| Decision                     | Choice                                              | Why (1 sentence)                                                                                       |
| ---------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Open-space encoding          | The space character `" "`                            | Carved corridors read as literal blank space in `LEVEL_ROWS`, making `S-04`'s layout reviewable by eye.  |
| Where the board lives        | Inside `GameState`, copied fresh per attempt         | Replay reset is then structural rather than a second code path that can drift.                          |
| Gem tracking                 | `collectedGemCount: number`, gems dug out of the board| Re-entry becomes a no-op by construction, deleting the key array and two render-time derivations.       |
| The `p` start marker         | Resolved to open space at parse time                 | The Miner has already dug where they stand; it also deletes the render-time `p` patch.                  |
| Board reads                  | `tileAt(board, row, col): Tile \| undefined`         | `noUncheckedIndexedAccess` is off, so CLAUDE.md prescribes exactly this accessor — `S-02` depends on it. |

## Scope

**In scope:** open space as a tile kind + its artwork, two new test IDs, board as per-attempt
state, digging in move resolution, rendering from state, a new digging E2E spec.

**Out of scope:** gravity and falling (`S-02`), re-authoring the level (`S-04`), unwinnable-state
detection, any change to the win/lose rules, the attempt counter, or existing test IDs.

## Architecture / Approach

`LEVEL_TEMPLATE` stays the immutable parsed source; `createInitialGameState()` deep-copies it into
`GameState.board`. `resolveMove` reads the target tile *before* digging it, returns a new board
with only the written row cloned, and leaves win/lose rules untouched. The render loop iterates
the live board and overlays the Miner sprite on the player's coordinate.

## Phases at a Glance

| Phase                              | What it delivers                                | Key risk                                                          |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| 1. Tile vocabulary and artwork     | Open space as a tile kind, its art, two test IDs | Open space rendering as an unstyled gap rather than a cavity.       |
| 2. Mutable board and digging       | Board in state; moving into Dirt digs it         | A shallow board copy leaking a dug corridor into the next attempt.  |
| 3. E2E coverage                    | Digging spec: dig, persist, wall, replay         | Tests that assert artwork instead of tile state.                    |

**Prerequisites:** none — `S-01` runs parallel with `F-01`, which is already landed.
**Estimated effort:** one session across three phases.

## Open Risks & Assumptions

- A collected gem becomes open space and therefore stops being a boulder support. This is correct
  under the PRD but is the first place digging and gravity interact — worth re-checking in `S-02`.
- Assumes the existing level stays solvable under the new meaning. It does, because Dirt is
  walkable everywhere empty floor was; the real re-author is `S-04`'s job.

## Success Criteria (Summary)

- A tile the Miner walked through is open space, and still open space many moves later.
- A wall is still not diggable.
- After "Play again", the corridor is gone and every gem is back.
