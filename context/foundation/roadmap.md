---
project: "BoulderGame"
version: 1
status: draft
created: 2026-08-02
updated: 2026-08-02
prd_version: 1
main_goal: market-feedback
top_blocker: time
---

# Roadmap: BoulderGame — digging & falling boulders

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

The board is dead. The Miner walks corridors someone else already dug, and the boulder —
the thing the game is named after — is a decorative wall. Nothing on the board can be set
in motion by the player, so nothing on the board can produce a decision the player
regrets, and a playtester exhausts the level the moment they have memorised the spikes.

The missing ingredient is not more content but **player-authored risk**: a hazard the
player creates by their own digging and then has to survive. This roadmap sequences that
one mechanic — dig, undermine, fall, die — into the existing single React island.

## North star

**S-03: user can be crushed by a boulder they undermined — Failed** — this is the first
point where the PRD's Primary criterion "the reaction window is real … both outcomes are
reachable by a first-time playtester without instruction" can actually be observed on a
real person, which is what `main_goal: market-feedback` is optimising for.

> "North star" here means: the smallest end-to-end, user-visible slice whose successful
> delivery would prove the central idea of the PRD actually works — placed as early as its
> Prerequisites allow, because everything else only matters if this holds up. A boulder
> that falls but cannot kill you is motion without stakes, and produces no signal about
> whether the game is fun.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                     | Prerequisites | PRD refs                                       | Status   |
| ---- | ---------------------------- | ------------------------------------------------------------------------ | ------------- | ---------------------------------------------- | -------- |
| F-01 | `deterministic-game-clock`   | (foundation) one injectable time source; tests can advance it            | —             | NFR (determinism, input < 100 ms), OQ-2        | done     |
| S-01 | `diggable-dirt-corridors`    | dig into Dirt and leave a corridor that persists for the whole attempt   | —             | US-01, FR-001, FR-002, FR-010, FR-013, FR-014  | done     |
| S-02 | `boulder-gravity-and-fall`   | undermine a boulder, watch it wobble, then fall and land                 | S-01, F-01    | US-02, FR-003, FR-004, FR-005, FR-006, FR-009, FR-010 | done     |
| S-03 | `crushed-by-boulder-failure` | be killed by a boulder they undermined — level ends Failed               | S-02          | US-03, FR-007, FR-008, FR-014                  | done     |
| S-04 | `gravity-aware-level-layout` | reach a gem that is only obtainable by deliberately undermining a boulder | S-02          | FR-011, FR-012, FR-013                         | done     |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                          | Note                                                                                                   |
| ------ | ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| A      | Diggable cave      | `S-01` → `S-02` → `S-03`       | The mechanic spine, ending at the north star. `S-02` also needs Stream B's `F-01` before it can start.  |
| B      | Deterministic time | `F-01`                         | Runs in parallel with `S-01` from day one; joins Stream A at `S-02`. Kept minimal because of `time`.    |
| C      | Level authored for gravity | `S-04`                 | Branches off Stream A at `S-02`; runs parallel with `S-03`. This is the "decisions, not motion" proof.  |

## Baseline

What's already in place in the codebase as of `2026-08-02` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 7 SSR + React 19; the whole game is one island,
  `src/components/game/GameEntry.tsx:155`, with tile artwork in
  `src/components/game/TileArt.tsx`. Tailwind 4.
- **Backend / API:** present — Astro SSR endpoints under `src/pages/api/auth/`. The game
  makes zero server calls during play, and this change adds none.
- **Data:** absent (for the game) — `supabase/migrations/` is empty; the board is an
  immutable module-level constant (`src/components/game/GameEntry.tsx:140`) and all play
  state is React state. The only persistence is a sessionStorage attempt counter
  (`src/lib/game-guardrails.ts:26`), which this change does not touch.
- **Auth:** present — Supabase SSR client plus `src/middleware.ts`. The game surface is
  deliberately unauthenticated and stays that way.
- **Deploy / infra:** present — Cloudflare Workers via wrangler (`npm run deploy` chain);
  GitHub Actions `.github/workflows/ci.yml` runs lint + build only, no tests.
- **Observability:** absent — no logging library, error tracking, or metrics. The PRD
  requires none; see `## Parked`.
- **Test surface:** partial — Playwright E2E only (`tests/e2e/guardrails.spec.ts`) against
  16 stable test IDs in `src/lib/game-guardrails.ts:7`. No unit-test runner, and no way to
  control time from a test. This is the gap `F-01` exists to close.

## Foundations

### F-01: One time source the game reads and tests can drive

- **Outcome:** (foundation) the game reads elapsed time from a single injectable source
  rather than ad-hoc timers, the two tunable constants (400 ms grace, 120 ms per tile)
  live in one place, and a test can advance that clock deterministically instead of
  sleeping.
- **Change ID:** `deterministic-game-clock`
- **PRD refs:** Constraints & Compatibility → "The same inputs issued at the same moments
  produce the same outcome — the level is learnable by repetition, and the change is
  testable"; Constraints → "Miner movement is visually acknowledged in under 100 ms";
  Open Question 2.
- **Unlocks:** `S-02`, `S-03`, `S-04` — none of them can be verified without a controllable
  clock, because every one of their acceptance criteria is phrased in milliseconds. Also
  reduces Open Roadmap Question 2 from an open question to a settled approach.
- **Prerequisites:** —
- **Parallel with:** `S-01`
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced here because it is the cheapest point to make time controllable —
  before any timing behaviour exists to retrofit. The real risk is scope creep: with
  `top_blocker: time`, this must stay a time source plus a test seam, not a game-engine
  extraction. If it starts to look like "move the simulation out of `GameEntry.tsx`",
  it has outgrown its purpose and should be cut back to what `S-02` needs to be verified.
- **Status:** done

## Slices

### S-01: Miner digs a corridor that stays dug

- **Outcome:** user can move into a Dirt tile, remove it, and leave open space behind that
  persists for the rest of the attempt — and "Play again" restores it.
- **Change ID:** `diggable-dirt-corridors`
- **PRD refs:** US-01, FR-001, FR-002, FR-010, FR-013, FR-014
- **Prerequisites:** —
- **Parallel with:** `F-01`
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the load-bearing model change — the walkable tile kind is redefined as
  Dirt, a new tile kind is introduced for open space, and the board stops being a module
  constant and becomes per-attempt state. Everything downstream reads a mutated board, so
  getting this wrong is expensive later and cheap now. It is sequenced first because it is
  the only slice with no prerequisites that other slices need. Watch the reset path: the
  existing "Play again" restores React state, and it must now also restore the board.
- **Status:** done

### S-02: Undermine a boulder and watch it fall

- **Outcome:** user can dig out the Dirt beneath a boulder, see the boulder telegraph as
  unstable for 400 ms, then fall one tile per 120 ms until it rests on Dirt, a wall, a gem
  or another boulder — including chain reactions when the support that fell away was
  itself a boulder.
- **Change ID:** `boulder-gravity-and-fall`
- **PRD refs:** US-02, FR-003, FR-004, FR-005, FR-006, FR-009, FR-010
- **Prerequisites:** `S-01`, `F-01`
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How does a non-sighted player perceive the 400 ms grace window? The instability
    telegraph is visual only, and the live status region currently reports state on
    player-initiated changes. — Owner: user. Block: no.
- **Risk:** The first slice where the board changes without the player pressing a key, so
  this is where three guardrails are exercised at once: input stays acknowledged under
  100 ms while several boulders move, motion reads as continuous across the full 96-tile
  board, and "Play again" now also has to return every boulder to its start position. It
  carries more Functional Requirements than its siblings, but they are one mechanic — the
  fall lifecycle — and splitting them would produce a boulder that wobbles but never
  lands. Chain reactions (FR-009) are the part most likely to surprise; they are emergent,
  not a separate feature.
- **Status:** done

### S-03: Crushed by your own dig — Failed

- **Outcome:** user can be killed by a boulder they undermined — the boulder moves into
  the Miner's tile, the level ends immediately with a **Failed** outcome, and the replay
  prompt appears exactly as it does for the existing spike loss.
- **Change ID:** `crushed-by-boulder-failure`
- **PRD refs:** US-03, FR-007, FR-008, FR-014
- **Prerequisites:** `S-02`
- **Parallel with:** `S-04`
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the north star, so the risk here is a product risk, not a technical
  one: if 400 ms reads as unfair or as trivially safe, the mechanic fails its own Primary
  criterion and the two constants get tuned — which is exactly why `F-01` put them in one
  place. The technical trap is asymmetry: the boulder must be the moving party. Walking
  into a boulder stays a rejected move and must never become a death, and standing under a
  stable boulder must stay safe indefinitely. The existing losing status is reused, not
  replaced, so only the player-facing message differs from the cave-in.
- **Status:** done

### S-04: A gem you have to undermine to reach

- **Outcome:** user can find at least one gem that is only obtainable by deliberately
  removing the Dirt holding a boulder, on a level authored as solid Dirt with carved
  starting spaces — with a route to two gems and the exit still available from the
  starting position.
- **Change ID:** `gravity-aware-level-layout`
- **PRD refs:** FR-011, FR-012, FR-013
- **Prerequisites:** `S-02`
- **Parallel with:** `S-03`
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The PRD promoted this from Secondary to Primary because redefining the
  walkable tile forces a re-author regardless. The hard part is FR-012: hand-authoring a
  layout against a live simulation where no boulder falls at t=0 in a way that seals the
  exit, and where two gems plus the exit remain reachable. Several constraints are frozen
  and narrow the search — 12×8 dimensions, a two-gem quota, and spikes must remain present
  so the closed `level-end-states` change keeps its coverage. It runs parallel with `S-03`
  because gravity, not lethality, is what the layout is authored against; but a playtest
  that reads as "the mechanic produces decisions" needs both.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                                             | Ready for `/10x-plan` | Notes                                                     |
| ---------- | ---------------------------- | ----------------------------------------------------------------- | --------------------- | --------------------------------------------------------- |
| F-01       | `deterministic-game-clock`   | Single injectable time source with test-drivable clock            | yes                   | Keep minimal — time source + test seam, not an extraction. |
| S-01       | `diggable-dirt-corridors`    | Redefine walkable tile as Dirt; digging leaves persistent corridor | yes                   | Run `/10x-plan diggable-dirt-corridors`                    |
| S-02       | `boulder-gravity-and-fall`   | Boulder gravity: grace window, fall, landing, chain reactions      | no                    | Needs `S-01` and `F-01`                                    |
| S-03       | `crushed-by-boulder-failure` | Falling boulder crushes the Miner — Failed outcome                 | no                    | North star. Needs `S-02`                                   |
| S-04       | `gravity-aware-level-layout` | Re-author the level for gravity with an undermine-gated gem        | no                    | Needs `S-02`                                               |

## Open Roadmap Questions

1. **How does a non-sighted player perceive the 400 ms grace window?** — Owner: user.
   Block: `S-02` (non-blocking). The instability telegraph is described as visual only.
   The live status region is the only non-visual channel and currently reports state on
   player-initiated changes; announcing every wobble would flood it, announcing nothing
   removes the reaction window for screen-reader users entirely. Preserving the
   accessibility guardrails was named must-preserve during shaping, and the corresponding
   Socratic challenge on FR-004 was dismissed — so this is genuinely unresolved rather
   than decided. It will not stop `S-02` from being planned, but it can silently regress a
   preserved guardrail.
2. **How is time-dependent behaviour tested?** — Owner: user. Block: `roadmap-wide`
   (non-blocking). Existing tests assume a static, deterministic board, and there is no
   unit-test runner — only Playwright. The repeatability property implies the clock must
   be controllable from tests. `F-01` exists to answer this; if `F-01` is cut, this
   question re-opens and every gravity slice loses its verification path.

## Parked

- **Boulder pushing and diagonal sliding** — Why parked: PRD §Non-Goals. Raised and
  rejected during the Socratic round; listed to close the door rather than leave it ajar.
- **Falling gems** — Why parked: PRD §Non-Goals. Gems stay immobile and act as boulder
  supports, keeping the falling-object simulation to a single object type.
- **Multiple levels and progression** — Why parked: PRD §Non-Goals. Still one level; no
  level select, saved progress, or leaderboard.
- **Level editor and persistence** — Why parked: PRD §Non-Goals, explicitly on
  delivery-window grounds.
- **Unwinnable-state detection** — Why parked: PRD §Non-Goals and FR-002's Socratic
  resolution. No solver, no warning; a player who soft-locks themselves hits "Play again".
- **Active enemies, monsters, and a per-level time limit** — Why parked: the PRD
  deliberately declined to make these Non-Goals, so they stay available rather than
  closed. Nothing in this roadmap sequences them.
- **Observability for the game surface** — Why parked: the baseline reports it absent and
  the PRD requires nothing here. With `main_goal: market-feedback` and `top_blocker: time`,
  adding it would be investment in a layer no success criterion touches.

## Done

All five roadmap items are implemented, reviewed, and covered by the E2E suite (29 tests).
Changes remain in `context/changes/` at `status: impl_reviewed`; `/10x-archive` will move them
under `context/archive/` and restate them here.

| ID   | Change ID                    | Landed | Note                                                                     |
| ---- | ---------------------------- | ------ | ------------------------------------------------------------------------ |
| F-01 | `deterministic-game-clock`   | ✅     | Answers Open Roadmap Question 2: `?clock=manual` publishes a drivable clock. |
| S-01 | `diggable-dirt-corridors`    | ✅     | Board is per-attempt state; Dirt is diggable; corridors persist.          |
| S-02 | `boulder-gravity-and-fall`   | ✅     | 400 ms telegraph, 120 ms/tile fall, chain reactions.                      |
| S-03 | `crushed-by-boulder-failure` | ✅     | North star — both outcomes of the reaction window are reachable.          |
| S-04 | `gravity-aware-level-layout` | ✅     | Undermine-gated gem; closed `S-02`'s deferred FR-005/FR-009 coverage.     |

**Open Roadmap Question 1 (screen-reader parity for the instability telegraph)** received a
minimal answer in `S-02`: the live region reports a *count* of boulders losing support, so it
announces once when the cave becomes unsettled and once when it settles rather than firing on
every wobble. This is a partial answer, not a full accessibility design — the question stays
open for the owner.
