# Replayable Arcade Loop Implementation Plan

## Overview

This plan turns the current win/loss endpoints into a complete arcade loop. After a terminal state, the player can immediately restart the same level without auth, navigation, reload, or instructions.

## Current State Analysis

The game starts anonymously, supports movement and collection, and now reaches `lost` or `won`. Terminal states intentionally freeze movement and do not yet offer replay. Attempt count is already stored in `sessionStorage` and exposed through `game-attempt-counter`.

## Desired End State

After losing or winning, the HUD exposes a clear replay control. Activating it resets the board, score, status, input marker, and player position, while incrementing the session attempt count. A local E2E smoke verifies that a player can reach at least three attempts through real replay actions.

### Key Discoveries:

- `GameEntry` owns all local game state and already uses `incrementGameAttemptCount()`.
- `GAME_GUARDRAIL_THRESHOLDS.replayAttemptTarget` is already `3`.
- The current skipped Playwright marker is the intended target to promote in this slice.
- S-05 owns risk-reward tuning, so this slice should not redesign the level.

## What We're NOT Doing

- Adding persistence beyond the current session attempt counter.
- Adding auth, accounts, leaderboards, analytics, campaigns, or deployment changes.
- Redesigning the board around risk-reward routes.
- Adding CI Playwright; E2E remains local-only for now.

## Implementation Approach

Keep replay local and synchronous. Add stable replay selectors, extract initial game-state creation into a helper, show a `Play again` control only in terminal states, and reset state through the same initialization path used for first load.

## Phase 1: Replay Contract

### Overview

Add stable replay test IDs and helper assertions without changing visible gameplay yet.

### Changes Required:

#### 1. Guardrail selectors

**File**: `src/lib/game-guardrails.ts`

**Intent**: Give E2E tests stable selectors for replay controls and terminal outcome messaging.

**Contract**: Add `replayButton` and `outcomeMessage` keys to `GAME_GUARDRAIL_TEST_IDS`. Do not rename existing keys.

#### 2. E2E helper contract

**File**: `tests/e2e/guardrail-assertions.ts`

**Intent**: Prepare tests to assert replay availability and attempt-count progress.

**Contract**: Add helpers for the replay button, outcome message text, and replay activation.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after replay selector contract: `npm run lint`.
- Production build passes after replay selector contract: `npm run build`.

#### Manual Verification:

- Existing replay target remains skipped until the UI exists.
- Existing movement, collection, loss, and win tests still pass.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Replay UI and Reset Behavior

### Overview

Add the visible loop: after `lost` or `won`, the player can start a fresh attempt immediately.

### Changes Required:

#### 1. Game reset helper

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Ensure first load and replay use the same initial state.

**Contract**: Extract initial `GameState` creation into a function. Replay resets position, move count, collected gems, status, score-derived HUD, and input marker.

#### 2. Replay control

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Show a direct replay control only after terminal states.

**Contract**: `Play again` is visible and focusable after `lost` or `won`, hidden while active, increments the session attempt count, and does not require page reload or auth.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after replay UI: `npm run lint`.
- Production build passes after replay UI: `npm run build`.
- Local Playwright verifies replay after loss and win: `npm run test:e2e`.

#### Manual Verification:

- Losing then selecting `Play again` returns the board to the initial active state.
- Winning then selecting `Play again` returns the board to the initial active state.
- Attempt count increments on every replay and remains session-scoped.
- Replay is not visible during active play.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Repeat-Play Signal and Docs

### Overview

Promote the skipped repeat-play target and update local guidance to describe the full arcade loop.

### Changes Required:

#### 1. Repeat-play E2E

**File**: `tests/e2e/guardrails.spec.ts`

**Intent**: Prove the primary MVP signal locally.

**Contract**: Replace the skipped replay target marker with an active test that reaches `GAME_GUARDRAIL_THRESHOLDS.replayAttemptTarget` through real terminal-state replays.

#### 2. Local documentation

**File**: `README.md`, `AGENTS.md`

**Intent**: Update local test descriptions now that E2E covers replay and the three-attempt signal.

**Contract**: Docs mention anonymous entry, movement, collection, loss, completion, replay, and repeat-play target; no CI or deploy changes.

### Success Criteria:

#### Automated Verification:

- Formatting check passes for changed docs/tests/source/plan files: `npx prettier --check README.md AGENTS.md src/lib/game-guardrails.ts src/components/game/GameEntry.tsx tests/e2e/guardrails.spec.ts tests/e2e/guardrail-assertions.ts context/changes/replayable-arcade-loop/plan.md context/changes/replayable-arcade-loop/plan-brief.md`.
- Type-aware lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Local Playwright repeat-play smoke passes: `npm run test:e2e`.

#### Manual Verification:

- A fresh browser session can reach three attempts through replay actions.
- Replays happen without reload, auth, or instructions.
- No CI production deploy or Playwright CI workflow is introduced.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change implemented.

---

## Testing Strategy

### Unit Tests:

- No standalone unit tests yet; replay state remains local React state until game logic is extracted.

### Integration Tests:

- Playwright verifies entry, movement, collection, loss, win, replay after terminal states, and the three-attempt target.
- Lint/build verify React/Astro compatibility.

### Manual Testing Steps:

1. Open `/`, lose on the hazard, click `Play again`, and confirm active state with reset score/input.
2. Win by collecting all gems and entering the exit, click `Play again`, and confirm a fresh active attempt.
3. Repeat until the attempt counter reaches `3`.

## Performance Considerations

Replay must be local and synchronous. No network calls, route navigation, or heavy asset work should enter the input or replay path.

## Migration Notes

No data migration is required.

## References

- Roadmap item: `context/foundation/roadmap.md` (`S-04`, `replayable-arcade-loop`)
- Product requirements: `context/foundation/prd.md` (`FR-007`, Success Criteria Primary)
- Existing gameplay: `src/components/game/GameEntry.tsx`
- Guardrail contract: `src/lib/game-guardrails.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Replay Contract

#### Automated

- [x] 1.1 Type-aware lint passes after replay selector contract — 7b72fdd
- [x] 1.2 Production build passes after replay selector contract — 7b72fdd

#### Manual

- [x] 1.3 Existing replay target remains skipped until the UI exists — 7b72fdd
- [x] 1.4 Existing movement, collection, loss, and win tests still pass — 7b72fdd

### Phase 2: Replay UI and Reset Behavior

#### Automated

- [x] 2.1 Type-aware lint passes after replay UI
- [x] 2.2 Production build passes after replay UI
- [x] 2.3 Local Playwright verifies replay after loss and win

#### Manual

- [x] 2.4 Losing then selecting `Play again` returns the board to the initial active state
- [x] 2.5 Winning then selecting `Play again` returns the board to the initial active state
- [x] 2.6 Attempt count increments on every replay and remains session-scoped
- [x] 2.7 Replay is not visible during active play

### Phase 3: Repeat-Play Signal and Docs

#### Automated

- [ ] 3.1 Formatting check passes for changed docs/tests/source/plan files
- [ ] 3.2 Type-aware lint passes
- [ ] 3.3 Production build passes
- [ ] 3.4 Local Playwright repeat-play smoke passes

#### Manual

- [ ] 3.5 Fresh browser session can reach three attempts through replay actions
- [ ] 3.6 Replays happen without reload, auth, or instructions
- [ ] 3.7 No CI production deploy or Playwright CI workflow is introduced
