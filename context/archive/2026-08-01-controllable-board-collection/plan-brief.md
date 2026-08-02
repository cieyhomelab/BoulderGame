# Controllable Board and Collection - Plan Brief

> Full plan: `context/changes/controllable-board-collection/plan.md`

## What & Why

This change makes the first BoulderGame screen playable. After S-02, the player can move on the board and collect gems, turning S-01's ready screen into the first real arcade interaction.

## Starting Point

S-01 added the anonymous game entry, session attempt counter, and a static board. The current board has no keyboard input, no player position state, and no collectible state.

## Desired End State

The player can use arrow keys or WASD to move one tile at a time, cannot pass through walls or rocks, and can collect gems. The HUD updates immediately, and Playwright verifies the 100ms input-response marker for an accepted move.

## Key Decisions Made

| Decision        | Choice                         | Why (1 sentence)                                                |
| --------------- | ------------------------------ | --------------------------------------------------------------- |
| Tile set        | floor, wall, player, gem, rock | Enough to prove movement/collection while leaving hazards later |
| State location  | Local React state              | Fastest MVP path and matches no-server gameplay constraint      |
| Controls        | Arrow keys and WASD            | Familiar desktop controls for retro arcade play                 |
| Blockers        | Walls and rocks only           | Rocks block in S-02; falling/hazards belong to S-03             |
| Input guardrail | Accepted moves only            | Measures real response without rewarding blocked/invalid input  |
| CI scope        | Local E2E only                 | Browser CI remains out of scope until explicitly planned        |

## Scope

**In scope:**

- Board state helpers and stable test IDs.
- Keyboard movement through walkable tiles.
- Blocked movement against walls/rocks.
- Gem collection and HUD updates.
- Local Playwright coverage for movement and collection.

**Out of scope:**

- Hazards, falling rocks, win/loss, replay, physics, scoring balance, and risk-reward tuning.
- Server persistence, auth, analytics, deployment, and CI Playwright.

## Architecture / Approach

Keep the game loop client-local in `GameEntry`. Use typed level helpers to derive board state, player coordinate, blockers, gems remaining, and score; expose meaningful selectors from `game-guardrails.ts` for Playwright.

## Phases at a Glance

| Phase                   | What it delivers                     | Key risk                                      |
| ----------------------- | ------------------------------------ | --------------------------------------------- |
| 1. Board State Contract | Typed board helpers and selectors    | Over-abstracting before rules stabilize       |
| 2. Keyboard Movement    | Arrow/WASD movement and input marker | Event handling that misses focus/key variants |
| 3. Gem Collection & HUD | Collectibles, score, and E2E         | Accidentally implying win/replay states       |

**Prerequisites:** S-01 implemented and reviewed.  
**Estimated effort:** Medium UI/gameplay slice across 3 phases.

## Open Risks & Assumptions

- The first board is intentionally tiny and hand-authored; S-05 can tune it later.
- S-02 treats rocks as blockers only.
- Movement uses keyboard first because the MVP targets desktop browsers.

## Success Criteria (Summary)

- Player movement works with arrow keys and WASD.
- Gems disappear and HUD values update after collection.
- `npm run lint`, `npm run build`, and `npm run test:e2e` pass with movement/collection checks.
