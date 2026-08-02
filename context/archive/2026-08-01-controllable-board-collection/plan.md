# Controllable Board and Collection Implementation Plan

## Overview

This plan turns the S-01 static level preview into the first controllable BoulderGame board. The player can move around the grid with keyboard input, blocked tiles stop movement, and gems disappear when collected while the HUD updates.

## Current State Analysis

S-01 renders a client-only React island at `/` with a board-shaped cave, readiness marker, and attempt counter. The board is currently static: tile state is flattened once from `LEVEL_ROWS`, each tile is decorative, and there are no keyboard handlers or collection state. Playwright verifies anonymous entry and first attempt but still skips input-response and replay-target checks.

## Desired End State

After this change, a fresh player can open `/`, use arrow keys or WASD to move one tile at a time, hit wall/rock blockers without moving, collect gems, and see gem/score HUD values update immediately. The `game-input-response` marker becomes real for the last accepted movement so F-01's 100ms input guardrail has an executable browser assertion.

### Key Discoveries:

- `GameEntry` already owns browser-only state through React hooks: `src/components/game/GameEntry.tsx:39`.
- The current board is static `LEVEL_TILES` rendered from `LEVEL_ROWS`: `src/components/game/GameEntry.tsx:5`.
- F-01 already defines `game-input-response` as the canonical input marker: `src/lib/game-guardrails.ts:10`.
- Current Playwright has a skipped future input/replay test: `tests/e2e/guardrails.spec.ts:28`.
- S-03 owns hazards and win/loss states, so S-02 should keep rocks as blockers, not falling hazards.

## What We're NOT Doing

- Adding hazards, falling rocks, win/loss states, replay, or exit completion.
- Adding physics, animation-heavy simulation, server authority, persistence, or database writes.
- Changing deploy, auth scaffold, or CI Playwright behavior.
- Tuning risk-reward routes beyond making collectible gems reachable.

## Implementation Approach

Keep the level local to `GameEntry` for MVP speed. Introduce small typed helpers for parsing the grid, locating the player, checking walkable tiles, moving one step, and collecting gems. Use document-level keyboard input only while the game surface is mounted, ignore repeated unsupported keys, and expose stable test IDs through `game-guardrails.ts` so E2E can verify movement and collection without coupling to CSS.

## Critical Implementation Details

### Input Guardrail

The input-response marker should update only after an accepted move. The Playwright test should start timing immediately before pressing a movement key and assert the marker change inside `GAME_GUARDRAIL_THRESHOLDS.inputResponseMs`.

### Board Semantics

For S-02 the tile grid can remain a concise labelled board in the accessibility tree. Do not expose every tile as a separate image. Test selectors should attach to meaningful state elements such as board, player, gems remaining, and input marker.

## Phase 1: Board State Contract

### Overview

Define the board/player/gem contract and expose stable selectors without changing gameplay behavior yet.

### Changes Required:

#### 1. Guardrail selectors

**File**: `src/lib/game-guardrails.ts`

**Intent**: Give S-02 tests stable names for board, player, gems remaining, score, and collection state.

**Contract**: Extend `GAME_GUARDRAIL_TEST_IDS` with board, player, gemsRemaining, score, and collectedGems keys while preserving existing S-01 names.

#### 2. Board constants and helpers

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Replace the static flattened tile list with typed board state helpers that future phases can move through.

**Contract**: Keep one level layout local to the component file, parse it into rows/columns, identify the player start, count gems, and preserve wall/rock blockers. The rendered board should still look like the S-01 board before movement is added.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after selector/helper changes: `npm run lint`.
- Production build passes after selector/helper changes: `npm run build`.

#### Manual Verification:

- `/` still renders the same ready board shape as S-01.
- Existing anonymous entry E2E behavior is not weakened.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Keyboard Movement

### Overview

Make the player move one tile at a time through open floor and gem tiles.

### Changes Required:

#### 1. Movement state

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Store player position in React state and render the player marker at the current coordinate.

**Contract**: Arrow keys and WASD should map to one-tile moves. Floor and gem tiles are walkable. Walls and rocks are blockers. Movement must not require clicking the board first.

#### 2. Input response marker

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Turn F-01's input-response marker into a real signal.

**Contract**: Render `data-testid={GAME_GUARDRAIL_TEST_IDS.inputResponseMarker}` with a value that changes after each accepted move, such as the current player coordinate or move counter. Do not update it for blocked or unsupported keys.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after movement changes: `npm run lint`.
- Production build passes after movement changes: `npm run build`.
- Local Playwright verifies accepted movement updates the player marker and input response within 100ms: `npm run test:e2e`.

#### Manual Verification:

- Arrow keys and WASD move the player on `/`.
- Wall and rock blockers prevent movement without breaking the board.
- Movement feels immediate in a local browser.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Gem Collection and HUD

### Overview

Make collectible gems disappear from the board and update HUD values.

### Changes Required:

#### 1. Collection state

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Track collected gems in state so walking onto a gem removes it and increments score.

**Contract**: A gem tile should be collected once. Gems remaining should decrease from the initial count. Score should increase by a fixed MVP value per gem. No win condition should trigger when all gems are collected.

#### 2. E2E coverage

**File**: `tests/e2e/guardrails.spec.ts`, `tests/e2e/guardrail-assertions.ts`

**Intent**: Replace the skipped input future test with real movement and collection checks while keeping replay target out of scope.

**Contract**: Tests should verify first entry still works, one accepted move updates input marker under 100ms, blocked movement does not move the player, and moving onto the nearest gem updates gems remaining/score. Replay target may remain skipped for S-04.

#### 3. Local documentation

**File**: `README.md`, `AGENTS.md`

**Intent**: Reflect that local E2E now verifies movement and collection as well as entry.

**Contract**: Update only local test guidance; do not add CI Playwright.

### Success Criteria:

#### Automated Verification:

- Formatting check passes for changed docs/tests/source/plan files: `npx prettier --check README.md AGENTS.md src/lib/game-guardrails.ts src/components/game/GameEntry.tsx tests/e2e/guardrails.spec.ts tests/e2e/guardrail-assertions.ts context/changes/controllable-board-collection/plan.md context/changes/controllable-board-collection/plan-brief.md`.
- Type-aware lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Local Playwright movement and collection smoke passes: `npm run test:e2e`.

#### Manual Verification:

- A fresh browser session can move the player and collect at least one gem.
- The HUD updates gems remaining and score immediately after collection.
- No win/loss/replay UI appears in S-02.
- No CI production deploy or Playwright CI workflow is introduced.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change implemented.

---

## Testing Strategy

### Unit Tests:

- No standalone unit tests are required yet; movement helpers can stay private until they become shared logic.

### Integration Tests:

- Playwright verifies root entry, keyboard movement, blocked movement, input response, and gem collection.
- Lint/build verify React/Astro compatibility.

### Manual Testing Steps:

1. Open `/` in a fresh browser context.
2. Use arrow keys and WASD to move the player.
3. Try moving into a wall or rock and confirm the player stays in place.
4. Move onto a gem and confirm it disappears while gems/score update.
5. Confirm no win/loss/replay state appears after collection.

## Performance Considerations

Movement must update inside the 100ms input-response guardrail. Keep board state small and local, avoid network calls, and avoid re-rendering unrelated app shell state on every keypress.

## Migration Notes

No data migration is required. The board remains client-local and session-only.

## References

- Roadmap item: `context/foundation/roadmap.md` (`S-02`, `controllable-board-collection`)
- Product requirements: `context/foundation/prd.md` (`FR-003`, `FR-004`)
- Existing game entry: `src/components/game/GameEntry.tsx`
- Guardrail contract: `src/lib/game-guardrails.ts`
- Current E2E smoke: `tests/e2e/guardrails.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Board State Contract

#### Automated

- [x] 1.1 Type-aware lint passes after selector/helper changes — 8cf4997
- [x] 1.2 Production build passes after selector/helper changes — 8cf4997

#### Manual

- [x] 1.3 `/` still renders the same ready board shape as S-01 — 8cf4997
- [x] 1.4 Existing anonymous entry E2E behavior is not weakened — 8cf4997

### Phase 2: Keyboard Movement

#### Automated

- [x] 2.1 Type-aware lint passes after movement changes — bdf736c
- [x] 2.2 Production build passes after movement changes — bdf736c
- [x] 2.3 Local Playwright verifies accepted movement updates the player marker and input response within 100ms — bdf736c

#### Manual

- [x] 2.4 Arrow keys and WASD move the player on `/` — bdf736c
- [x] 2.5 Wall and rock blockers prevent movement without breaking the board — bdf736c
- [x] 2.6 Movement feels immediate in a local browser — bdf736c

### Phase 3: Gem Collection and HUD

#### Automated

- [x] 3.1 Formatting check passes for changed docs/tests/source/plan files — bcfd3d4
- [x] 3.2 Type-aware lint passes — bcfd3d4
- [x] 3.3 Production build passes — bcfd3d4
- [x] 3.4 Local Playwright movement and collection smoke passes — bcfd3d4

#### Manual

- [x] 3.5 Fresh browser session can move the player and collect at least one gem — bcfd3d4
- [x] 3.6 HUD updates gems remaining and score immediately after collection — bcfd3d4
- [x] 3.7 No win/loss/replay UI appears in S-02 — bcfd3d4
- [x] 3.8 No CI production deploy or Playwright CI workflow is introduced — bcfd3d4
