# Deterministic Game Clock Implementation Plan

## Overview

Give the game a single injectable time source plus the two tunable gravity constants (400 ms
grace, 120 ms per fallen tile), and a test seam that lets a Playwright test advance that clock
deterministically instead of sleeping. This is a foundation change (roadmap `F-01`): it ships a
module and a wire-up, not a game mechanic.

## Current State Analysis

- `src/components/game/GameEntry.tsx` has **no concept of time**. Movement is resolved purely
  inside a `keydown` handler (`GameEntry.tsx:170-188`); there is no loop, tick, or timer anywhere
  in the game surface.
- The only automated tests are Playwright E2E (`tests/e2e/guardrails.spec.ts`) driven through
  stable test IDs in `src/lib/game-guardrails.ts:7`. There is no unit-test runner, so **any test
  seam must be reachable from the browser**, not from Node.
- `src/lib/` is the established home for game-adjacent, framework-free helpers
  (`game-guardrails.ts` is the precedent: plain module, exported `const` object of tunables,
  injectable dependency via an optional parameter — `resolveStorage` at `game-guardrails.ts:36`).
- Astro runs `output: "server"`, so module top-level code executes during SSR. Anything touching
  `window` must be lazy or effect-guarded.

## Desired End State

- `src/lib/game-clock.ts` exists and exports: the tunable timing constants, a `GameClock`
  interface, a real (animation-frame) implementation, a manual implementation with `advance()`,
  and a resolver that picks between them.
- Loading `/?clock=manual` installs the manual clock on `window` under a stable key; loading `/`
  normally does not.
- A Playwright test proves the clock is inert until advanced and that advancing it moves `now()`
  by exactly the requested amount — deterministically, with no `waitForTimeout`.
- Nothing about gameplay changes. All eight existing E2E tests pass untouched.

### Key Discoveries:

- The manual clock must fire **one tick per `advance()` call**, not one per simulated frame.
  That forces every future consumer (S-02's gravity) to be written as *resolve all transitions
  due at or before `now`* in a loop, rather than *advance one step per tick*. This is the correct
  shape regardless — a real animation frame in a backgrounded tab produces the same large gap.
- `game-guardrails.ts` already models the "optional injected dependency, otherwise resolve from
  the environment" pattern. Follow it rather than inventing a provider/context.
- `React.useSyncExternalStore` is deliberately **not** used: the clock's subscribers mutate game
  state through `setState`, they do not read a store snapshot.

## What We're NOT Doing

- Not extracting the simulation, board, or movement logic out of `GameEntry.tsx`. The roadmap
  names this the specific scope-creep risk for `F-01`.
- Not subscribing anything to the clock yet — there is no time-dependent behaviour to drive
  until `S-02`. This change wires the clock up and proves it is drivable.
- Not adding a unit-test runner (Vitest/Jest). The seam is browser-reachable on purpose.
- Not adding pause/resume, time scaling, or a fixed-timestep accumulator.
- Not touching the attempt counter, `sessionStorage`, or any existing test ID.

## Implementation Approach

One new module, one small wire-up in `GameEntry`, one new E2E spec file.

The clock is an interface with two implementations. The **frame clock** wraps
`requestAnimationFrame` + `performance.now()` and is what players get. The **manual clock** holds
an internal millisecond counter and only moves when `advance(deltaMs)` is called, notifying
subscribers once per call. `resolveGameClock()` reads `window.location.search`; on
`?clock=manual` it builds a manual clock, publishes it on `window.__boulderGameClock`, and
returns it — otherwise it returns a frame clock and publishes nothing.

`GameEntry` creates the clock once on mount into a ref. That single call is what makes the manual
clock observable to a test, and is the same line `S-02` will hang its subscription on.

## Critical Implementation Details

**Timing & lifecycle** — `resolveGameClock()` must never be called during render or at module
top level: it reads `window.location` and writes a `window` property, and `GameEntry` is
server-rendered before hydration. Create it inside `useEffect` (mount-only) and store it in a
ref. The frame clock must cancel its pending animation frame when its last subscriber
unsubscribes, and must not schedule frames while it has none, so an unmounted board leaves no
loop running.

## Phase 1: The clock module

### Overview

Add the time source, its two implementations, and the tunable constants.

### Changes Required:

#### 1. Game clock module

**File**: `src/lib/game-clock.ts` (new)

**Intent**: Provide the game's only source of elapsed time and the two gravity tunables, in a
form that a browser test can take control of. Framework-free, no React import.

**Contract**:

- `GAME_TIMING` — a frozen `as const` object with `boulderGraceWindowMs: 400` and
  `boulderFallIntervalMs: 120`. These are the two constants the PRD names as tunable; nothing
  else in the codebase may re-declare them.
- `interface GameClock { now(): number; subscribe(onTick: (nowMs: number) => void): () => void }` —
  `now()` returns milliseconds since the clock started (not wall-clock epoch). `subscribe`
  returns an unsubscribe function.
- `interface ManualGameClock extends GameClock { advance(deltaMs: number): void }` — `advance`
  adds to the internal counter and then notifies every subscriber **once**, with the new `now()`.
  Advancing by `0` or a negative delta is a no-op.
- `createFrameGameClock(): GameClock` — `now()` is `performance.now()` minus the origin captured
  at creation. Runs a `requestAnimationFrame` loop only while at least one subscriber exists.
- `createManualGameClock(startMs?: number): ManualGameClock`.
- `MANUAL_CLOCK_WINDOW_KEY = "__boulderGameClock"`, `MANUAL_CLOCK_QUERY_PARAM = "clock"`,
  `MANUAL_CLOCK_QUERY_VALUE = "manual"` — exported so the E2E spec imports them instead of
  hardcoding strings, mirroring how `guardrail-assertions.ts` imports `GAME_GUARDRAIL_TEST_IDS`.
- `resolveGameClock(search?: string): GameClock` — when `search` (defaulting to
  `window.location.search`) selects manual mode, returns a manual clock and assigns it to
  `window[MANUAL_CLOCK_WINDOW_KEY]`; otherwise returns a frame clock. Returns a manual clock when
  `window` is undefined, so a non-browser caller never crashes.

Iteration over subscribers must be over a copy of the set, so a handler that unsubscribes during
a tick does not corrupt the iteration.

#### 2. Window typing for the test seam

**File**: `src/env.d.ts` (or wherever ambient types live — check before creating)

**Intent**: Declare the optional manual-clock property on `Window` so both app code and the
Playwright spec type-check without `any` casts under the repo's type-checked ESLint rules.

**Contract**: `declare global { interface Window { __boulderGameClock?: ManualGameClock } }`.
The property is optional — it is absent in normal play.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx tsc --noEmit` (or `npm run build`)
- Linting passes: `npm run lint`

#### Manual Verification:

- `GAME_TIMING` is the only place the 400 / 120 values appear in the repo (`grep`).

---

## Phase 2: Wire the clock into the game surface and prove it is drivable

### Overview

Instantiate the clock once per mounted board, and add an E2E spec that takes control of it.

### Changes Required:

#### 1. Clock instantiation in the game island

**File**: `src/components/game/GameEntry.tsx`

**Intent**: Create exactly one clock per mounted board, on the client only, and hold it where
`S-02` can subscribe to it. No gameplay behaviour changes in this phase.

**Contract**: A `useRef<GameClock | null>(null)` populated inside a mount-only `useEffect` that
calls `resolveGameClock()`. No render output, no state, no test ID changes.

#### 2. Manual-clock E2E coverage

**File**: `tests/e2e/game-clock.spec.ts` (new)

**Intent**: Prove the seam works — the clock is exposed only in manual mode, does not advance on
its own, and advances by exactly the amount requested.

**Contract**: Three tests, all importing the key/param constants from `src/lib/game-clock`:

1. `/` (no query) → `window.__boulderGameClock` is `undefined`.
2. `/?clock=manual` → the clock is present; `now()` is stable across a poll (it does not tick by
   itself).
3. `/?clock=manual` → `advance(400)` then `advance(120)` leaves `now()` at exactly `520`.

No `waitForTimeout` anywhere in this spec — that is the whole point of the change.

#### 3. Guardrail assertion helper

**File**: `tests/e2e/guardrail-assertions.ts`

**Intent**: Give later gravity specs a single, typed way to advance game time, so `S-02`/`S-03`
never reach into `window` by hand.

**Contract**: `export async function advanceGameClock(page: Page, deltaMs: number): Promise<void>`
— evaluates the manual clock's `advance` in the page and throws a clear error if the manual clock
is absent (i.e. the test forgot `?clock=manual`). Add-only; no existing helper changes.

### Success Criteria:

#### Automated Verification:

- New clock spec passes: `npm run test:e2e -- game-clock`
- All pre-existing E2E tests still pass unchanged: `npm run test:e2e`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Loading `/` in a browser plays exactly as before — no visual or input change.
- DevTools on `/` shows no `__boulderGameClock`; on `/?clock=manual` it shows one.

---

## Testing Strategy

### Integration (E2E) Tests:

- Manual clock absent in normal play; present and inert under `?clock=manual`; exact-sum advance.
- Regression: the existing eight guardrail tests must pass with zero edits. If any needs a change,
  the wire-up leaked behaviour and the change has overstepped its scope.

### Manual Testing Steps:

1. `npm run dev`, open `/`, play a few moves — movement, gems, spikes, replay unchanged.
2. Open `/?clock=manual`, run `window.__boulderGameClock.now()` twice in the console — same value.
3. Run `window.__boulderGameClock.advance(1000)`, then `now()` — value is exactly 1000 higher.

## Performance Considerations

The frame clock must not run a `requestAnimationFrame` loop with zero subscribers. After this
change there are zero subscribers, so a correct implementation schedules **no** frames at all —
CPU cost of this change in production is nil.

## References

- Roadmap item: `context/foundation/roadmap.md` → `F-01`
- PRD timing model: `context/foundation/prd.md` → "Timing model" (400 ms / 120 ms, model B)
- PRD Open Question 2: "How is time-dependent behavior tested?" — this change answers it
- Injectable-dependency precedent: `src/lib/game-guardrails.ts:36`
- Test-ID import precedent: `tests/e2e/guardrail-assertions.ts:3`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: The clock module

#### Automated

- [x] 1.1 Type checking passes — 4eceb62
- [x] 1.2 Linting passes — 4eceb62

#### Manual

- [x] 1.3 `GAME_TIMING` is the only declaration of the 400 / 120 constants — 4eceb62

### Phase 2: Wire the clock into the game surface and prove it is drivable

#### Automated

- [x] 2.1 New clock spec passes — 50ea32b
- [x] 2.2 All pre-existing E2E tests still pass unchanged — 50ea32b
- [x] 2.3 Linting passes — 50ea32b
- [x] 2.4 Build passes — 50ea32b

#### Manual

- [x] 2.5 `/` plays exactly as before — 50ea32b
- [x] 2.6 `__boulderGameClock` absent on `/`, present on `/?clock=manual` — 50ea32b
