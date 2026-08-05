# Rules for AI

This file provides guidance to AI Agent when working with code in this repository.

## Commands

### Development

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)

- `npm run astro` — Astro CLI passthrough. `npm run astro -- check` is the full type-check across `.astro` files; there is no dedicated `typecheck` script.

### Testing

- `npm run test:e2e` — Playwright (`tests/e2e/`, Chromium only; starts its own dev server on port 4321)
- `npm run test:e2e:ui` — Playwright UI mode for local debugging
- `npm run level:check` — audit every cave in `LEVELS` (no browser, exits non-zero on failure)
- `npm run level:routes` — the same audit plus each cave's winning key sequence

213 tests across 13 spec files: `guardrails`, `digging`, `boulder-gravity`, `boulder-roll`, `boulder-crush`, `undermine-gated-gem`, `exit-switch`, `game-clock`, `level-progression`, `high-score`, `treasurer`, `level-invariants`, `level-solver`. (`guardrail-assertions.ts` is a shared helper, not a spec — it also owns `winningKeysFor` and `pressKeys`, which two specs replay searched routes with.)

`level-invariants` and `level-solver` are the odd ones out: they never open a page, running against the level data directly. Both iterate `LEVELS`, so adding a cave to the registry adds its coverage automatically — a new level that seals its own exit, drops a boulder before the player moves, or cannot be won at all fails there rather than in front of a player.

`treasurer` is split across both worlds for a reason worth copying: the rule that the Skarbek only ever stands in a dug tunnel is a property, so it is tested with no page at all, over hundreds of steps against a fixture board that cages the Miner where the walk cannot end early. Only the narrower question — that the shipped cave wires that simulation to the clock, the board and the loss it reports — is asked of a browser.

**Anything that walks the whole `LEVELS` registry belongs on `?clock=manual`.** The two progression tests that clear every cave in order do, and it is load-bearing rather than tidiness: `winningKeysFor` only returns routes proved to leave every boulder alone, so a frozen clock is the environment those routes were proved in, and a registry holding a cave with a Skarbek would otherwise put a randomly walking spirit on the board mid-replay.

Run these when a change touches game entry, browser behavior, guardrail selectors, simulation timing, or replay/input readiness. There is no unit-test runner; all automated tests are E2E.

### Deployment

- `npm run deploy:site-check` — validate `PUBLIC_SITE_URL` before a production deploy
- `npm run deploy:dry-run` — build and compile the Worker upload without publishing
- `npm run deploy` — site-check → build → `wrangler deploy --strict` (the full production path)
- `npm run deploy:tail` — stream live Worker logs
- `npm run deploy:list` / `npm run deploy:status` — inspect deployment history and current state
- `npm run deploy:rollback` — roll back a Worker deployment

Deploy through `npm run deploy`, never bare `wrangler deploy` — the script chain runs the `PUBLIC_SITE_URL` guard first. First production deploy, domain changes, and rollbacks require human approval.

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, and shadcn/ui components. Deployed to Cloudflare Workers. Supabase auth is optional starter scaffolding — the game itself is no-auth (see [Auth flow](#auth-flow)).

### Version reality — do not rely on recall

Every load-bearing dependency here is a major ahead of where most examples sit. Check the installed version before applying a remembered idiom.

| Dependency | Installed             | Do NOT do                                                                                                                                                                                |
| ---------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro      | 7.x                   | Do not use Astro 4/5 config keys or adapter options. `output: "server"` + `@astrojs/cloudflare` is the current setup.                                                                    |
| Tailwind   | 4.x                   | Do not create `tailwind.config.js` — v4 ignores it. Config is CSS-first; Tailwind loads as a Vite plugin (`@tailwindcss/vite`) and theme customization lives in `src/styles/global.css`. |
| Vite       | 8.x                   | Do not assume Vite 5/6 plugin APIs.                                                                                                                                                      |
| React      | 19.x + react-compiler | Do not add `useMemo`/`useCallback` for referential stability — `react-compiler` handles it and the rule is `error`. Add them only for genuinely expensive computation.                   |
| ESLint     | 9.x flat config       | Config lives in `eslint.config.js`. Do not propose `.eslintrc*` changes — they do nothing here.                                                                                          |

When a remembered API and the installed version disagree, the installed version wins. Verify against `package.json` rather than guessing.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default, so API routes do not need `export const prerender = false` — none of the existing routes declare it.

### Game logic

The game is the point of this repository; everything below `src/lib/` is domain code, not scaffolding.

| Module                  | Responsibility                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `boulder-simulation.ts` | Board state, boulder support, fall scheduling. Pure — `stepSimulation(input, nowMs)` maps `(state, time)` → state.                |
| `game-clock.ts`         | Clock abstraction. Real play uses `requestAnimationFrame`; `?clock=manual` installs a clock that only advances when told to.      |
| `game-guardrails.ts`    | MVP thresholds, `data-testid` values, session-local attempt counter.                                                              |
| `game-rules.ts`         | Move resolution, digging, win/loss, gravity and the Skarbek. Pure and time-injected. Shared by the component and the solver.      |
| `levels.ts`             | Cave definitions, the `LEVELS` play order, `parseLevel`, and `nextLevelAfter`. All board content lives here.                      |
| `treasurer.ts`          | The Skarbek: seeded random walk over dug tunnels, released by the first gem. Pure — `stepTreasurer(board, state, player, nowMs)`. |
| `level-solver.ts`       | Breadth-first search for a winning route, driving `game-rules.ts`. Proves a cave is winnable and emits the key sequence.          |
| `level-audit.ts`        | The design rules a cave must satisfy, as named checks. The single source for `level:check` and `level-invariants.spec.ts`.        |
| `config-status.ts`      | Reports which optional integrations are configured.                                                                               |

Rendering is one React island: `src/components/game/GameEntry.tsx`, with tile visuals in `TileArt.tsx`.

**Game rules belong in `game-rules.ts`, never in the component.** `GameEntry` is a driver: keyboard in, board out. It maps keys onto `MOVE_DELTAS` and calls `resolveMove`/`applySimulation`, but owns no rule of its own. The solver drives the same functions from a search, so a rule copied into the component would make the solver's proofs describe a game nobody plays.

**Board content belongs in `levels.ts`, never in the component.** `GameEntry` holds the active `ParsedLevel` in `GameState` — not in module scope or a separate `useState` — because the keyboard handler updates state functionally and would otherwise close over a stale level after advancing. Every cave is 8×12: the board's column count is a literal `grid-cols-12` class, and Tailwind 4 cannot generate that class from runtime data, so a differently sized level needs an inline `gridTemplateColumns` first.

**Keep simulation logic pure and time-injected.** `stepSimulation` takes `nowMs` as a parameter rather than calling `Date.now()` internally, which is what makes the grace window and fall cadence reproducible. Do not introduce `Date.now()`, `setTimeout`, or `performance.now()` into simulation code — take the clock or the timestamp as an argument. Randomness follows the same rule: `treasurer.ts` advances a seed carried in the state, and a `Math.random()` anywhere in the domain would make every chase unreplayable and every assertion about one a coin flip.

**What `solveLevel` proves is the cave's geometry, not that it is survivable.** The search runs with `createInitialGameState(level, { includeTreasurer: false })`, because a walker with a step always pending never settles and so has no state to compare — and an answer of "winnable if you are quick enough" is not a property of a cave. A green `winnable` check means the quota and the exit are reachable. Outrunning the Skarbek, like acting inside the boulder grace window, is an e2e concern. Anything replaying a solver route through the real rules must build its state the same way, or it is asking a question the route was never an answer to.

**Never assert a timing window through a real clock.** Timing assertions go through the manual clock (`?clock=manual`, published at `window.__boulderGameClock`), which advances by an exact number of milliseconds. Real-clock browser assertions on sub-second windows are flaky by construction.

### Auth flow

The MVP game path (`/`) never touches Supabase. These routes are starter scaffolding kept for a possible non-MVP path.

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`). **Returns `null` when either variable is missing** — every caller must handle that, and the existing routes do by redirecting with an error. Do not assume a non-null client.
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports, typed as `APIRoute`. The existing auth routes read `formData()` directly. **zod is not installed** — do not `import` it without adding the dependency first; if you introduce JSON body validation, install it deliberately rather than assuming it is present.
- **React**: no Next.js directives ("use client" etc.).
- **Services/helpers** go in `src/lib/`.

The following paths do **not** exist yet. Use them when the need first arises — do not assume they are already there, and do not create them speculatively:

- `src/types.ts` — shared entity/DTO types. Types currently live beside the code that uses them (e.g. `Board`, `Tile`, `SimulationInput` in `boulder-simulation.ts`).
- `src/components/hooks/` — extracted React hooks.
- `src/lib/services/` — extracted business logic, if `src/lib/` outgrows a flat layout.
- `supabase/migrations/` — naming format `YYYYMMDDHHmmss_short_description.sql`. There are no tables and no migrations; the auth scaffold uses only Supabase's built-in `auth.users`. If you add a table, enable RLS with granular per-operation, per-role policies.

### Board indexing

`noUncheckedIndexedAccess` is NOT enabled, so TypeScript will type `board[y][x]` as a defined tile even when the index is out of bounds. The compiler will not catch it — you must.

Every board read that can leave the grid needs an explicit bounds check first. This applies especially to support resolution, which reads the tile _below_ a boulder: a boulder on the bottom row has no tile beneath it, and `board[row + 1]` is `undefined` at runtime.

**The accessor already exists — use it instead of raw indexing:**

```ts
// src/lib/boulder-simulation.ts
export function tileAt(board: Board, row: number, col: number): Tile | undefined;
export function withTile(board: Board, row: number, col: number, tile: Tile): Board;
```

Note the argument order: **`(row, col)`, not `(x, y)`.** Row is the vertical index, column the horizontal one — getting this backwards type-checks cleanly and fails silently.

Treat `undefined` as "outside the cave", which for support resolution means supported — a boulder does not fall off the bottom of the board. `isSupported()` already encodes this; prefer calling it over re-deriving the rule.

Writes go through `withTile`, which copies only the affected row so unchanged rows stay referentially shared between renders. Do not mutate a board in place.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` — both optional. Copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev. The game runs with them blank.
- Local Supabase: `npx supabase start` (requires Docker, ~7 GB RAM). **This is the only part of the project that needs Docker** — the game has no container dependency. `supabase/config.toml` is committed, so `supabase init` is not needed.
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npm run deploy` (requires Cloudflare account, `wrangler` auth, and `PUBLIC_SITE_URL` set to the real Workers URL)
- `PUBLIC_SITE_URL` also gates the sitemap: `astro.config.mjs` only registers `@astrojs/sitemap` when it is set.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to `main` or `master`, on Node 22 with npm caching:

`npm ci` → `npx astro sync` → `npm run lint` → `npm run level:check` → `npm run build`

`SUPABASE_URL` and `SUPABASE_KEY` are passed to the build step from repository secrets (both are declared `optional` in the `astro.config.mjs` env schema).

**No browser tests run in CI.** Playwright (`npm run test:e2e`) is local-only until the workflow is explicitly updated. `npm run level:check` does run — it needs no browser — so a green CI run means lint, level design, and build passed, but no gameplay was exercised.

### Adding a level

The guided path is the `new-level` skill (`.claude/skills/new-level/`): it asks what the cave should be, drafts it, and iterates on the gate. By hand it is the same three steps.

Append a `LevelDefinition` to `LEVELS` in `src/lib/levels.ts` and run `npm run level:check`. Failures name the offending coordinates. Nothing else needs editing: `level-invariants` and `level-solver` iterate the registry, and `level-progression` derives its keystrokes from the solver rather than hard-coded routes, so the browser suite covers the new cave without changes.

The gate checks correctness, never interest. A cave with the quota three steps from the start and boulders that do nothing passes every check — judging whether it is worth playing stays a human call, which is what the skill's opening questions are for.

Tile markers in `rows`: `#` wall, `.` Dirt, `" "` carved open space, `g` gem, `r` boulder, `h` spikes, `e` exit. Two are render-time overlays that `parseLevel` resolves away to open space and hands back as coordinates — `p`, the Miner's start, and `t`, the niche a Skarbek is sealed into. A cave may have no `t`; it may not have two.

**A cave with a `t` in it is not covered by the winnability proof the way the others are** — see `solveLevel` above. Place him so the danger is opt-in and the Miner can never share a tile with him while he sleeps: in `cave-12` his niche is opened by the very gem that wakes him, which gets both for free. A `t` sitting on the solver's route would put the Miner and a dormant spirit in one cell and force the renderer to pick a winner.
