---
project: "BoulderGame"
version: 1
status: draft
created: 2026-08-02
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: true
---

# BoulderGame — digging & falling boulders

## Current System Overview

**Purpose** — a single-level, turn-based arcade game playable in the browser: the Miner
walks a grid, collects gems, avoids spikes, and leaves through the exit portal.

**Key architecture** — Astro 6 SSR app (`output: "server"`) deployed to Cloudflare
Workers. The game itself is a single React 19 island (`src/components/game/GameEntry.tsx`,
~369 lines) mounted on the home page. No server round-trip during play; all game state
lives in React state in the browser. No persistence beyond a client-side attempt counter
(`src/lib/game-guardrails.ts`).

**Tech stack** — Astro 6, React 19, TypeScript, Tailwind 4, shadcn/ui, Supabase (auth
only — not used by the game), Cloudflare Workers.

**Current user base** — playtesters arriving from a shared link. No account required to
play. Single-digit to low-dozens scale.

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
   as `DirtGround` art (`src/components/game/TileArt.tsx:197`). The premise "a boulder
   stops on existing Dirt" has nothing to refer to yet.
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
loop works. That shortcut is now the thing blocking the game from being interesting. The
debt is being paid deliberately, not discovered.

**Current workaround and its cost** — there is none. The player's only lever is
navigation, so the game's difficulty ceiling is "have you seen this layout before". Once
a playtester learns the spike positions, the level is exhausted in a single session.

**Insight** — the missing ingredient is not more content (more gems, more levels, more
hazards) but *player-authored risk*: a hazard the player creates by their own digging and
then has to survive. That is the core of the Boulder Dash genre and the one mechanic the
game's own title promises but does not deliver.

## User & Persona

**Primary persona (unchanged from v1)** — the link-arriving playtester. Someone the
developer sends a URL to. They open it on desktop, play one session with the keyboard,
and report back whether it was fun. They have no account, no saved progress, and no prior
briefing on the rules.

**What changes for them** — the board now responds to their movement, and they can lose in
a way they caused themselves. A first-time playtester must be able to reach both outcomes
of the reaction window — surviving it and dying to it — without instruction.

No new persona is introduced by this change.

## Success Criteria

### Primary

- The Miner digs. Moving into a Dirt tile removes it and leaves an open corridor behind,
  and the corridor persists for the rest of the attempt.
- Boulders obey gravity. A boulder whose support is dug out falls, and stops on the first
  Dirt, wall, or other boulder beneath it.
- The player-authored death exists. A boulder that lands on the Miner ends the level with
  a **Failed** outcome.
- The reaction window is real. A player who moves out of the way during the grace window
  survives; a player who does not, dies. Both outcomes are reachable by a first-time
  playtester without instruction.
- The level is redesigned for gravity: at least one gem requires the player to
  deliberately undermine a boulder to reach it. Proof that the mechanic produces
  decisions, not just motion.

  > Promoted from Secondary to Primary during shaping: redefining Dirt forces the level
  > to be re-authored regardless, so the gravity-aware layout is no longer optional.

### Secondary

- Undermining reads as a deliberate choice rather than an accident — a playtester can
  articulate, unprompted, that removing Dirt is what made the boulder fall.

### Guardrails

- **The level stays solvable.** With gravity enabled, a sequence of moves yielding two
  gems and reaching the exit must exist from the starting configuration. No boulder may
  fall at t=0 in a way that seals the exit.
- **Input stays responsive.** Miner movement reacts immediately, including while several
  boulders are falling at once. No dropped or delayed keystrokes; the existing 100 ms
  acknowledgement threshold continues to hold.
- **Motion reads as continuous.** Boulder movement does not stutter on a typical laptop
  with the full 96-tile board live.
- **Immediate no-auth entry survives.** The home page still mounts the game right away —
  no account, no loading gate.
- **Replay resets cleanly.** "Play again" restores dug Dirt and returns boulders to their
  starting positions. No residue from the previous attempt.
- **Existing losing and winning behavior does not regress.** Collecting two gems and
  reaching the exit still wins; stepping onto spikes still loses; the attempt counter and
  replay prompt behave for the new losing cause exactly as they do for the existing one.

### Timing model

Confirmed during shaping (model **B**):

- **Grace window: 400 ms.** A boulder that loses its support enters a visible unstable
  state and does not move for 400 ms. This is the named "time to react".
- **Fall speed: 120 ms per tile.** Once falling, the boulder advances one tile per 120 ms
  until it is supported again.
- Both values are single tunable constants. The Miner may escape during the grace window
  *and* during the fall.

Models rejected: **A** (turn-counted delay — a player who stops pressing keys becomes
immortal, which voids the concept of a reaction window); **C** (uniform world tick with no
separate grace — less tunable, and the grace window would be an emergent side effect of
tick rate rather than an explicit design knob).

## User Stories

### US-01: Miner digs a corridor

- **Given** the Miner stands in open space with Dirt directly to the right
- **When** the player presses the right arrow
- **Then** the Miner moves onto that tile, the Dirt is removed, and the tile is now open
  space that stays open for the rest of the attempt

**Before this change**: the walkable tile kind was already open floor. The Miner walked
through pre-existing corridors and the board never changed.

#### Acceptance Criteria
- The dug tile renders as open space, not as Dirt, from the next frame onward
- Moving back over a dug tile costs nothing and removes nothing
- A wall is not diggable — the move is rejected exactly as it is today

### US-02: Undermining a boulder and escaping

- **Given** a boulder rests on a Dirt tile, and the Miner stands beside that Dirt
- **When** the player digs that Dirt out, and then moves away within the grace window
- **Then** the boulder is visibly unstable for 400 ms, then falls at 120 ms per tile until
  it lands on the next Dirt, wall, gem, or boulder below — and the Miner survives

**Before this change**: boulders were static obstacles; nothing the player did could move
them.

#### Acceptance Criteria
- The boulder does not move at all during the 400 ms window
- The Miner's move input is accepted immediately during both the grace window and the fall
- The boulder stops on the first supporting tile — it does not pass through a gem

### US-03: Crushed by a boulder — Failed

- **Given** a boulder is falling and the Miner is standing in the tile directly below it
- **When** the boulder advances into the Miner's tile
- **Then** the level ends immediately with a **Failed** outcome and the replay prompt
  appears

**Before this change**: the only loss was stepping onto a static spike tile — a hazard the
player did not create.

#### Acceptance Criteria
- Failure requires the boulder to be the moving party; walking into a boulder's tile is a
  rejected move, never a death
- Standing under a *stable* boulder is safe indefinitely
- The replay prompt, attempt counter, and clean board reset behave exactly as they do for
  the existing spike loss

## Scope of Change

### Tile model

Dirt becomes a real thing. The tile kind that was "empty walkable floor" is **redefined**
as **Dirt**: solid, diggable, and a support for boulders. A new tile kind is introduced
for open, dug-out space. The existing Dirt-ground artwork becomes truthful; new artwork is
needed for an open cavity.

Consequence accepted during shaping: the level layout must be re-authored, which is why
"level redesigned for gravity" sits in Primary success criteria rather than Secondary.

| Tile | Before | After |
| --- | --- | --- |
| Walkable floor | empty, walkable | **Dirt** — solid, diggable, supports boulders |
| _(new)_ Open space | — | walkable, supports nothing |
| Boulder | static impassable obstacle | **falls under gravity**, kills on landing |
| Wall | impassable | unchanged — now also a boulder support |
| Gem | collectible | unchanged — now also a boulder support |
| Spikes | terminal loss on entry | unchanged |
| Exit | wins at ≥ 2 gems | unchanged |
| Player start | Miner's origin | unchanged |

### Digging

- [new] FR-001: Miner can dig — moving into a Dirt tile removes that Dirt and leaves open
  space behind. Priority: must-have
- [new] FR-002: Miner can rely on dug corridors persisting — removed Dirt never regrows
  within an attempt. Priority: must-have
  > Socrates: Counter-argument accepted — "persistence means no way back". A player can
  > irreversibly soft-lock the level: dig into a dead end, or drop a boulder onto the
  > last reachable gem, and the level becomes unwinnable while play continues.
  > Resolution: **do nothing**. No solver, no auto-detect, no warning. The player
  > notices and hits "Play again". The solvability guardrail binds the *starting*
  > configuration only — what the player does to themselves afterwards is their
  > decision, and self-inflicted irreversibility is the point of the genre. Recorded as
  > the deliberate boundary of FR-012.

### Boulder gravity

- [new] FR-003: A boulder loses support when the tile directly beneath it becomes open
  space. Priority: must-have
- [new] FR-004: An unsupported boulder holds position for a 400 ms grace window and is
  visibly telegraphed as unstable during it. Priority: must-have
- [new] FR-005: After the grace window a boulder falls one tile per 120 ms until it is
  supported again. Priority: must-have
- [new] FR-006: A boulder comes to rest on Dirt, a wall, a gem, or another boulder.
  Priority: must-have
- [new] FR-007: A boulder that moves onto the tile occupied by the Miner ends the level
  with a Failed outcome. Priority: must-have
- [modified] FR-008: A boulder is impassable whether stable or falling — walking into one
  is a rejected move, never a death. Death requires the boulder to be the moving party.
  Priority: must-have
- [new] FR-009: A boulder whose support was another boulder that fell away becomes
  unstable in turn, producing chain reactions. Priority: must-have

### Board & level

- [modified] FR-010: The board is per-attempt mutable state — "Play again" restores all
  dug Dirt and returns every boulder to its start position. Priority: must-have
- [modified] FR-011: The level is authored as solid Dirt with carved starting spaces, and
  at least one gem requires deliberately undermining a boulder to reach. Priority:
  must-have
- [new] FR-012: A solvable route to two gems and the exit exists from the starting
  configuration once gravity is active. Priority: must-have

### Explicitly preserved

- [preserved] FR-013: Miner collects gems by moving onto them; two gems plus the exit
  wins; stepping on spikes loses. Priority: must-have
- [preserved] FR-014: The game starts immediately on the home page with no account, the
  attempt counter increments, "Play again" resets, and the accessibility and test-hook
  guardrail surface stays intact. Priority: must-have

### Socratic round — summary

Twelve challenges raised, one per design-bearing FR (FR-001 … FR-012). Eleven were
considered and dismissed; the FR text stands as written in each case. One was accepted and
resolved — FR-002 (see the blockquote above). FR-013 and FR-014 are defensive preservation
FRs and carry no design decision to challenge.

Counter-arguments raised, considered, and explicitly rejected — recorded because each
names a plausible future scope request:

- Sideways boulder sliding (challenged FR-003) — rejected; routed to Non-Goals.
- Boulder pushing by the Miner (challenged FR-008) — rejected; routed to Non-Goals.
- Accelerating fall speed instead of a constant rate (challenged FR-005) — rejected;
  constant 120 ms/tile stands.
- Falling boulders crushing gems instead of resting on them (challenged FR-006) —
  rejected; boulders rest on gems.
- A solver that detects unwinnable states (challenged FR-012) — rejected; see FR-002's
  resolution.
- Screen-reader parity for the visual instability telegraph (challenged FR-004) —
  dismissed by the user, but recorded as unresolved. Routed to Open Questions, not treated
  as settled.

## Constraints & Compatibility

### Backward compatibility

- **The level end-state model is extended, not replaced.** The game already has a losing
  status for spikes. Being crushed is a **new cause of that existing losing status, not a
  new status value** — the status set stays `active | lost | won`. Everything that keys on
  the existing losing status keeps working. Only the player-facing outcome message differs
  between the spike loss ("cave-in") and being crushed ("Failed").
- **The level encoding changes meaning.** The character that encoded "empty walkable
  floor" now encodes Dirt, and a new character encodes open space. The level layout itself
  is re-authored under this new meaning; no other consumer of the encoding exists.

### Frozen while the level is re-authored

- **Board dimensions stay 12×8** — the twelve-column layout and any tile-counting test
  keep working.
- **The two-gem win quota stays 2** — the Quota and Bonus panels retain their meaning.
- **All 16 existing stable test identifiers stay** — additions only, no renames. New
  states (unstable boulder, Dirt tile, open space) get *new* identifiers alongside the
  existing set.
- **Spikes remain present in the new layout** — otherwise the closed `level-end-states`
  change loses its coverage.

### Existing behavior that must continue working

- **Immediate no-auth entry** — the game starts on the home page with no sign-in. (Closed
  change: `immediate-browser-game-entry`.)
- **Replay loop** — attempt counter, "Play again" button, clean state reset. (Closed
  change: `replayable-arcade-loop`.)
- **Accessibility & play-signal guardrails** — the live status region, the screen-reader
  state description, the test hooks, and input responsiveness. (Closed change:
  `performance-play-signal-guardrails`.)
- **The existing 100 ms input-acknowledgement threshold** is an inherited numeric
  contract, not a newly invented target for this change.
- **The attempt counter's stored value** is untouched by this change.

### Quality properties that must hold after the change

- Miner movement is visually acknowledged in under 100 ms of the keypress, including while
  several boulders are in motion at once.
- Boulder motion reads as continuous rather than stuttering on a typical laptop, with the
  full 96-tile board live.
- The same inputs issued at the same moments produce the same outcome — the level is
  learnable by repetition, and the change is testable.
- No game mechanic requires a network connection, and no game state leaves the player's
  device.

### Data migration

None. The game holds no persisted state beyond the attempt counter, which this change does
not touch. There is no schema change, no backfill, and no rollback plan needed.

## Business Logic Changes

**Current rule (unchanged)** — the exit decides whether to release the Miner, based on how
many gems have been collected. This is the only decision the application makes on the
player's behalf today; everything else is movement and collision.

**Added rule (one sentence)** — after every change to the board, the cave decides which
boulders have lost their support, grants each a measured window to be reacted to, and then
lowers it to the first support beneath it; anything caught in its path dies.

This is an *addition*, not a modification: the gem-gating rule is untouched. The two rules
now interact — a boulder can come to rest on a gem, and the player must weigh whether
reaching a gem is worth removing the Dirt that holds a boulder above it.

**Inputs the rule consumes** — the position of every boulder, and which tiles beneath them
are solid (Dirt, wall, gem, another boulder) versus open. Both change only as a consequence
of the player digging or a boulder landing.

**Output** — an updated board plus, when a boulder arrives on the Miner's tile, a terminal
Failed outcome.

**How the player encounters it** — they dig, they see a boulder above the hole start to
shake, and they have a moment to decide whether to keep digging toward the gem or step
clear. The rule is never explained in text; it is learned by causing it.

## Access Control Changes

**No access control changes — current model preserved.**

Current model: no authentication of any kind on the game surface. The home page mounts the
game and play begins immediately; there is no account, no role, no gated route. An
authentication system exists elsewhere in the project but the game is not behind it.

Digging and falling boulders are pure in-browser mechanics and introduce no new identity,
permission, or persistence concern.

## Non-Goals

**Functional non-goals**

- **No boulder pushing and no diagonal sliding.** The Miner cannot shove a boulder
  sideways, and a boulder resting on another boulder does not slide off into adjacent open
  space. Both are staples of the genre and both were raised and rejected during the
  Socratic round — listing them here closes the door rather than leaving it ajar.
- **No falling gems.** Gems are immobile and act as boulder supports. In the source genre
  diamonds fall too; here they deliberately do not, which keeps the falling-object
  simulation to a single object type within the one-week budget.
- **No multiple levels and no progression.** Still one level. No level select, no saved
  progress, no leaderboard.
- **No level editor and no persistence.** Out of scope for the one-week delivery window.

**Non-functional non-goals**

- **No unwinnable-state detection.** The game will not run a solver, will not end the
  level, and will not warn the player when their own digging has made the level
  impossible. See FR-002's Socratic resolution.

**Deliberately not ruled out** (the user declined to make these non-goals, so they stay
available rather than closed): active enemies, monsters, and a per-level time limit.

## Open Questions

1. **How does a non-sighted player perceive the 400 ms grace window?** — Owner: user. The
   instability telegraph is described as visual only. The live status region is the only
   non-visual channel, and it currently reports state on player-initiated changes.
   Announcing every wobble would flood it; announcing nothing removes the reaction window
   for screen-reader users entirely. Preserving the accessibility guardrails was named
   must-preserve in Phase 1, and the user dismissed the corresponding Socratic challenge
   on FR-004 — so this remains genuinely unresolved rather than decided. Block: no, but it
   can silently regress a preserved guardrail.

2. **How is time-dependent behavior tested?** — Owner: user. Existing tests assume a
   static, deterministic board. The repeatability property ("same inputs at the same
   moments produce the same outcome") implies the clock must be controllable from tests.
   The approach is an implementation-planning concern, not a product decision.

_Resolved during shaping (recorded for traceability, not open):_

- ~~Does the walkable tile become Dirt, or is a new Dirt tile added alongside it?~~ —
  Resolved: it is redefined as Dirt and a new tile kind represents open space.
- ~~How long is the reaction window?~~ — Resolved: 400 ms grace, then 120 ms per tile.
- ~~Is "Failed" a new status?~~ — Resolved: no; it is a new cause of the existing losing
  status.
- ~~What happens when a player soft-locks the level?~~ — Resolved: nothing; the player
  restarts.
