# Replayable Arcade Loop - Plan Brief

> Full plan: `context/changes/replayable-arcade-loop/plan.md`

## What & Why

This change closes the MVP arcade loop. A player who wins or loses can immediately start another attempt, which is the core signal for "miodnosc".

## Starting Point

S-03 added loss, completion, and frozen terminal states. Replay is still intentionally absent, and the repeat-play E2E target remains skipped.

## Desired End State

Terminal states show a focused `Play again` control. Activating it resets the board and increments the existing session attempt counter. Local E2E reaches at least three attempts through real replay actions.

## Key Decisions Made

| Decision          | Choice                               | Why (1 sentence)                                       |
| ----------------- | ------------------------------------ | ------------------------------------------------------ |
| Replay scope      | Same level reset                     | Matches the one-level MVP and avoids campaign scope    |
| Attempt count     | Existing sessionStorage counter      | Already matches the no-auth MVP and local guardrail    |
| Replay visibility | Terminal states only                 | Keeps active play uncluttered                          |
| Reset path        | Shared initial state helper          | Prevents replay state drift from first load            |
| E2E target        | Promote skipped three-attempt marker | Turns the primary success criterion into a local check |

## Scope

**In scope:**

- Replay selectors and E2E helper contract.
- `Play again` control after win/loss.
- Local game-state reset and session attempt increment.
- Active E2E for the three-attempt repeat-play target.
- Local documentation updates.

**Out of scope:**

- Persistence, auth, leaderboards, analytics, campaigns, deployment, CI Playwright, or risk-reward level redesign.

## Architecture / Approach

Replay stays inside `GameEntry` as local React state. First load and replay both use the same initial-state helper, and the existing guardrail module remains the stable test contract.

## Phases at a Glance

| Phase                           | What it delivers               | Key risk                               |
| ------------------------------- | ------------------------------ | -------------------------------------- |
| 1. Replay Contract              | Selectors and E2E helpers      | Breaking existing guardrail IDs        |
| 2. Replay UI and Reset Behavior | Visible replay loop            | Incomplete reset after terminal states |
| 3. Repeat-Play Signal and Docs  | Three-attempt E2E and guidance | Test fragility from long paths         |

**Prerequisites:** S-03 and F-02 implemented and reviewed.  
**Estimated effort:** Medium gameplay slice across 3 phases.

## Open Risks & Assumptions

- Replay returns to the same static level; S-05 tunes the level layout later.
- Attempt count remains per browser session, not persistent across visits.

## Success Criteria (Summary)

- Player can replay immediately after loss or win.
- Replay resets board state and increments the attempt counter.
- A local browser test reaches at least three attempts.
- `npm run lint`, `npm run build`, and `npm run test:e2e` pass.
