# Level End States Implementation Plan

## Overview

This plan gives the playable S-02 board real stakes. The player can lose by stepping onto a hazard and can complete the level by collecting every gem and entering the exit.

## Current State Analysis

The game currently supports immediate entry, keyboard movement, blockers, gem collection, score, and local E2E coverage. The exit is visually open from S-01/S-02 but has no gameplay meaning, and there are no hazards or terminal states.

## Desired End State

After S-03, movement stops when the level reaches `lost` or `won`. A hazard tile ends the level immediately with a loss state. The exit completes the level only after all gems are collected. HUD/status text clearly distinguishes active, lost, and won states without adding replay controls.

### Key Discoveries:

- `GameEntry` keeps all board/game state local in one React `GameState`: `src/components/game/GameEntry.tsx`.
- Movement already uses a pure `resolveMove` transition and blocker logic.
- Tests already cover entry, movement, blocked movement, collection, and future replay skip: `tests/e2e/guardrails.spec.ts`.
- S-04 owns replay, so S-03 must not add play-again buttons or attempt reset flows.

## What We're NOT Doing

- Adding replay/restart UI or attempt-loop behavior.
- Adding falling-rock physics, multi-level campaigns, persistence, accounts, leaderboards, analytics, or deployment changes.
- Tuning risk-reward routes beyond making one hazard and the exit meaningful.
- Adding CI Playwright.

## Implementation Approach

Extend the local board model with one hazard tile and an explicit level status. Keep rules deterministic: gems are collectible once, hazards are walkable but immediately lose, and exit only wins when no gems remain. Preserve current controls and tests, then add focused Playwright checks for loss and win.

## Phase 1: End-State Contract

### Overview

Add stable selectors and state vocabulary for active/lost/won outcomes.

### Changes Required:

#### 1. Guardrail selectors

**File**: `src/lib/game-guardrails.ts`

**Intent**: Give tests stable selectors for level status and end-state messaging.

**Contract**: Extend `GAME_GUARDRAIL_TEST_IDS` with levelStatus, hazard, and exit keys without changing existing selector names.

#### 2. State model

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Add level status to the existing game state without changing behavior yet.

**Contract**: Introduce a `LevelStatus` union for `active | lost | won`, include it in `GameState`, and render the active status in the HUD.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after contract changes: `npm run lint`.
- Production build passes after contract changes: `npm run build`.

#### Manual Verification:

- Existing movement and collection behavior still works.
- HUD shows an active level status without win/loss UI.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Hazard and Completion Rules

### Overview

Make hazard and exit tiles affect gameplay.

### Changes Required:

#### 1. Hazard tile

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Add one visible hazard to the board and make stepping onto it lose the level.

**Contract**: Hazard is walkable only as a terminal move. After loss, further movement keys must not change player position, score, gems, or input response.

#### 2. Completion rule

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Make the exit complete the level only after all gems are collected.

**Contract**: Entering exit before all gems are collected should move the player but keep status active. Entering exit after all gems are collected should set status won and freeze movement.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after end-state rules: `npm run lint`.
- Production build passes after end-state rules: `npm run build`.
- Local Playwright verifies loss and completion behavior: `npm run test:e2e`.

#### Manual Verification:

- Stepping onto a hazard shows a loss state and stops further movement.
- Collecting all gems then entering the exit shows a completion state and stops further movement.
- No replay or play-again control appears.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: End-State E2E and Docs

### Overview

Promote end-state behavior into stable tests and update local guidance.

### Changes Required:

#### 1. E2E assertions

**File**: `tests/e2e/guardrails.spec.ts`, `tests/e2e/guardrail-assertions.ts`

**Intent**: Verify both terminal outcomes without coupling tests to CSS.

**Contract**: Add helpers for status text, hazard/exit selectors, and unchanged player position after terminal states. Tests should cover loss on hazard and win after all gems plus exit. Replay target remains skipped.

#### 2. Local documentation

**File**: `README.md`, `AGENTS.md`

**Intent**: Update local E2E descriptions now that they cover level end states.

**Contract**: Docs should mention movement, collection, loss, and completion; no CI or deploy changes.

### Success Criteria:

#### Automated Verification:

- Formatting check passes for changed docs/tests/source/plan files: `npx prettier --check README.md AGENTS.md src/lib/game-guardrails.ts src/components/game/GameEntry.tsx tests/e2e/guardrails.spec.ts tests/e2e/guardrail-assertions.ts context/changes/level-end-states/plan.md context/changes/level-end-states/plan-brief.md`.
- Type-aware lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Local Playwright end-state smoke passes: `npm run test:e2e`.

#### Manual Verification:

- A fresh browser session can lose on the hazard.
- A fresh browser session can win after collecting all gems and entering the exit.
- Terminal states do not offer replay yet.
- No CI production deploy or Playwright CI workflow is introduced.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change implemented.

---

## Testing Strategy

### Unit Tests:

- No standalone unit tests yet; rule helpers remain local until the game model stabilizes further.

### Integration Tests:

- Playwright verifies entry, movement, collection, loss, win, and replay-not-yet scope.
- Lint/build verify React/Astro compatibility.

### Manual Testing Steps:

1. Open `/` and move into the hazard; confirm loss and frozen movement.
2. Open a fresh session, collect all gems, enter exit, and confirm completion.
3. Confirm no replay control appears.

## Performance Considerations

End-state rules must remain local and synchronous. No network calls or heavy assets should enter the input path.

## Migration Notes

No data migration is required.

## References

- Roadmap item: `context/foundation/roadmap.md` (`S-03`, `level-end-states`)
- Product requirements: `context/foundation/prd.md` (`FR-005`, `FR-006`)
- Existing gameplay: `src/components/game/GameEntry.tsx`
- Guardrail contract: `src/lib/game-guardrails.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: End-State Contract

#### Automated

- [x] 1.1 Type-aware lint passes after contract changes
- [x] 1.2 Production build passes after contract changes

#### Manual

- [x] 1.3 Existing movement and collection behavior still works
- [x] 1.4 HUD shows an active level status without win/loss UI

### Phase 2: Hazard and Completion Rules

#### Automated

- [ ] 2.1 Type-aware lint passes after end-state rules
- [ ] 2.2 Production build passes after end-state rules
- [ ] 2.3 Local Playwright verifies loss and completion behavior

#### Manual

- [ ] 2.4 Stepping onto a hazard shows a loss state and stops further movement
- [ ] 2.5 Collecting all gems then entering the exit shows a completion state and stops further movement
- [ ] 2.6 No replay or play-again control appears

### Phase 3: End-State E2E and Docs

#### Automated

- [ ] 3.1 Formatting check passes for changed docs/tests/source/plan files
- [ ] 3.2 Type-aware lint passes
- [ ] 3.3 Production build passes
- [ ] 3.4 Local Playwright end-state smoke passes

#### Manual

- [ ] 3.5 Fresh browser session can lose on the hazard
- [ ] 3.6 Fresh browser session can win after collecting all gems and entering the exit
- [ ] 3.7 Terminal states do not offer replay yet
- [ ] 3.8 No CI production deploy or Playwright CI workflow is introduced
