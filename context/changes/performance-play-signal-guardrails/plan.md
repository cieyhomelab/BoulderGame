# Performance Play Signal Guardrails Implementation Plan

## Overview

This plan adds the smallest useful guardrail layer for BoulderGame's MVP: a documented code contract for first-session readiness, input response, and repeated attempts, plus a local Playwright smoke harness. It deliberately does not build the game loop; it gives `S-01`, `S-02`, and `S-04` a measurable contract to satisfy when those slices implement the actual player experience.

## Current State Analysis

The project is an Astro/React starter, not yet a game. The root route renders the starter `Welcome` component through `Layout`, and the visible UI is auth-oriented rather than play-oriented. The repository has lint/build scripts and GitHub CI for lint/build, but no test runner, browser smoke tests, or app-level performance checks.

The PRD defines three guardrail targets: first play session starts in under 3 seconds, input response appears in under 100 ms, and MVP success is proven when the player plays at least three times. The roadmap marks this foundation as ready and says it unlocks `S-01`, `S-02`, and `S-04`.

## Desired End State

After this change, the repo has a stable guardrail contract that future game UI must implement. Playwright can run locally against the app and verify the current page/harness health without requiring a complete game board. The plan leaves CI integration for a later change, while making the local command obvious enough for agents to run before and after gameplay work.

### Key Discoveries:

- The root page currently imports `Welcome` and wraps it in `Layout`: `src/pages/index.astro:2`.
- `Welcome` is starter/auth UI with sign-in and sign-up calls to action, not a game surface: `src/components/Welcome.astro:35`.
- `Layout` renders Supabase missing-config banners before the page slot, which can distract from no-auth game entry in later slices: `src/layouts/Layout.astro:22`.
- `package.json` has `dev`, `build`, `preview`, `lint`, `lint:fix`, and `format`, but no test script: `package.json:5`.
- Current CI runs install, Astro sync, lint, and build only: `.github/workflows/ci.yml:18`.
- The PRD sets input response under 100 ms, first session under 3 seconds, and desktop browser support: `context/foundation/prd.md:81`.

## What We're NOT Doing

- Building the Boulder Dash board, player movement, collection logic, hazards, win/loss states, or replay loop.
- Removing the Supabase/auth scaffold yet; later game-entry work decides whether to delete or bypass it.
- Adding online analytics, database persistence, accounts, leaderboards, or cross-session retention tracking.
- Adding Playwright to GitHub Actions in this change.
- Solving Cloudflare deployment naming, sitemap `site`, or production deployment setup; those belong to `public-playtest-deploy-path`.

## Implementation Approach

Add a small game-guardrail module under `src/lib/` that exports thresholds, stable selector names, and the local attempt-counter contract. Add Playwright as a local E2E harness with one executable smoke spec and helper expectations that future slices can reuse once the real game screen exists. Keep the package scripts simple: local `npm run test:e2e` is available, but CI remains lint/build until the first game slice stabilizes the UI.

## Critical Implementation Details

### Performance Constraints

Do not measure `input <100 ms` by benchmarking a fake component. The contract should define how future game interactions expose their response, while the executable F-01 tests prove the harness works and that the entry surface remains reachable.

### Debug & Observability

Use Playwright trace retention only on failures. This keeps the local harness useful for agents without making every successful smoke run produce large artifacts.

## Phase 1: Guardrail Contract

### Overview

Define the constants and conventions that future gameplay slices must satisfy: first-session readiness, input-response timing, and local attempt count.

### Changes Required:

#### 1. Guardrail constants and selectors

**File**: `src/lib/game-guardrails.ts`

**Intent**: Create the canonical place for MVP guardrail thresholds and test-facing selectors. Future slices should import these constants or match these selector names instead of inventing their own ad hoc values.

**Contract**: Export a plain object or named constants for `firstSessionReadyMs = 3000`, `inputResponseMs = 100`, and `replayAttemptTarget = 3`; export stable selector/test-id names for the future game entry surface, game-ready marker, input-response marker, and attempt counter.

#### 2. Attempt counter contract

**File**: `src/lib/game-guardrails.ts`

**Intent**: Define how replay attempts are counted locally for the MVP without accounts, database tables, or analytics.

**Contract**: Provide a session-scoped key name and minimal helper contract for incrementing/resetting attempts in browser storage. The helper must be safe to import in browser-only React code and must not require Supabase or server APIs.

#### 3. Planning handoff notes

**File**: `context/changes/performance-play-signal-guardrails/plan.md`

**Intent**: Keep downstream implementers aware that S-01/S-02/S-04 must attach the exported selectors to the real game UI.

**Contract**: The plan's References and Desired End State must name the exact roadmap slices that consume this contract.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes with the new guardrail module: `npm run lint`.
- Production build passes with the new guardrail module: `npm run build`.

#### Manual Verification:

- Guardrail constants match PRD thresholds: 3 seconds, 100 ms, and 3 attempts.
- The guardrail module has no dependency on Supabase, auth routes, server-only env, or database state.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Playwright Smoke Harness

### Overview

Add the smallest browser-level harness that proves the app can be launched and inspected locally, while leaving full gameplay assertions to later slices.

### Changes Required:

#### 1. Playwright dependency and scripts

**File**: `package.json`

**Intent**: Add a standard local E2E command that agents can discover and run consistently.

**Contract**: Add `@playwright/test` as a dev dependency and add scripts such as `test:e2e` for `playwright test` and optionally `test:e2e:ui` for UI mode. Do not modify `.github/workflows/ci.yml` in this change.

#### 2. Playwright configuration

**File**: `playwright.config.ts`

**Intent**: Configure Playwright to start the Astro dev server and run a lightweight desktop-browser smoke project.

**Contract**: Use the app's existing dev server command, set a base URL, keep the browser scope narrow for this foundation, and configure traces to be retained only on failure or retry. The config must not require Cloudflare account access or production deployment.

#### 3. Executable smoke spec

**File**: `tests/e2e/guardrails.spec.ts`

**Intent**: Prove that the local harness works against `/` today and provide named helper expectations that future game slices can reuse.

**Contract**: The executable smoke test should navigate to `/`, verify the app shell loads, and assert the page is not blocked by an auth requirement. Future-facing helper assertions should use the selectors from `src/lib/game-guardrails.ts`, but should not fail until a later slice implements the real game-ready marker.

### Success Criteria:

#### Automated Verification:

- Playwright browsers/dependencies install successfully for local use: `npx playwright install`.
- Local browser smoke tests pass: `npm run test:e2e`.
- Type-aware lint still passes: `npm run lint`.
- Production build still passes: `npm run build`.

#### Manual Verification:

- A developer can run `npm run test:e2e` from a clean checkout after dependency installation.
- The smoke report or failure output is understandable enough to show whether `/` failed to load, required auth, or missed the expected guardrail contract.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Attempt Signal and Verification Documentation

### Overview

Document how future slices use the guardrail contract and when the local smoke harness should graduate into CI.

### Changes Required:

#### 1. MVP guardrail documentation

**File**: `README.md`

**Intent**: Give future implementers and agents a concise, visible description of the game-specific guardrails.

**Contract**: Add a BoulderGame MVP guardrails section that names the three thresholds, explains that attempt count is session-local, and lists the local verification commands.

#### 2. Agent-facing rule update

**File**: `AGENTS.md`

**Intent**: Make the new local E2E command discoverable for future agent runs without duplicating the full plan.

**Contract**: Update the build/test command section to include `npm run test:e2e` once the script exists, with a note that it is local-only until CI is explicitly updated.

#### 3. CI graduation note

**File**: `context/changes/performance-play-signal-guardrails/plan.md`

**Intent**: Record the user's decision that smoke checks are local now and CI later, so future planning does not treat missing CI integration as accidental drift.

**Contract**: The plan and brief must state that CI integration is out of scope until S-01 stabilizes the game-ready surface.

### Success Criteria:

#### Automated Verification:

- README and AGENTS formatting passes through the repo formatter if run: `npm run format`.
- Local smoke tests still pass after docs updates: `npm run test:e2e`.
- Type-aware lint still passes: `npm run lint`.
- Production build still passes: `npm run build`.

#### Manual Verification:

- README clearly states how to run the new guardrail checks.
- AGENTS.md tells future agents when to run `npm run test:e2e`.
- The plan leaves no open implementation decision about thresholds, harness scope, attempt counting, or CI timing.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change implemented.

---

## Testing Strategy

### Unit Tests:

- No separate unit test runner exists yet, and this change should not introduce one solely for constants.
- Guardrail helper behavior can be covered through Playwright or future component tests when the first game slice introduces the real UI.

### Integration Tests:

- Add Playwright smoke coverage for app launch and no-auth access to `/`.
- Prepare reusable helper expectations for future `game-ready`, `input-response`, and `attempt-counter` assertions.

### Manual Testing Steps:

1. Install Playwright browser binaries for local use.
2. Run `npm run test:e2e` and confirm the app launches without requiring auth.
3. Run `npm run lint` and confirm strict TS/React/Astro linting passes.
4. Run `npm run build` and confirm the Cloudflare-targeted Astro build still completes.
5. Review README and AGENTS.md to confirm the new guardrail workflow is discoverable.

## Performance Considerations

The executable F-01 smoke test should not claim that real gameplay input is under 100 ms before there is a controllable board. Instead, it should establish the threshold, selector contract, and helper path that `S-02` must wire into actual player input. The first-session threshold should be interpreted as time from entering `/` to the game-ready surface once `S-01` exists.

## Migration Notes

No data migration is required. This plan intentionally avoids Supabase, auth state, database tables, and persisted analytics because the PRD requires no accounts and a single user session.

## References

- Roadmap item: `context/foundation/roadmap.md` (`F-01`, `performance-play-signal-guardrails`)
- Product requirements: `context/foundation/prd.md`
- Infrastructure constraints: `context/foundation/infrastructure.md`
- Current app entry: `src/pages/index.astro:2`
- Current starter UI: `src/components/Welcome.astro:35`
- Current scripts: `package.json:5`
- Current CI: `.github/workflows/ci.yml:18`
- Playwright docs: https://playwright.dev/docs/intro
- Playwright traces: https://playwright.dev/docs/trace-viewer
- Web Vitals context: https://web.dev/articles/vitals

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Guardrail Contract

#### Automated

- [x] 1.1 Type-aware lint passes with the new guardrail module — 569a184
- [x] 1.2 Production build passes with the new guardrail module — 569a184

#### Manual

- [x] 1.3 Guardrail constants match PRD thresholds — 569a184
- [x] 1.4 Guardrail module has no dependency on Supabase, auth routes, server-only env, or database state — 569a184

### Phase 2: Playwright Smoke Harness

#### Automated

- [x] 2.1 Playwright browsers/dependencies install successfully for local use
- [x] 2.2 Local browser smoke tests pass
- [x] 2.3 Type-aware lint still passes
- [x] 2.4 Production build still passes

#### Manual

- [x] 2.5 Developer can run `npm run test:e2e` from a clean checkout after dependency installation
- [x] 2.6 Smoke report or failure output explains page load, auth blocking, or guardrail contract failure clearly

### Phase 3: Attempt Signal and Verification Documentation

#### Automated

- [ ] 3.1 README and AGENTS formatting passes through the repo formatter if run
- [ ] 3.2 Local smoke tests still pass after docs updates
- [ ] 3.3 Type-aware lint still passes
- [ ] 3.4 Production build still passes

#### Manual

- [ ] 3.5 README clearly states how to run the new guardrail checks
- [ ] 3.6 AGENTS.md tells future agents when to run `npm run test:e2e`
- [ ] 3.7 Plan leaves no open implementation decision about thresholds, harness scope, attempt counting, or CI timing
