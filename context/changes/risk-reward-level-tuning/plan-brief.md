# Risk-Reward Level Tuning - Plan Brief

> Full plan: `context/changes/risk-reward-level-tuning/plan.md`

## What & Why

This change makes the first level express the product's core risk-reward rule: finish safely after the quota, or risk an optional gem for a better score.

## Starting Point

S-04 completed the arcade loop with replay and a 3-attempt local signal. Completion still requires every gem, so the level does not yet offer a meaningful score-risk choice.

## Desired End State

The HUD shows a required gem quota and optional bonus progress. The player can win with a lower score after the quota or collect the optional gem near a hazard for a higher score before exiting.

## Key Decisions Made

| Decision        | Choice                            | Why (1 sentence)                                 |
| --------------- | --------------------------------- | ------------------------------------------------ |
| Completion rule | Quota below total gems            | Creates a real choice without adding new systems |
| Bonus reward    | Existing score per gem            | Keeps scoring legible and local                  |
| Risk placement  | Optional gem adjacent to hazard   | Makes the better score route visibly dangerous   |
| Existing hazard | Keep quick-loss hazard near start | Preserves replay and loss guardrails             |
| Test level      | One tuned level                   | Matches MVP non-goal of no campaign              |

## Scope

**In scope:**

- Quota and bonus HUD selectors.
- Completion after required gems.
- Optional high-score gem near a hazard.
- E2E for safe win, risky win, adjacent hazard loss, replay, and mobile replay visibility.

**Out of scope:**

- Physics, enemies, extra levels, persistence, auth, leaderboards, analytics, deploy, or CI Playwright.

## Architecture / Approach

Keep the gameplay model local in `GameEntry`. Add quota constants and derive quota/bonus HUD values from collected gems and total gems.

## Phases at a Glance

| Phase                                 | What it delivers                           | Key risk                                 |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| 1. Quota Contract                     | Stable selectors and HUD vocabulary        | Adding confusing HUD text                |
| 2. Safer and Riskier Completion Paths | Tuned completion rule and hazard placement | Breaking existing replay/end-state tests |
| 3. Risk-Reward E2E and Docs           | Stable local coverage and guidance         | Long path tests becoming brittle         |

**Prerequisites:** S-04 implemented and reviewed.  
**Estimated effort:** Medium gameplay tuning slice across 3 phases.

## Open Risks & Assumptions

- The optional gem is still static; more dynamic danger can come after MVP feedback.
- HUD labels are enough for the first version; no separate tutorial text is added.

## Success Criteria (Summary)

- Player can win safely after the quota.
- Player can take a visible risk for a higher score.
- Replay and the 3-attempt signal still work.
- `npm run lint`, `npm run build`, and `npm run test:e2e` pass.
