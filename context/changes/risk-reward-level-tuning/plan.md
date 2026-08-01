# Risk-Reward Level Tuning Implementation Plan

## Overview

This plan gives the first level an explicit risk-reward choice. The player can finish after collecting the required gem quota, or collect an optional gem near a hazard for a better score before exiting.

## Current State Analysis

The game has a complete local arcade loop: anonymous start, movement, collection, loss, win, replay, and a 3-attempt E2E signal. Completion currently requires every gem, so there is no meaningful choice between safer completion and a higher-risk score route.

## Desired End State

The HUD communicates a small gem quota and optional bonus progress. The exit wins once the quota is met, while remaining gems can still improve score. A visible hazard next to the optional gem makes the better score route riskier without adding physics or instructions.

### Key Discoveries:

- `GameEntry` derives score from collected gems and completion from `INITIAL_GEM_COUNT`.
- The current loss hazard left of the start supports quick replay/loss tests and should remain stable.
- The bottom route can host the optional high-score gem and an adjacent hazard without requiring a new level system.
- S-05 is the final MVP slice, so local E2E should cover both safe and risky outcomes.

## What We're NOT Doing

- Adding falling-rock physics, enemies, randomization, extra levels, campaigns, persistence, analytics, leaderboards, or auth.
- Changing deployment, CI Playwright, or public infra.
- Adding text instructions outside the game HUD.

## Implementation Approach

Keep rules deterministic and local. Introduce a required gem quota lower than the total gem count, preserve score-per-gem, place the optional gem next to a hazard, and update tests to prove both completion paths.

## Phase 1: Quota Contract

### Overview

Add stable quota/bonus vocabulary and selectors.

### Changes Required:

#### 1. Guardrail selectors

**File**: `src/lib/game-guardrails.ts`

**Intent**: Give E2E tests stable access to quota and optional bonus progress.

**Contract**: Add `gemQuota` and `bonusGems` keys to `GAME_GUARDRAIL_TEST_IDS` without renaming existing keys.

#### 2. HUD contract

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Introduce a required gem quota and expose it in the HUD without changing completion behavior yet.

**Contract**: Add constants for required gems and optional gems. Render quota and bonus progress in HUD.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after quota contract: `npm run lint`.
- Production build passes after quota contract: `npm run build`.

#### Manual Verification:

- Existing game loop still behaves as before.
- HUD exposes quota and bonus progress without requiring external instructions.

---

## Phase 2: Safer and Riskier Completion Paths

### Overview

Tune level rules and layout around a visible optional risk.

### Changes Required:

#### 1. Completion quota

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Let the player finish after the required quota rather than every gem.

**Contract**: Exit sets status `won` when collected gems are greater than or equal to required quota. Remaining gems are optional bonus score.

#### 2. Risky optional gem

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Make the higher score route visibly riskier.

**Contract**: Keep the quick-loss hazard near start. Add an adjacent hazard near the optional bottom gem so moving carelessly from the bonus gem can lose the level, while a safer route can still bypass it.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after level tuning: `npm run lint`.
- Production build passes after level tuning: `npm run build`.
- Local Playwright verifies safe completion and risky higher-score completion: `npm run test:e2e`.

#### Manual Verification:

- Player can win after collecting the quota and entering the exit with one bonus gem left.
- Player can collect the optional gem for higher score and still win by avoiding the adjacent hazard.
- Stepping into either hazard still loses.
- Replay still resets quota, bonus, score, status, and attempt count.

---

## Phase 3: Risk-Reward E2E and Docs

### Overview

Promote risk-reward behavior into stable local checks and update local guidance.

### Changes Required:

#### 1. E2E coverage

**File**: `tests/e2e/guardrails.spec.ts`, `tests/e2e/guardrail-assertions.ts`

**Intent**: Verify the actual player choice.

**Contract**: Tests cover safe quota win, optional risky gem for higher score, adjacent hazard loss, replay target, and mobile replay visibility.

#### 2. Local documentation

**File**: `README.md`, `AGENTS.md`

**Intent**: Update local E2E descriptions now that they cover the risk-reward route.

**Contract**: Docs mention risk-reward tuning in local E2E coverage; no CI or deploy changes.

### Success Criteria:

#### Automated Verification:

- Formatting check passes for changed docs/tests/source/plan files: `npx prettier --check README.md AGENTS.md src/lib/game-guardrails.ts src/components/game/GameEntry.tsx tests/e2e/guardrails.spec.ts tests/e2e/guardrail-assertions.ts context/changes/risk-reward-level-tuning/plan.md context/changes/risk-reward-level-tuning/plan-brief.md`.
- Type-aware lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Local Playwright risk-reward smoke passes: `npm run test:e2e`.

#### Manual Verification:

- A fresh browser session offers a visible safer completion and a riskier higher-score route.
- The player can replay and reach the 3-attempt signal after the tuned level.
- No CI production deploy or Playwright CI workflow is introduced.

---

## Testing Strategy

### Unit Tests:

- No standalone unit tests yet; local gameplay rules remain in `GameEntry` until extraction is justified.

### Integration Tests:

- Playwright verifies safe win, risky higher-score win, hazard loss, replay reset, repeat-play target, and mobile replay visibility.

### Manual Testing Steps:

1. Collect two gems, enter the exit, and confirm a lower-score win with one bonus gem left.
2. Replay, collect all three gems, avoid the adjacent hazard, and confirm a higher-score win.
3. Step into the adjacent hazard and confirm loss.

## Performance Considerations

Risk-reward tuning remains synchronous local state. No network, persistence, or asset-heavy work enters the input path.

## Migration Notes

No data migration is required.

## References

- Roadmap item: `context/foundation/roadmap.md` (`S-05`, `risk-reward-level-tuning`)
- Product requirements: `context/foundation/prd.md` (`FR-004`, `FR-005`, `FR-006`, Business Logic)
- Existing gameplay: `src/components/game/GameEntry.tsx`
- Guardrail contract: `src/lib/game-guardrails.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Quota Contract

#### Automated

- [ ] 1.1 Type-aware lint passes after quota contract
- [ ] 1.2 Production build passes after quota contract

#### Manual

- [ ] 1.3 Existing game loop still behaves as before
- [ ] 1.4 HUD exposes quota and bonus progress without requiring external instructions

### Phase 2: Safer and Riskier Completion Paths

#### Automated

- [ ] 2.1 Type-aware lint passes after level tuning
- [ ] 2.2 Production build passes after level tuning
- [ ] 2.3 Local Playwright verifies safe completion and risky higher-score completion

#### Manual

- [ ] 2.4 Player can win after collecting the quota and entering the exit with one bonus gem left
- [ ] 2.5 Player can collect the optional gem for higher score and still win by avoiding the adjacent hazard
- [ ] 2.6 Stepping into either hazard still loses
- [ ] 2.7 Replay still resets quota, bonus, score, status, and attempt count

### Phase 3: Risk-Reward E2E and Docs

#### Automated

- [ ] 3.1 Formatting check passes for changed docs/tests/source/plan files
- [ ] 3.2 Type-aware lint passes
- [ ] 3.3 Production build passes
- [ ] 3.4 Local Playwright risk-reward smoke passes

#### Manual

- [ ] 3.5 Fresh browser session offers a visible safer completion and a riskier higher-score route
- [ ] 3.6 Player can replay and reach the 3-attempt signal after the tuned level
- [ ] 3.7 No CI production deploy or Playwright CI workflow is introduced
