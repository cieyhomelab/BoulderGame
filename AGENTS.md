# Repository Guidelines

BoulderGame is an Astro 7 SSR web app for a Boulder Dash-style arcade MVP, using React islands, TypeScript, Tailwind CSS, optional Supabase scaffold helpers, and Cloudflare Workers deployment. Treat `@CLAUDE.md` as the deeper tool-specific reference; keep this file as the quick cross-agent guide.

## Project Structure & Module Organization

- `src/pages/` holds Astro pages and API routes; `index.astro` is the game, the rest is auth scaffold. API handlers use uppercase `GET`/`POST` exports.
- `src/components/game/` holds the game island (`GameEntry.tsx`) and tile visuals (`TileArt.tsx`).
- `src/components/` holds Astro and React UI; use React only for interactive islands.
- `src/components/ui/` contains shadcn/ui components; add new ones with `npx shadcn@latest add <name>`.
- `src/lib/` holds the game logic — `boulder-simulation.ts` (board state, boulder support, falls), `game-clock.ts` (real and manual clocks), `game-guardrails.ts` (thresholds and test IDs) — plus Supabase and config helpers.
- `src/styles/global.css` and `public/` hold global styles and static assets.
- `tests/e2e/` holds Playwright specs; `scripts/` holds the deploy guard.
- `supabase/` holds local CLI config only — there are no tables and no `migrations/` directory. `context/foundation/` stores planning and assessment artifacts and must be preserved.

## Game Logic Rules

- Simulation code is pure and time-injected: `stepSimulation(input, nowMs)` maps `(state, time)` → state. Do not call `Date.now()`, `performance.now()`, or `setTimeout` inside simulation code — take the timestamp or clock as an argument.
- Read the board through `tileAt(board, row, col)` from `boulder-simulation.ts`, never raw `board[row][col]`. Argument order is `(row, col)`, not `(x, y)`. `noUncheckedIndexedAccess` is off, so out-of-bounds reads type-check silently.
- Write through `withTile(board, row, col, tile)`; do not mutate a board in place.
- `undefined` from `tileAt` means "outside the cave", which counts as supported — a boulder does not fall off the bottom row. `isSupported()` already encodes this.

## Build, Test, and Development Commands

- `npm run dev` starts the Astro dev server.
- `npm run build` builds the Cloudflare SSR output; CI runs this with Supabase secrets.
- `npm run preview` previews the production build.
- `npm run lint` runs type-aware ESLint.
- `npm run lint:fix` applies ESLint fixes.
- `npm run format` runs Prettier with Astro and Tailwind plugins.
- `npm run astro` passes through to the Astro CLI; `npm run astro -- check` is the full type-check across `.astro` files (there is no `typecheck` script).
- `npm run test:e2e` runs the local Playwright suite — 29 tests across 6 spec files covering anonymous entry, keyboard movement, digging, boulder gravity and crush, gem collection, gated-gem undermining, loss, safe and risky completion, replay, the 3-attempt repeat-play target, and manual-clock behavior; CI still runs lint and build only.
- `npm run test:e2e:ui` opens Playwright UI mode for local debugging.
- `npm run deploy:site-check` validates `PUBLIC_SITE_URL` before production deploy.
- `npm run deploy:dry-run` builds and compiles the Cloudflare Worker upload without publishing.
- `npm run deploy` validates site metadata, builds, and deploys `boulder-game` to Cloudflare Workers; first production deploy requires human approval.
- `npm run deploy:tail`, `npm run deploy:list`, and `npm run deploy:status` inspect runtime logs and deployment state.
- `npm run deploy:rollback` rolls back a Worker deployment; use only after human approval.

## Coding Style & Naming Conventions

Use Node `22.14.0` from `.nvmrc`. Format with 2 spaces, semicolons, double quotes, trailing commas, and 120-character lines per `@.prettierrc.json`. TypeScript runs in strict Astro mode; use the `@/*` alias for `src/*`. Use `cn()` from `@/lib/utils` for conditional Tailwind classes instead of manual string concatenation. Do not use Next.js-only directives such as `"use client"`. React 19 runs with `react-compiler`, so do not add `useMemo`/`useCallback` for referential stability — the rule is an error. Tailwind is v4: there is no `tailwind.config.js` and creating one has no effect; theme customization lives in `src/styles/global.css`. Pre-commit hooks (husky + lint-staged) run `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

`src/types.ts`, `src/components/hooks/`, and `src/lib/services/` do not exist yet — create them only when a change actually needs them. zod is not installed; do not import it without adding the dependency first.

## Testing Guidelines

Use `tests/e2e/*.spec.ts` for Playwright specs (`guardrail-assertions.ts` is a shared helper, not a spec). For now, validate most changes with `npm run lint` and `npm run build`; run `npm run test:e2e` when a change touches game entry, browser behavior, guardrail selectors, simulation timing, or replay/input readiness. Playwright is local-only until CI is explicitly updated.

Never assert a timing window against a real clock. Append `?clock=manual` to install a clock that does not tick on its own, published at `window.__boulderGameClock`, and advance it by an exact number of milliseconds. Real-clock assertions on sub-second windows are flaky by construction. There is no unit-test runner yet, so pure simulation logic is currently exercised through the browser.

## Commit & Pull Request Guidelines

Use Conventional Commit-style subjects already present in history, for example `feat(scope): short imperative summary` or `test(scope): short imperative summary`. PRs should describe the user-visible change, list validation commands run, link issues when available, and include screenshots for UI changes.

## Security & Configuration Tips

Copy `.env.example` to `.env` or `.dev.vars`; never commit real secrets. `SUPABASE_URL` and `SUPABASE_KEY` are optional scaffold variables for the no-auth MVP path — the game runs with them blank, and `createClient()` returns `null` when either is missing, so every caller must handle that. Docker is needed only for the optional local Supabase stack (`npx supabase start`), never for the game itself. Set `PUBLIC_SITE_URL` to the real Workers URL, such as `https://boulder-game.your-account.workers.dev`, before production deploy. GitHub Actions runs `npm ci`, `npx astro sync`, `npm run lint`, and `npm run build` on `main`/`master` pushes and PRs. Do not perform first production deploy, domain changes, paid plan changes, destructive data operations, or primary secret rotation without human approval.
