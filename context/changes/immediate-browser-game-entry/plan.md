# Immediate Browser Game Entry Implementation Plan

## Overview

This plan turns `/` from a starter/auth landing page into the first playable BoulderGame surface. A player who opens the site should see the game, not account CTAs, and the first level should be marked ready immediately without requiring login, instructions, or a separate start button.

## Current State Analysis

The app is an Astro SSR project with a starter homepage, optional Supabase auth scaffold, and F-01 guardrails already in place. The root route currently renders `Welcome`, whose visible experience is "10x Astro Starter" with sign-in/sign-up links. Auth middleware does not block `/`, but the global layout can show a missing Supabase banner before the slot, which is friction for the no-auth MVP path.

## Desired End State

After this change, `/` renders a BoulderGame-first entry surface with the title `BoulderGame`, no auth requirement, no Supabase warning, and stable guardrail selectors. The first level is already in a ready state on page load, increments the session-local attempt count to `1`, and gives S-02 a board-shaped surface to make controllable.

### Key Discoveries:

- Root currently imports and renders starter `Welcome`: `src/pages/index.astro:2`.
- `Welcome` exposes starter copy and auth CTAs instead of gameplay: `src/components/Welcome.astro:35`.
- Middleware protects only `/dashboard`; `/` is not auth-gated: `src/middleware.ts:4`.
- `Layout` renders missing config banners before the route slot: `src/layouts/Layout.astro:22`.
- F-01 provides canonical game guardrail test IDs and attempt helpers: `src/lib/game-guardrails.ts:1`.
- Current Playwright smoke still asserts starter title and H1: `tests/e2e/guardrails.spec.ts:5`.
- F-01 says real input-response timing belongs to later controllable-board work: `context/changes/performance-play-signal-guardrails/plan.md:217`.

## What We're NOT Doing

- Removing the auth, dashboard, Supabase, or protected-route scaffold.
- Implementing character movement, collection, hazards, win/loss states, replay flow, score tuning, or physics.
- Claiming the `<100ms` in-game input response guardrail before S-02 adds real input.
- Adding production deploy automation or changing Cloudflare settings.
- Adding account state, persistence, leaderboards, analytics, or a level editor.

## Implementation Approach

Replace the root page with a focused game route that opts out of auth/config noise and mounts a small React island for the first immediately ready level. Keep the board intentionally simple but shaped like a real game surface: a visible level frame, player marker, collectible marker, and readiness/attempt guardrail markers. Update Playwright from starter smoke to game-entry smoke so S-01 becomes the first executable browser contract for the MVP.

## Critical Implementation Details

### Guardrail Scope

S-01 should make `game-entry-surface`, `game-ready`, and `game-attempt-counter` real. It should not make `game-input-response` a passing runtime assertion unless the implementation introduces actual player input; that belongs to S-02.

### Attempt Counting

The first loaded level counts as an attempt. Increment once on client mount through `incrementGameAttemptCount`, display the exact count in `game-attempt-counter`, and keep the value session-local through `GAME_ATTEMPT_SESSION_KEY`.

## Phase 1: Root Route and Layout Shell

### Overview

Remove starter/auth friction from `/` and prepare a BoulderGame route shell that can host the immediate game entry.

### Changes Required:

#### 1. Root route

**File**: `src/pages/index.astro`

**Intent**: Replace the starter `Welcome` page with the BoulderGame route shell and set the page title to `BoulderGame`.

**Contract**: The root route must render through `Layout`, pass an explicit title, opt out of config/auth warnings on the game path, and mount the S-01 game entry component once Phase 2 exists.

#### 2. Layout banner control

**File**: `src/layouts/Layout.astro`

**Intent**: Let the no-auth game route suppress missing Supabase warnings while preserving the warning behavior for auth/dashboard scaffold pages.

**Contract**: Add a boolean prop with a backwards-compatible default that controls whether `missingConfigs` banners render. Existing pages without the prop should keep current behavior.

#### 3. Starter component boundary

**File**: `src/components/Welcome.astro`

**Intent**: Keep the starter component out of the `/` path without turning S-01 into a scaffold deletion task.

**Contract**: The component may remain in the repo if unused, but `src/pages/index.astro` must no longer import or render it.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after route/layout changes: `npm run lint`.
- Production build passes after route/layout changes: `npm run build`.

#### Manual Verification:

- `/` has document title `BoulderGame` and does not show `10x Astro Starter`.
- `/` does not show sign-in/sign-up CTAs or Supabase missing-config warnings.
- `/auth/*` and `/dashboard` scaffold routes remain present for later cleanup decisions.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Immediate Level Entry

### Overview

Add the client-side game entry island that starts a first level immediately and exposes the F-01 readiness/attempt contracts.

### Changes Required:

#### 1. Game entry component

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Render the first game screen as an interactive React island because attempt counting depends on browser session storage.

**Contract**: The component must render `data-testid` values from `GAME_GUARDRAIL_TEST_IDS.entrySurface`, `readyMarker`, and `attemptCounter`; call `incrementGameAttemptCount` once per component mount; display attempt count `1` in a fresh session; and avoid any login-gated interaction.

#### 2. Level-ready presentation

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Make the first viewport feel like an arcade game entry, not a marketing hero or instruction screen.

**Contract**: Render a stable board-shaped area with a player/start marker and at least one collectible/goal marker. The level is already ready when visible; any labels must be short and must not be instructions required before play.

#### 3. Root route integration

**File**: `src/pages/index.astro`

**Intent**: Mount the React island on `/` using Astro's client directive.

**Contract**: Use an Astro client directive that hydrates the entry component promptly enough for the first-session-ready guardrail and keeps SSR output non-empty before hydration.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after the game entry component lands: `npm run lint`.
- Production build passes with the game entry island: `npm run build`.

#### Manual Verification:

- A fresh browser session opening `/` sees a ready game surface immediately without pressing a start button.
- The visible attempt counter reads `1` on first load in a fresh session.
- The first viewport reads as a retro arcade game surface, not as a starter or product landing page.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Guardrail E2E Stabilization

### Overview

Promote S-01's real browser contract into Playwright and update local docs so future slices build on the game-ready surface.

### Changes Required:

#### 1. Guardrail assertions

**File**: `tests/e2e/guardrail-assertions.ts`

**Intent**: Let tests assert readiness from navigation start and exact first-attempt count without overwriting the future replay target helper.

**Contract**: Add or adjust helpers for `entrySurface`, ready-within-threshold from a captured navigation start time, exact attempt count, and sessionStorage verification for `GAME_ATTEMPT_SESSION_KEY`.

#### 2. Browser smoke spec

**File**: `tests/e2e/guardrails.spec.ts`

**Intent**: Replace starter assertions with executable S-01 game-entry assertions.

**Contract**: The spec should navigate to `/`, verify response OK, verify no `/auth/signin` redirect, assert title `BoulderGame`, assert the entry and ready markers, assert exact attempt count `1`, assert sessionStorage contains `"1"`, and assert no visible sign-in/sign-up requirement on the root path. Keep input-response timing out of scope until S-02.

#### 3. Local documentation

**File**: `README.md`, `AGENTS.md`

**Intent**: Update local testing guidance now that the game-ready surface is stable.

**Contract**: Docs should no longer describe Playwright as only future-facing for S-01; they should say `npm run test:e2e` verifies the anonymous game entry locally. CI graduation remains out of scope unless explicitly added in a later change.

### Success Criteria:

#### Automated Verification:

- Formatting check passes for changed docs/tests/config files: `npx prettier --check README.md AGENTS.md src/pages/index.astro src/layouts/Layout.astro src/components/game/GameEntry.tsx tests/e2e/guardrails.spec.ts tests/e2e/guardrail-assertions.ts context/changes/immediate-browser-game-entry/plan.md context/changes/immediate-browser-game-entry/plan-brief.md`.
- Type-aware lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Local Playwright game-entry smoke passes: `npm run test:e2e`.

#### Manual Verification:

- Fresh browser session to `/` starts the first level without login, instructions, or a separate start button.
- `/` shows no Supabase missing-config banner while auth scaffold pages can still show configuration warnings.
- A new browser session resets the session-local attempt count.
- No CI production deploy or Playwright CI workflow is introduced.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change implemented.

---

## Testing Strategy

### Unit Tests:

- No standalone unit tests are required for S-01; the critical behavior is browser hydration and sessionStorage.

### Integration Tests:

- `npm run test:e2e` verifies the anonymous root route, game-ready marker, and first-attempt counter in a browser.
- `npm run lint` and `npm run build` verify Astro, React, TypeScript, and Cloudflare SSR compatibility.

### Manual Testing Steps:

1. Open `/` in a fresh browser context and confirm the first level is visible immediately.
2. Confirm the page title and primary heading say `BoulderGame`, with no starter branding.
3. Confirm no auth/login prompt or Supabase warning appears on the root game path.
4. Confirm the attempt counter reads `1` in a fresh session.
5. Open a separate fresh browser context and confirm the counter starts from `1` again.

## Performance Considerations

The game entry must stay lightweight enough for `game-ready` to become visible within 3 seconds from navigation start. Keep level state local and static for S-01; do not introduce network calls, server authority, database reads, or heavy assets on the first route.

## Migration Notes

No data migration is required. The existing auth/dashboard scaffold stays in place but is no longer part of the root MVP game path.

## References

- Roadmap item: `context/foundation/roadmap.md` (`S-01`, `immediate-browser-game-entry`)
- Product requirements: `context/foundation/prd.md` (`FR-001`, `FR-002`)
- Guardrail foundation: `context/changes/performance-play-signal-guardrails/plan.md`
- Guardrail contract: `src/lib/game-guardrails.ts`
- Current root route: `src/pages/index.astro`
- Current E2E smoke: `tests/e2e/guardrails.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Root Route and Layout Shell

#### Automated

- [x] 1.1 Type-aware lint passes after route/layout changes — ea92b86
- [x] 1.2 Production build passes after route/layout changes — ea92b86

#### Manual

- [x] 1.3 `/` has document title `BoulderGame` and does not show `10x Astro Starter` — ea92b86
- [x] 1.4 `/` does not show sign-in/sign-up CTAs or Supabase missing-config warnings — ea92b86
- [x] 1.5 `/auth/*` and `/dashboard` scaffold routes remain present for later cleanup decisions — ea92b86

### Phase 2: Immediate Level Entry

#### Automated

- [x] 2.1 Type-aware lint passes after the game entry component lands — fefaf8a
- [x] 2.2 Production build passes with the game entry island — fefaf8a

#### Manual

- [x] 2.3 Fresh browser session opening `/` sees a ready game surface immediately without pressing a start button — fefaf8a
- [x] 2.4 Visible attempt counter reads `1` on first load in a fresh session — fefaf8a
- [x] 2.5 First viewport reads as a retro arcade game surface, not as a starter or product landing page — fefaf8a

### Phase 3: Guardrail E2E Stabilization

#### Automated

- [x] 3.1 Formatting check passes for changed docs/tests/config files
- [x] 3.2 Type-aware lint passes
- [x] 3.3 Production build passes
- [x] 3.4 Local Playwright game-entry smoke passes

#### Manual

- [x] 3.5 Fresh browser session to `/` starts the first level without login, instructions, or a separate start button
- [x] 3.6 `/` shows no Supabase missing-config banner while auth scaffold pages can still show configuration warnings
- [x] 3.7 A new browser session resets the session-local attempt count
- [x] 3.8 No CI production deploy or Playwright CI workflow is introduced
