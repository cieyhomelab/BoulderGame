# Performance Play Signal Guardrails - Plan Brief

> Full plan: `context/changes/performance-play-signal-guardrails/plan.md`

## What & Why

This change creates the minimum guardrail layer for BoulderGame's MVP: fast first-session readiness, responsive input, and repeat-play signal. It exists because the roadmap's first foundation must unlock `S-01`, `S-02`, and `S-04` without prematurely building the full game loop.

## Starting Point

The app currently renders the starter landing page, auth links, and Supabase-oriented scaffold. The repo has lint/build CI, but no test runner, no browser smoke harness, and no game-specific performance or replay contract.

## Desired End State

The repo has a canonical guardrail module with PRD thresholds and test-facing selectors. A local Playwright smoke command verifies the app can load without auth gating and gives later game slices a reusable path for readiness/input/replay assertions. CI remains unchanged until the first game-entry slice stabilizes the UI.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Scope | Lightweight contract plus first harness | Gives real verification value without turning F-01 into game implementation. |
| E2E tool | Playwright | Browser-level tests fit a web arcade game and can later verify input/replay behavior. |
| First-session metric | Time to game-ready surface | This matches the PRD better than generic page-load metrics. |
| Input response | Event contract plus future test hook | Avoids fake benchmarking before a real controllable board exists. |
| Replay signal | Session-local attempt counter | Matches the no-auth/no-database MVP scope. |
| CI timing | Local script now, CI later | Keeps CI stable until S-01 introduces the real game-ready surface. |

## Scope

**In scope:**

- Guardrail constants for 3-second start, 100 ms input response, and 3 attempts.
- Stable selector/test-id contract for future game UI.
- Session-local attempt-counter contract.
- Playwright config, local E2E script, and starter smoke test.
- README and AGENTS.md updates for the local verification workflow.

**Out of scope:**

- Real game board, movement, hazards, collection, win/loss, and replay loop.
- Supabase/auth cleanup.
- CI integration for Playwright.
- Cloudflare deployment fixes.
- Analytics, profiles, leaderboards, and persisted play history.

## Architecture / Approach

Add a small `src/lib/game-guardrails.ts` contract module, then use Playwright as the browser harness around the existing Astro app. The first executable test proves the harness and no-auth entry behavior; future slices wire the exported selectors into actual gameplay.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Guardrail Contract | Canonical thresholds, selectors, and session attempt contract | Overbuilding a foundation into game logic |
| 2. Playwright Smoke Harness | Local browser smoke command and config | Harness can be too future-facing if tests fail before game UI exists |
| 3. Attempt Signal and Verification Documentation | Discoverable README/AGENTS workflow and CI-later note | Future agents may treat local-only E2E as optional |

**Prerequisites:** Existing npm install and Astro starter scaffold.  
**Estimated effort:** Three implementation phases; no calendar estimate.

## Open Risks & Assumptions

- The smoke harness must pass before the real game exists, so future selectors should be helper contracts until S-01/S-02/S-04 wire them.
- Playwright browser installation may need network access locally or in CI when it is eventually enabled.
- Existing Supabase/auth scaffold can keep distracting from no-auth game entry until a later slice removes or bypasses it.

## Success Criteria (Summary)

- `npm run test:e2e` exists and passes locally.
- Guardrail thresholds are encoded once and match the PRD.
- README and AGENTS.md explain when and how future agents should run the guardrail checks.
