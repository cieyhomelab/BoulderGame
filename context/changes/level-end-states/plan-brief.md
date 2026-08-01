# Level End States - Plan Brief

> Full plan: `context/changes/level-end-states/plan.md`

## What & Why

This change adds stakes to the playable board. The player can lose by stepping onto a hazard and can complete the level after collecting every gem and reaching the exit.

## Starting Point

S-02 added movement, blockers, gem collection, score, and local browser tests. There are no hazards, win/loss states, or terminal movement rules yet.

## Desired End State

The game has explicit `active`, `lost`, and `won` states. Hazard and exit outcomes are visible, movement freezes after terminal states, and replay remains intentionally absent until S-04.

## Key Decisions Made

| Decision        | Choice                        | Why (1 sentence)                                             |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| Loss trigger    | Step onto hazard              | Gives immediate visible cost without adding physics yet      |
| Win trigger     | All gems collected, then exit | Keeps completion tied to collection rather than rushing exit |
| Terminal motion | Freeze after won/lost         | Makes outcomes unambiguous before replay exists              |
| Replay scope    | Out of S-03                   | S-04 owns the arcade loop and repeat-play attempt target     |
| State location  | Local React state             | Matches S-02 and keeps input path synchronous                |

## Scope

**In scope:**

- Level status selectors and HUD.
- One visible hazard and loss state.
- Exit completion after all gems are collected.
- Movement freeze after terminal states.
- Local Playwright coverage for loss and win.

**Out of scope:**

- Replay/restart, falling rocks, physics, multi-level campaign, persistence, deployment, CI Playwright.

## Architecture / Approach

Extend `GameEntry`'s local game-state transition with status resolution. Hazards and exit are just board tiles for now; rules remain deterministic and synchronous.

## Phases at a Glance

| Phase                          | What it delivers           | Key risk                             |
| ------------------------------ | -------------------------- | ------------------------------------ |
| 1. End-State Contract          | Status selectors and HUD   | Breaking existing S-02 behavior      |
| 2. Hazard and Completion Rules | Loss/win rules and freeze  | Accidentally adding replay scope     |
| 3. End-State E2E and Docs      | Browser tests and guidance | Over-coupling tests to board styling |

**Prerequisites:** S-02 implemented and reviewed.  
**Estimated effort:** Medium gameplay slice across 3 phases.

## Open Risks & Assumptions

- Hazard is static in S-03; dynamic danger comes later if needed.
- The first win path can be simple; S-05 tunes risk-reward.

## Success Criteria (Summary)

- Player can lose on a hazard and win after all gems plus exit.
- Terminal states freeze movement and do not offer replay.
- `npm run lint`, `npm run build`, and `npm run test:e2e` pass.
