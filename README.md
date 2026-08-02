# BoulderGame

![](./public/template.png)

A web arcade game MVP in the spirit of Boulder Dash, built for fast public playtests and retro replayability.

## Tech Stack

**Runtime & framework**

- [Astro](https://astro.build/) v7 - Web framework, full SSR (`output: "server"`)
- [React](https://react.dev/) v19 - Interactive islands, with `react-compiler` enabled
- [TypeScript](https://www.typescriptlang.org/) v5 - Strict mode via `astro/tsconfigs/strict`
- [Vite](https://vite.dev/) v8 - Build tooling, supplied by Astro (version pinned via `overrides`)
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime (`@astrojs/cloudflare`)

**UI**

- [Tailwind CSS](https://tailwindcss.com/) v4 - CSS-first config, loaded as a Vite plugin (no `tailwind.config.js`)
- [shadcn/ui](https://ui.shadcn.com/) - "new-york" variant, components in `src/components/ui/`

**Testing & quality**

- [Playwright](https://playwright.dev/) v1.62 - End-to-end tests, Chromium only
- [ESLint](https://eslint.org/) v9 - Flat config with type-aware rules (`strictTypeChecked`)
- [Prettier](https://prettier.io/) - With `prettier-plugin-astro` and `prettier-plugin-tailwindcss`
- [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) - Pre-commit hooks

**Optional**

- [Supabase](https://supabase.com/) - Auth scaffolding, not used by the MVP game path (see [Supabase Configuration](#supabase-configuration))

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

That is all you need to build, run, and play the game.

[Docker](https://www.docker.com/) is **not** required by the game. It is only needed if you choose
to run the optional local Supabase stack while working on the auth scaffolding — the Supabase CLI
starts Postgres and GoTrue in containers. See [Supabase Configuration](#supabase-configuration).

## Getting Started

1. Clone the repository:

```bash
git clone <repository-url>
cd BoulderGame
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

Leaving the Supabase values blank is fine — the game runs without them. Only fill them in if you
work on the starter auth routes; see [Supabase Configuration](#supabase-configuration) below.

4. Run the development server:

```bash
npm run dev
```

The game is at `/`. No sign-in, no account, no backend required.

## Available Scripts

**Development**

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run astro` - Run the Astro CLI directly (e.g. `npm run astro -- check`)

**Quality**

- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run test:e2e` - Run local Playwright checks
- `npm run test:e2e:ui` - Run Playwright in UI mode for local debugging

There is no dedicated `typecheck` script. Type errors surface through `npm run lint`, which runs
type-aware ESLint rules. For a full compiler pass across `.astro` files, use
`npm run astro -- check`.

**Deployment**

- `npm run deploy:site-check` - Validate `PUBLIC_SITE_URL` before production deploy
- `npm run deploy:dry-run` - Build and compile the Cloudflare Worker upload without publishing
- `npm run deploy` - Validate site metadata, build, and deploy `boulder-game` after human approval
- `npm run deploy:tail` - Tail live Worker logs for `boulder-game`
- `npm run deploy:list` - List recent Cloudflare Worker deployments
- `npm run deploy:status` - Show current Cloudflare Worker deployment status
- `npm run deploy:rollback` - Roll back to a previous Worker deployment after human approval

## Game Architecture

The game logic lives in `src/lib/` as plain TypeScript, deliberately kept separate from rendering:

| Module                  | Responsibility                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boulder-simulation.ts` | Board state, boulder support resolution, and fall scheduling. Pure functions — `stepSimulation(input, nowMs)` takes time as an explicit parameter and returns the next state. |
| `game-clock.ts`         | Clock abstraction. Real play uses a `requestAnimationFrame`-backed clock; tests can swap in a manual clock that only advances when told to.                                   |
| `game-guardrails.ts`    | Canonical MVP thresholds, `data-testid` values, and the session-local attempt counter.                                                                                        |
| `config-status.ts`      | Reports which optional integrations are configured, so missing Supabase credentials degrade gracefully instead of erroring.                                                   |

Rendering is a single React island, `src/components/game/GameEntry.tsx`, with tile visuals in
`TileArt.tsx`.

Because boulder physics is a pure function of `(state, time)`, the same inputs at the same
timestamps always produce the same outcome — timing behavior is reproducible rather than
wall-clock dependent.

### The manual clock

Appending `?clock=manual` to the game URL installs a clock that does not tick on its own and
publishes itself at `window.__boulderGameClock`. Tests advance time by an exact number of
milliseconds instead of sleeping, which keeps assertions about the boulder grace window and fall
cadence deterministic. In normal play the parameter is absent and the manual clock is never
exposed.

## BoulderGame MVP Guardrails

The game MVP keeps three product guardrails in code so future slices can verify them consistently:

- First play session ready in less than 3 seconds.
- In-game input response in less than 100 ms.
- Replay signal proven by 3 attempts in one local browser session.

The canonical thresholds, test IDs, and session-local attempt counter contract live in `src/lib/game-guardrails.ts`.
Attempt count is stored client-side for the current session only; no account, profile, database, or analytics service is required for the MVP.

## Testing

All automated tests are end-to-end (Playwright, Chromium only). There is no unit-test runner yet.

```bash
npx playwright install
npm run test:e2e
```

Playwright starts its own dev server on port 4321. The suite is 29 tests across 6 spec files in
`tests/e2e/`:

| Spec                          | Covers                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `guardrails.spec.ts`          | Anonymous entry, keyboard movement, gem collection, loss, safe completion, risky higher-score completion, replay, and the 3-attempt repeat-play target |
| `digging.spec.ts`             | Dirt removal and its restoration on replay                                                                                                             |
| `boulder-gravity.spec.ts`     | Boulder support and falling behavior                                                                                                                   |
| `boulder-crush.spec.ts`       | Crush outcomes when a boulder lands on the player                                                                                                      |
| `undermine-gated-gem.spec.ts` | A bonus gem gated behind a boulder that must be undermined                                                                                             |
| `game-clock.spec.ts`          | Manual clock installation, that it does not self-tick, and exact advancement                                                                           |

`guardrail-assertions.ts` in the same folder is a shared helper, not a spec.

Run these when a change touches game entry, browser behavior, guardrail selectors, simulation
timing, or replay/input readiness.

**These checks are local-only.** CI runs lint and build only — a green CI run means the project
lints and compiles, nothing more.

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── game/            # GameEntry island + TileArt
│   │   ├── auth/            # Sign-in / sign-up form pieces (scaffold)
│   │   └── ui/              # shadcn/ui components
│   ├── layouts/             # Astro layouts
│   ├── lib/                 # Game logic, Supabase client, helpers
│   ├── pages/
│   │   ├── index.astro      # The game
│   │   ├── dashboard.astro  # Protected page example (scaffold)
│   │   ├── auth/            # Auth pages (scaffold)
│   │   └── api/auth/        # Auth endpoints (scaffold)
│   ├── styles/global.css    # Tailwind v4 theme configuration
│   ├── middleware.ts        # Runs per request; resolves the current user
│   └── env.d.ts
├── tests/e2e/               # Playwright specs
├── scripts/                 # require-public-site-url.mjs (deploy guard)
├── public/                  # Static assets served as-is
├── supabase/config.toml     # Local Supabase CLI config (optional stack)
├── design/                  # Design source files (.pen)
├── context/foundation/      # Product & architecture docs (PRD, roadmap, assessments)
├── astro.config.mjs         # SSR, Cloudflare adapter, env schema
├── wrangler.jsonc           # Cloudflare Workers config
├── eslint.config.js         # ESLint 9 flat config
├── playwright.config.ts
├── AGENTS.md / CLAUDE.md    # Instructions for AI coding agents
└── .nvmrc                   # Node version
```

Path alias: `@/*` maps to `./src/*`.

## Project Documentation

`context/foundation/` holds the planning and assessment artifacts behind this project:

| Document              | Contents                                      |
| --------------------- | --------------------------------------------- |
| `prd.md`              | Product requirements                          |
| `roadmap.md`          | Delivery slices                               |
| `shape-notes.md`      | Discovery notes preceding the PRD             |
| `tech-stack.md`       | Stack selection and rationale                 |
| `infrastructure.md`   | Deployment platform research                  |
| `stack-assessment.md` | How agent-friendly the stack is, and the gaps |
| `health-check.md`     | Dependency, test, and CI health audit         |

`AGENTS.md` and `CLAUDE.md` at the repository root carry the working conventions for AI coding
agents — folder contracts, version-reality warnings, and the board-indexing safety rule.

## Supabase Configuration

> **This section is entirely optional.** The BoulderGame MVP is no-auth and never calls Supabase
> on the play path. You can build, run, test, and deploy the game without reading any further.

This starter still includes [Supabase](https://supabase.com/) authentication scaffolding —
`/auth/*` pages, `/api/auth/*` endpoints, and a protected `/dashboard` example. Environment
variables are declared via Astro's `astro:env` schema as optional server-only secrets, so they are
never exposed to the client.

When `SUPABASE_URL` and `SUPABASE_KEY` are absent, `createClient()` in `src/lib/supabase.ts`
returns `null` and the app degrades gracefully: the game works normally and the auth routes simply
report that authentication is disabled. Nothing crashes.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM — the Supabase CLI runs Postgres and the
auth server in containers. This is the only part of the project that touches Docker; the game
itself has no container dependency.

`supabase/config.toml` is already committed, so no `supabase init` is needed.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

3. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) as `boulder-game`. Set `PUBLIC_SITE_URL` to the real Workers URL before release builds, for example `https://boulder-game.your-account.workers.dev`; replace it only after a custom domain is explicitly approved.

`PUBLIC_SITE_URL` also drives the sitemap: `astro.config.mjs` only registers `@astrojs/sitemap`
when the variable is set, so a build without it produces no sitemap. That is why
`deploy:site-check` guards the production path — always deploy through `npm run deploy` rather
than bare `wrangler deploy`, so the guard runs first.

First production deployment, domain changes, paid plan changes, destructive data operations, and primary secret rotation require human approval.

1. Run local verification:

```bash
npm run lint
npm run build
npm run test:e2e
```

2. Compile the Worker upload without publishing:

```bash
npm run deploy:dry-run
```

3. Set the confirmed public URL before production deploy:

```bash
export PUBLIC_SITE_URL=https://boulder-game.your-account.workers.dev
npm run deploy:site-check
```

4. Authenticate Wrangler if needed:

```bash
npx wrangler login
```

5. Deploy with Wrangler after approval:

```bash
npm run deploy
```

Record the URL printed by Wrangler in the playtest notes or release issue.

6. Inspect runtime logs and deployment state:

```bash
npm run deploy:tail
npm run deploy:list
npm run deploy:status
```

7. If a deployed version must be reverted, use rollback after approval:

```bash
npm run deploy:rollback
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as Cloudflare secrets only if the scaffold auth routes remain in use for a non-MVP path.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main` and `master`, on
Node 22 with npm caching:

```
npm ci → npx astro sync → npm run lint → npm run build
```

`SUPABASE_URL` and `SUPABASE_KEY` are passed to the build step from repository secrets; both are
declared optional in the Astro env schema, so the build succeeds without them.

**No tests run in CI** — the Playwright suite is local-only until the workflow is explicitly
updated. A green CI run means lint and build passed, nothing more.

This repository does not deploy to production from CI.

Locally, husky + lint-staged run on every commit: `eslint --fix` on `*.{ts,tsx,astro}` and
`prettier --write` on `*.{json,css,md}`.

## License

MIT
