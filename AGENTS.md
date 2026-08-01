# Repository Guidelines

BoulderGame is an Astro 7 SSR web app for a Boulder Dash-style arcade MVP, using React islands, TypeScript, Tailwind CSS, optional Supabase scaffold helpers, and Cloudflare Workers deployment. Treat `@CLAUDE.md` as the deeper tool-specific reference; keep this file as the quick cross-agent guide.

## Project Structure & Module Organization

- `src/pages/` holds Astro pages and API routes; API handlers use uppercase `GET`/`POST` exports.
- `src/components/` holds Astro and React UI; use React only for interactive islands.
- `src/components/ui/` contains shadcn/ui components; add new ones with `npx shadcn@latest add <name>`.
- `src/lib/` holds shared helpers and services, including Supabase and config utilities.
- `src/styles/global.css` and `public/` hold global styles and static assets.
- `supabase/` is for Supabase config and migrations; `context/` stores planning and verification artifacts and must be preserved.

## Build, Test, and Development Commands

- `npm run dev` starts the Astro dev server.
- `npm run build` builds the Cloudflare SSR output; CI runs this with Supabase secrets.
- `npm run preview` previews the production build.
- `npm run lint` runs type-aware ESLint.
- `npm run lint:fix` applies ESLint fixes.
- `npm run format` runs Prettier with Astro and Tailwind plugins.
- `npm run test:e2e` runs local Playwright smoke checks; do not add it to CI until the game-ready surface stabilizes.
- `npm run test:e2e:ui` opens Playwright UI mode for local debugging.
- `npm run deploy:site-check` validates `PUBLIC_SITE_URL` before production deploy.
- `npm run deploy:dry-run` builds and compiles the Cloudflare Worker upload without publishing.
- `npm run deploy` validates site metadata, builds, and deploys `boulder-game` to Cloudflare Workers; first production deploy requires human approval.
- `npm run deploy:tail`, `npm run deploy:list`, and `npm run deploy:status` inspect runtime logs and deployment state.
- `npm run deploy:rollback` rolls back a Worker deployment; use only after human approval.

## Coding Style & Naming Conventions

Use Node `22.14.0` from `.nvmrc`. Format with 2 spaces, semicolons, double quotes, trailing commas, and 120-character lines per `@.prettierrc.json`. TypeScript runs in strict Astro mode; use the `@/*` alias for `src/*`. Use `cn()` from `@/lib/utils` for conditional Tailwind classes instead of manual string concatenation. Do not use Next.js-only directives such as `"use client"`.

## Testing Guidelines

Use `tests/e2e/*.spec.ts` for Playwright smoke tests. For now, validate most changes with `npm run lint` and `npm run build`; run `npm run test:e2e` when a change touches game entry, browser behavior, guardrail selectors, or replay/input readiness. Playwright is local-only until CI is explicitly updated.

## Commit & Pull Request Guidelines

This repo has no commits yet, so no commit-message convention is established. Use short imperative subjects until a convention is introduced. PRs should describe the user-visible change, list validation commands run, link issues when available, and include screenshots for UI changes.

## Security & Configuration Tips

Copy `.env.example` to `.env` or `.dev.vars`; never commit real secrets. `SUPABASE_URL` and `SUPABASE_KEY` are optional scaffold variables for the no-auth MVP path. Set `PUBLIC_SITE_URL` to the real Workers URL, such as `https://boulder-game.your-account.workers.dev`, before production deploy. GitHub Actions runs `npm ci`, `npx astro sync`, `npm run lint`, and `npm run build` on `main`/`master` pushes and PRs. Do not perform first production deploy, domain changes, paid plan changes, destructive data operations, or primary secret rotation without human approval.
