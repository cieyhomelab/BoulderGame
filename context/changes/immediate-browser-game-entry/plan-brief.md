# Immediate Browser Game Entry - Plan Brief

> Full plan: `context/changes/immediate-browser-game-entry/plan.md`

## What & Why

This change makes `/` the actual BoulderGame entry point. A retro-game fan should open the web app and immediately see a ready game level without logging in, reading onboarding, or landing on starter/auth UI.

## Starting Point

The current root route renders the starter `Welcome` component with "10x Astro Starter" branding and sign-in/sign-up CTAs. F-01 already created guardrail test IDs and session-local attempt helpers, but the Playwright test still asserts the starter page while the future game-ready test is skipped.

## Desired End State

The root route has title `BoulderGame`, shows a no-login game surface, hides Supabase config warnings on the MVP game path, and starts the first level immediately. A fresh session records attempt `1` through the F-01 sessionStorage contract and exposes the game-ready marker for browser verification.

## Key Decisions Made

| Decision            | Choice                                 | Why (1 sentence)                                                                     |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Root path           | Replace starter page with game surface | FR-001 and FR-002 require no-login immediate play from the browser.                  |
| Auth scaffold       | Bypass on `/`, do not delete           | Roadmap marks deletion as optional and deletion would expand S-01 unnecessarily.     |
| Config warnings     | Suppress only on game route            | Supabase is optional for MVP, but auth pages can still benefit from warnings.        |
| Game implementation | React island inside Astro route        | Attempt counting needs browser sessionStorage while Astro keeps route/layout simple. |
| Input guardrail     | Keep out of passing S-01 assertions    | Real input timing belongs to S-02's controllable board work.                         |
| E2E scope           | Local game-entry smoke                 | S-01 stabilizes readiness locally without adding CI browser complexity.              |

## Scope

**In scope:**

- Replace `/` starter UI with BoulderGame title and game entry.
- Hide auth/Supabase friction from the root MVP path.
- Add a minimal client-side level-ready game entry component.
- Expose `game-entry-surface`, `game-ready`, and exact first-attempt marker.
- Update Playwright smoke and local docs for the real game entry.

**Out of scope:**

- Movement, collection, hazards, end states, replay loop, scoring, and physics.
- Removing auth/dashboard/Supabase scaffold.
- CI Playwright graduation or production deploy automation.
- Persistent player data, accounts, analytics, or leaderboards.

## Architecture / Approach

Astro owns the root route and layout, while a small React island owns browser-only session attempt counting and the visible level-ready surface. The implementation reuses F-01 constants instead of inventing selectors and keeps the first route free of network or auth dependencies.

## Phases at a Glance

| Phase                          | What it delivers                                     | Key risk                                                       |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------- |
| 1. Root Route and Layout Shell | `/` is BoulderGame-branded and free of auth friction | Accidentally affecting auth/dashboard warning behavior         |
| 2. Immediate Level Entry       | Ready first-level React island and attempt marker    | Counting attempts more than once during hydration/re-render    |
| 3. Guardrail E2E Stabilization | Executable Playwright game-entry smoke and docs      | Claiming input/replay guardrails before later slices implement |

**Prerequisites:** F-01 guardrails complete and reviewed.  
**Estimated effort:** Small-to-medium UI foundation change across 3 phases.

## Open Risks & Assumptions

- Starter `Welcome` may remain unused after S-01; cleanup can happen later with auth scaffold decisions.
- The board in S-01 is intentionally not controllable; S-02 owns movement and input-response timing.
- Visual polish should be enough to feel like a retro arcade game, but S-05 owns risk-reward tuning.

## Success Criteria (Summary)

- A fresh browser session opens `/` and sees a ready BoulderGame level immediately without login.
- The first attempt is recorded and visible as `1` through the F-01 guardrail contract.
- `npm run lint`, `npm run build`, and `npm run test:e2e` pass with starter root assertions removed.
