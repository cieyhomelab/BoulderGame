---
project: "BoulderGame"
context_type: brownfield
created: 2026-08-02
updated: 2026-08-02
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "change category"
      decision: "significant feature + architectural improvement — mechanics forced a mutable board and a time loop"
    - topic: "insight"
      decision: "v1 deliberately avoided simulation (static board was a conscious shortcut); the game has no risk the player creates for themselves"
    - topic: "primary persona scope"
      decision: "unchanged from v1 — playtester arriving from a shared link, no account"
    - topic: "must-preserve baseline"
      decision: "no-auth immediate entry, replay loop, accessibility/guardrail signals. Level end states are explicitly NOT preserved — this change extends them."
    - topic: "access control"
      decision: "no change — game stays unauthenticated, no roles, no persistence"
    - topic: "timing model"
      decision: "real clock with an explicit grace window — 400 ms unstable, then 120 ms per tile of fall (model B)"
    - topic: "guardrail promotion"
      decision: "level solvability and input responsiveness promoted from risks to guardrails"
    - topic: "delivery timeline"
      decision: "1 week, after-hours; no new levels, no editor, no persistence"
    - topic: "dirt tile model"
      decision: "'.' is redefined as Dirt; a new tile kind represents open dug space. LEVEL_ROWS is re-authored, so level redesign moves from Secondary to Primary."
    - topic: "boulder supports"
      decision: "a boulder rests on Dirt, wall, gem, or another boulder"
    - topic: "death condition"
      decision: "only a moving boulder kills — it must advance onto the Miner's tile. Walking into a boulder is a rejected move. Standing under a stable boulder is safe."
    - topic: "soft-lock handling"
      decision: "no solver, no detection, no warning — the player notices and hits Play again. The solvability guardrail binds the starting configuration only."
    - topic: "added domain rule"
      decision: "the cave resolves support after every board change — an addition alongside the existing gem-gating rule, not a modification of it"
    - topic: "Failed vs lost"
      decision: "being crushed is a new cause of the existing 'lost' status; LevelStatus stays active|lost|won and no test contract breaks"
    - topic: "frozen board contract"
      decision: "12x8 dimensions, REQUIRED_GEM_COUNT=2, all 16 existing data-testid values, spikes still present in the new layout"
    - topic: "product framing"
      decision: "no change — web-app, small scale. Timeline: 1 week, no hard deadline, after-hours."
    - topic: "non-goals"
      decision: "no boulder pushing or diagonal sliding, no falling gems, no multiple levels or progression, no unwinnable-state detection. Enemies and a level timer were deliberately NOT ruled out."
  frs_drafted: 14
  quality_check_status: accepted
---

# Shape notes — BoulderGame: digging & falling boulders

Seed idea (verbatim, as given):

> Dodaj nowe funkcje do gry, poruszający się Miner usuwa Dirt czyli jak w grze kopie
> korytarze. Jesli pod boulder zostanie usunięty Dirt to Boulder spada w doł a zatrzyma
> się na istniejącym Dirt. Jesli spadnie na Miner to gra się kończy z wynikiem Failed.
> Miner ma czas aby zareagować na spadający Boulder, czas dobierz sam.

## Current System Overview

**Purpose** — a single-level, turn-based arcade game playable in the browser: the Miner
walks a grid, collects gems, avoids spikes, and leaves through the exit portal.

**Architecture** — Astro 6 SSR app (`output: "server"`) deployed to Cloudflare Workers.
The game itself is a single React 19 island (`src/components/game/GameEntry.tsx`, ~369
lines) mounted on the home page. No server round-trip during play; all game state lives
in React state in the browser. No persistence beyond a client-side attempt counter
(`src/lib/game-guardrails.ts`).

**Stack** — Astro 6, React 19, TypeScript, Tailwind 4, shadcn/ui, Supabase (auth only —
not used by the game), Cloudflare Workers.

**User base** — playtesters arriving from a shared link. No account required to play.
Single-digit to low-dozens scale.

**Core functionality today**

- The level is a 12×8 grid defined as `LEVEL_ROWS`, a frozen array of strings, parsed
  once into `LEVEL_BOARD` — a module-level `const`. **The board is never mutated.**
- Seven tile kinds: `.` empty/walkable, `#` wall, `r` boulder, `g` gem, `h` spikes,
  `e` exit, `p` player start.
- Movement is purely reactive: a `keydown` handler resolves one step (WSAD / arrows).
  **There is no game loop, no tick, no timer.** Nothing moves unless the player presses
  a key.
- Boulders (`r`) are static, impassable obstacles — functionally identical to walls.
- Win: reach `e` holding ≥ 2 gems. Lose: step onto `h`. Both are terminal, both offer
  "Play again".

**Three properties of the current system that shape this change**

1. **There is no Dirt tile.** `.` is logically empty walkable floor; it merely *renders*
   as `DirtGround` art (`src/components/game/TileArt.tsx:197`). The seed's premise —
   "a boulder stops on existing Dirt" — has nothing to refer to yet.
2. **The board is immutable.** Digging requires the board to become game state.
3. **The game has no concept of time.** "The Miner has time to react to a falling
   boulder" cannot be expressed in the current turn-based-only model.

## Problem Statement & Motivation

The board is dead. The Miner does not change the world — they walk through corridors
someone else already dug. The boulder, despite naming the game, is a decorative wall.
Nothing on the board can be set in motion by the player, so nothing on the board can
produce a decision the player regrets. The only failure available is stepping onto a
static spike tile, which a player avoids trivially once seen.

**Why now** — iteration v1 is closed (7 archived changes). It deliberately avoided
simulation: a static board was the fastest path to proving the "arrive → play → replay"
loop works. That shortcut is now the thing blocking the game from being interesting.
The debt is being paid deliberately, not discovered.

**Insight** — the missing ingredient is not more content (more gems, more levels, more
hazards) but *player-authored risk*: a hazard the player creates by their own digging
and then has to survive. That is the core of the Boulder Dash genre and the one
mechanic the game's own title promises but does not deliver.

## User & Persona

**Primary persona (unchanged from v1)** — the link-arriving playtester. Someone the
developer sends a URL to. They open it on desktop, play one session with the keyboard,
and report back whether it was fun. They have no account, no saved progress, and no
prior briefing on the rules.

What changes for them: the board now responds to their movement, and they can lose in a
way they caused themselves.

## Constraints & Preserved Behavior

Explicitly named as things that must NOT break (captured Phase 1; extended in Phase 5/6):

- **Immediate no-auth entry** — the game starts on the home page with no sign-in.
  (Closed change: `immediate-browser-game-entry`.)
- **Replay loop** — attempt counter, "Play again" button, clean state reset.
  (Closed change: `replayable-arcade-loop`.)
- **Accessibility & play-signal guardrails** — `aria-live` status region, `sr-only`
  state description, `data-testid` hooks used by tests, input responsiveness.
  (Closed changes: `performance-play-signal-guardrails`.)

Explicitly **not** on the preserve list: the level end-state model. This change extends
it with a new losing cause, so `level-end-states` is being modified, not frozen.

### Contract surfaces (captured Phase 5)

Inspected in `src/lib/game-guardrails.ts`:

- **`GAME_GUARDRAIL_TEST_IDS`** — 16 stable identifiers consumed by tests. None may be
  renamed or removed. New states (unstable boulder, Dirt tile, open space) get *new*
  identifiers alongside the existing set.
- **`GAME_GUARDRAIL_THRESHOLDS.inputResponseMs = 100`** — an existing numeric contract.
  The input-latency NFR in this change targets exactly this threshold; it is inherited,
  not newly invented.
- **`GAME_ATTEMPT_SESSION_KEY`** (`sessionStorage`) — the attempt counter. Untouched.

### Level end-state compatibility

The seed's word is "Failed", but the game already has a `lost` status for spikes. The
resolution: **being crushed is a new cause of the existing `lost` status, not a new
status value.** `LevelStatus` stays `active | lost | won`. Every test and `data-testid`
that keys on `lost` keeps working. Only the player-facing outcome message differs
between "cave-in" (spikes) and being crushed.

### Frozen while the level is re-authored

- **Board dimensions stay 12×8** — the `grid-cols-12` layout and any tile-counting test
  keep working.
- **`REQUIRED_GEM_COUNT` stays 2** — the Quota and Bonus panels retain their meaning.
- **All 16 existing `data-testid` values stay** — additions only, no renames.
- **Spikes (`h`) remain present in the new layout** — otherwise the closed
  `level-end-states` change loses its coverage.

### Data migration

None. The game holds no persisted state beyond a `sessionStorage` attempt counter, which
this change does not touch. There is no schema, no backfill, and no rollback plan needed.

## Access Control Changes

**No access control changes — current model preserved.**

Current model: no authentication of any kind on the game surface. The home page mounts
the game island and play begins immediately; there is no account, no role, no gated
route. Supabase Auth exists in the project (`src/middleware.ts`, `PROTECTED_ROUTES`)
but the game is not behind it.

Digging and falling boulders are pure client-side mechanics and introduce no new
identity, permission, or persistence concern.

## Success Criteria

### Primary

- The Miner digs. Moving into a Dirt tile removes it and leaves an open corridor behind,
  and the corridor persists for the rest of the attempt.
- Boulders obey gravity. A boulder whose support is dug out falls, and stops on the
  first Dirt, wall, or other boulder beneath it.
- The player-authored death exists. A boulder that lands on the Miner ends the level
  with a **Failed** outcome.
- The reaction window is real. A player who moves out of the way during the grace
  window survives; a player who does not, dies. Both outcomes are reachable by a
  first-time playtester without instruction.

### Secondary

- The level is redesigned for gravity: at least one gem requires the player to
  deliberately undermine a boulder to reach it. Proof that the mechanic produces
  decisions, not just motion.

### Guardrails

- **The level stays solvable.** With gravity enabled, a sequence of moves yielding two
  gems and reaching the exit must exist from the starting configuration. No boulder may
  fall at t=0 in a way that seals the exit.
- **Input stays responsive.** Miner movement reacts immediately, including while several
  boulders are falling at once. No dropped or delayed keystrokes.
- **Immediate no-auth entry survives.** The home page still mounts the game right away —
  no account, no loading gate.
- **Replay resets cleanly.** "Play again" restores dug Dirt and returns boulders to their
  starting positions. No residue from the previous attempt.

### Timing model (delegated to the skill by the user, then confirmed)

The seed said "czas dobierz sam". Model **B** was proposed and confirmed:

- **Grace window: 400 ms.** A boulder that loses its support enters a visible unstable
  state and does not move for 400 ms. This is the named "time to react".
- **Fall speed: 120 ms per tile.** Once falling, the boulder advances one tile per
  120 ms until it is supported again.
- Both values are single tunable constants. The Miner may escape during the grace
  window *and* during the fall.

Models rejected: **A** (turn-counted delay — a player who stops pressing keys becomes
immortal, which voids the concept of a reaction window); **C** (uniform world tick with
no separate grace — less tunable, and the grace window would be an emergent side effect
of tick rate rather than an explicit design knob).

## Timeline

`delivery_weeks: 1` (after-hours). Scope is one mechanic set plus the board-state
refactor. No new levels, no level editor, no persistence.

## Blast radius (captured Phase 3)

User-identified risks:

- **Existing level layout** — `LEVEL_ROWS` was authored for static boulders. With
  gravity on, boulders may fall at t=0 or seal the route to the exit. Promoted to a
  guardrail.
- **Frame smoothness / performance** — every tick re-renders 96 SVG tiles. The closed
  `performance-play-signal-guardrails` change guarded input responsiveness. Promoted to
  a guardrail.

Flagged by the skill, *not* selected by the user as a risk (recorded honestly, routed to
Open Questions rather than treated as a decision):

- **Accessibility under self-changing state** — the grace window is the first thing in
  the game that changes state without player input. The `aria-live` region could either
  flood a screen reader with automatic updates, or stay silent about a wobbling boulder
  that a sighted player can see. Preserving the a11y guardrails was named must-preserve
  in Phase 1, so this tension is unresolved.
- **Test stability** — existing tests assume a deterministic, static board. A clock
  introduces timing-dependent assertions.

## Scope of Change

### Tile model (resolved — this was the load-bearing open question)

`.` is **redefined** from "empty walkable floor" to **Dirt**: solid, diggable, supports
boulders. A new tile kind is introduced for open, dug-out space. The existing
`DirtGround` art (`TileArt.tsx:197`) becomes truthful; a new art variant is needed for
an open cavity.

Consequence accepted by the user: `LEVEL_ROWS` must be re-authored, so "level redesigned
for gravity" moves from Secondary to Primary scope.

| Tile | Before | After |
| --- | --- | --- |
| `.` | empty, walkable | **Dirt** — solid, diggable, supports boulders |
| _(new)_ | — | **open space** — walkable, supports nothing |
| `r` | static impassable obstacle | **falls under gravity**, kills on landing |
| `#` | wall | wall — unchanged, now also a boulder support |
| `g` | collectible gem | collectible gem — now also a boulder support |
| `h` | spikes → lost | unchanged |
| `e` | exit → won at ≥ 2 gems | unchanged |
| `p` | player start | unchanged |

### Digging

- FR-001: [new] Miner can dig — moving into a Dirt tile removes that Dirt and leaves
  open space behind. Priority: must-have. Change: new
- FR-002: [new] Miner can rely on dug corridors persisting — removed Dirt never regrows
  within an attempt. Priority: must-have. Change: new
  > Socrates: Counter-argument accepted — "persistence means no way back". A player can
  > irreversibly soft-lock the level: dig into a dead end, or drop a boulder onto the
  > last reachable gem, and the level becomes unwinnable while play continues.
  > Resolution: **do nothing**. No solver, no auto-detect, no warning. The player
  > notices and hits "Play again". The solvability guardrail binds the *starting*
  > configuration only — what the player does to themselves afterwards is their
  > decision, and self-inflicted irreversibility is the point of the genre. Recorded as
  > the deliberate boundary of FR-012.

### Boulder gravity

- FR-003: [new] A boulder loses support when the tile directly beneath it becomes open
  space. Priority: must-have. Change: new
- FR-004: [new] An unsupported boulder holds position for a 400 ms grace window and is
  visibly telegraphed as unstable during it. Priority: must-have. Change: new
- FR-005: [new] After the grace window a boulder falls one tile per 120 ms until it is
  supported again. Priority: must-have. Change: new
- FR-006: [new] A boulder comes to rest on Dirt, a wall, a gem, or another boulder.
  Priority: must-have. Change: new
- FR-007: [new] A boulder that moves onto the tile occupied by the Miner ends the level
  with a Failed outcome. Priority: must-have. Change: new
- FR-008: [modified] A boulder is impassable whether stable or falling — walking into
  one is a rejected move, never a death. Death requires the boulder to be the moving
  party. Priority: must-have. Change: modified
- FR-009: [new] A boulder whose support was another boulder that fell away becomes
  unstable in turn, producing chain reactions. Priority: must-have. Change: new

### Board & level

- FR-010: [modified] The board is per-attempt mutable state — "Play again" restores all
  dug Dirt and returns every boulder to its start position. Priority: must-have.
  Change: modified
- FR-011: [modified] The level is authored as solid Dirt with carved starting spaces,
  and at least one gem requires deliberately undermining a boulder to reach.
  Priority: must-have. Change: modified
- FR-012: [new] A solvable route to two gems and the exit exists from the starting
  configuration once gravity is active. Priority: must-have. Change: new

### Explicitly preserved

- FR-013: [preserved] Miner collects gems by moving onto them; two gems plus the exit
  wins; stepping on spikes loses. Priority: must-have. Change: preserved
- FR-014: [preserved] The game starts immediately on the home page with no account, the
  attempt counter increments, "Play again" resets, and the `aria-live` / `sr-only` /
  `data-testid` guardrail surface stays intact. Priority: must-have. Change: preserved

### Socratic round — summary

Twelve challenges raised, one per design-bearing FR (FR-001 … FR-012). Eleven were
considered and dismissed; the FR text stands as written in each case. One was accepted
and resolved — FR-002 (see the blockquote above). FR-013 and FR-014 are defensive
preservation FRs and carry no design decision to challenge.

Counter-arguments that were raised, considered, and explicitly rejected — recorded
because each names a plausible future scope request:

- Sideways boulder sliding (challenged FR-003) — rejected; routed to Non-Goals.
- Boulder pushing by the Miner (challenged FR-008) — rejected; routed to Non-Goals.
- Accelerating fall speed instead of a constant rate (challenged FR-005) — rejected;
  constant 120 ms/tile stands.
- Falling boulders crushing gems instead of resting on them (challenged FR-006) —
  rejected; boulders rest on gems.
- A solver that detects unwinnable states (challenged FR-012) — rejected; see FR-002's
  resolution.
- Screen-reader parity for the visual instability telegraph (challenged FR-004) —
  dismissed by the user, but the skill still considers it unresolved. Routed to Open
  Questions, not treated as settled.

## User Stories

### US-01: Miner digs a corridor

- **Given** the Miner stands in open space with Dirt directly to the right
- **When** the player presses the right arrow
- **Then** the Miner moves onto that tile, the Dirt is removed, and the tile is now open
  space that stays open for the rest of the attempt

**Before this change**: `.` was already open floor. The Miner walked through
pre-existing corridors and the board never changed.

#### Acceptance criteria
- The dug tile renders as open space, not as Dirt, from the next frame onward
- Moving back over a dug tile costs nothing and removes nothing
- A wall (`#`) is not diggable — the move is rejected exactly as it is today

### US-02: Undermining a boulder and escaping

- **Given** a boulder rests on a Dirt tile, and the Miner stands beside that Dirt
- **When** the player digs that Dirt out, and then moves away within the grace window
- **Then** the boulder is visibly unstable for 400 ms, then falls at 120 ms per tile
  until it lands on the next Dirt, wall, gem, or boulder below — and the Miner survives

**Before this change**: boulders were static obstacles; nothing the player did could
move them.

#### Acceptance criteria
- The boulder does not move at all during the 400 ms window
- The Miner's move input is accepted immediately during both the grace window and the
  fall
- The boulder stops on the first supporting tile — it does not pass through a gem

### US-03: Crushed by a boulder — Failed

- **Given** a boulder is falling and the Miner is standing in the tile directly below it
- **When** the boulder advances into the Miner's tile
- **Then** the level ends immediately with a **Failed** outcome and the replay prompt
  appears

**Before this change**: the only loss was stepping onto a static spike tile — a hazard
the player did not create.

#### Acceptance criteria
- Failure requires the boulder to be the moving party; walking into a boulder's tile is
  a rejected move, never a death
- Standing under a *stable* boulder is safe indefinitely
- The replay prompt, attempt counter, and clean board reset behave exactly as they do
  for the existing spike loss

## Business Logic Changes

**Current rule** — the exit decides whether to release the Miner, based on how many gems
have been collected. This is the only decision the application makes on the player's
behalf today; everything else is movement and collision.

**Added rule (one sentence)** — after every change to the board, the cave decides which
boulders have lost their support, grants each a measured window to be reacted to, and
then lowers it to the first support beneath it; anything caught in its path dies.

This is an *addition*, not a modification: the gem-gating rule is untouched. The two
rules now interact — a boulder can come to rest on a gem, and the player must weigh
whether reaching a gem is worth removing the Dirt that holds a boulder above it.

**Inputs the rule consumes** — the position of every boulder, and which tiles beneath
them are solid (Dirt, wall, gem, another boulder) versus open. Both change only as a
consequence of the player digging or a boulder landing.

**Output** — an updated board plus, when a boulder arrives on the Miner's tile, a
terminal Failed outcome.

**How the player encounters it** — they dig, they see a boulder above the hole start to
shake, and they have a moment to decide whether to keep digging toward the gem or step
clear. The rule is never explained in text; it is learned by causing it.

## Non-Functional Requirements

- Miner movement is visually acknowledged in under 100 ms of the keypress, including
  while several boulders are in motion at once.
- Boulder motion reads as continuous rather than stuttering on a typical laptop, with
  the full 96-tile board live.
- The same inputs issued at the same moments produce the same outcome — the level is
  learnable by repetition, and the change is testable.
- No game mechanic requires a network connection, and no game state leaves the browser
  tab.

## Product framing

- **Product type: unchanged** — web-app. The change adds mechanics inside the existing
  React island; no new product surface.
- **Target scale: unchanged** — `small` (single-digit to low-dozens playtesters
  arriving from a shared link). Nothing about digging or gravity opens the game to a
  different audience or load profile.
- **Timeline** — `delivery_weeks: 1`, `hard_deadline: null`, `after_hours_only: true`.
  The one-week estimate is the developer's own, not a commitment to anyone.

## Non-Goals

- **No boulder pushing and no diagonal sliding.** The Miner cannot shove a boulder
  sideways, and a boulder resting on another boulder does not slide off into adjacent
  open space. Both are staples of the genre and both were raised and rejected during the
  Socratic round — listing them here closes the door rather than leaving it ajar.
- **No falling gems.** Gems are immobile and act as boulder supports. In the source
  genre diamonds fall too; here they deliberately do not, which keeps the falling-object
  simulation to a single object type within the one-week budget.
- **No multiple levels and no progression.** Still one level. No level select, no saved
  progress, no leaderboard.
- **No unwinnable-state detection.** The game will not run a solver, will not end the
  level, and will not warn the player when their own digging has made the level
  impossible. See FR-002's Socratic resolution.

Deliberately **not** ruled out (the user declined to make this a non-goal, so it stays
available rather than closed): active enemies, monsters, and a per-level time limit.

## Forward: technical-roadmap

Captured because it surfaced during shaping, but out of scope for the PRD:

- The move from an immutable module-level board to per-attempt mutable state plus a
  simulation clock is a foundation other mechanics would build on. Whether that engine
  is extracted from `GameEntry.tsx` into a separate module is an implementation-planning
  decision, not a product one.
- Existing tests assume a static, deterministic board. Introducing a clock will require
  a testing approach for time-dependent behavior. The user did not flag this as a risk;
  it is recorded here for whoever plans the implementation.

## Quality cross-check

Run at the close of the session. All seven brownfield elements present; **no gaps**.

| Element | Result |
| --- | --- |
| Access Control | present — "no changes, current model preserved" |
| Business Logic | present — one-sentence rule plus inputs, output, and player encounter |
| Project artifacts | present |
| Timeline-cost ack | present — `delivery_weeks: 1`, under the three-week threshold |
| Non-Goals | present — four entries, each with a rationale |
| Preserved behavior | present — contract surfaces named explicitly |
| Scope of change | present — 14 FRs categorised new / modified / preserved |

`quality_check_status: accepted`. The two entries below are deliberate unknowns carried
forward, not gate failures.

## Open Questions

1. **How does a non-sighted player perceive the 400 ms grace window?** — Owner: user.
   The instability telegraph is described as visual only. The `aria-live` region is the
   only non-visual channel, and it currently reports state on player-initiated changes.
   Announcing every wobble would flood it; announcing nothing removes the reaction
   window for screen-reader users entirely. Preserving the accessibility guardrails was
   named must-preserve in Phase 1, and the user dismissed the corresponding Socratic
   challenge on FR-004 — so this remains genuinely unresolved rather than decided.
   Block: no, but it can silently regress a preserved guardrail.

2. **How is time-dependent behavior tested?** — Owner: user. Existing tests assume a
   static, deterministic board. The repeatability NFR ("same inputs at the same moments
   produce the same outcome") implies the clock must be controllable from tests. The
   approach is an implementation-planning concern, not a product decision.

_Resolved during this session:_

- ~~Does `.` become Dirt, or is a new Dirt tile added alongside it?~~ — Resolved in
  Phase 4: `.` is redefined as Dirt and a new tile kind represents open space.
- ~~How long is the reaction window?~~ — Resolved in Phase 3: 400 ms grace, then
  120 ms per tile.
- ~~Is "Failed" a new status?~~ — Resolved in Phase 5: no; it is a new cause of the
  existing `lost` status.
- ~~What happens when a player soft-locks the level?~~ — Resolved in Phase 4: nothing;
  the player restarts.
