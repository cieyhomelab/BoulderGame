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

### Testing

- `npm run test:e2e` — Playwright smoke tests (`tests/e2e/`, Chromium only; starts its own dev server on port 4321)
- `npm run test:e2e:ui` — Playwright UI mode for local debugging

Run these when a change touches game entry, browser behavior, guardrail selectors, or replay/input readiness. There is no unit-test runner; all automated tests are E2E.

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

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

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

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Board indexing

`noUncheckedIndexedAccess` is NOT enabled, so TypeScript will type `board[y][x]` as a defined tile even when the index is out of bounds. The compiler will not catch it — you must.

Every board read that can leave the grid needs an explicit bounds check first. This applies especially to support resolution, which reads the tile _below_ a boulder: a boulder on the bottom row has no tile beneath it, and `board[y + 1]` is `undefined` at runtime.

Prefer a single accessor over raw indexing:

```ts
function tileAt(board: Board, x: number, y: number): Tile | undefined;
```

and treat `undefined` as "outside the cave" — which, for support resolution, means supported (a boulder does not fall off the bottom of the board).

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npm run deploy` (requires Cloudflare account, `wrangler` auth, and `PUBLIC_SITE_URL` set to the real Workers URL)

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR to `main` or `master`, on Node 22 with npm caching:

`npm ci` → `npx astro sync` → `npm run lint` → `npm run build`

`SUPABASE_URL` and `SUPABASE_KEY` are passed to the build step from repository secrets (both are declared `optional` in the `astro.config.mjs` env schema).

**No tests run in CI.** Playwright (`npm run test:e2e`) is local-only until the workflow is explicitly updated — a green CI run means lint and build passed, nothing more.
