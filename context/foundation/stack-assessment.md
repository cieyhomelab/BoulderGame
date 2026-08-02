---
project: boulder-game
assessed_at: 2026-08-02T12:50:37Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript 5.9
  framework: Astro 7.1.6 (SSR) + React 19.2 islands
  build_tool: Vite 8 (via Astro)
  test_runner: Playwright 1.62 (E2E only)
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 8
gates_partial: 1
gates_failed: 0
---

## Stack Components

**Language — TypeScript 5.9.** `tsconfig.json` extends `astro/tsconfigs/strict`; the resolved
config has `strict: true` and `strictNullChecks: true`. The `@/*` → `./src/*` path alias is
declared and used consistently. Type-aware linting is wired: `eslint.config.js:15` extends
`tseslint.configs.strictTypeChecked` and `stylisticTypeChecked` with `projectService: true`,
so lint failures include type-derived rules, not just syntax.

**Framework — Astro 7.1.6, `output: "server"`, React 19.2 islands.** `astro.config.mjs:14`
sets full SSR; `@astrojs/react` provides the island integration and `@astrojs/cloudflare` the
adapter. Server-only secrets are declared through Astro's typed `env.schema`
(`astro.config.mjs:20-25`) rather than raw `process.env`. UI is shadcn/ui ("new-york") under
`src/components/ui/` with `components.json` present.

**Build tool — Vite 8**, supplied by Astro and pinned via a `package.json` `overrides` entry.
Tailwind 4 is loaded as a Vite plugin (`@tailwindcss/vite`), not through a `tailwind.config.js`
— this is Tailwind's CSS-first v4 model.

**Test runner — Playwright 1.62, E2E only.** `playwright.config.ts` targets `tests/e2e/` with a
single Chromium project and a managed `webServer` on port 4321. Two files exist:
`tests/e2e/guardrails.spec.ts` and `tests/e2e/guardrail-assertions.ts`. **There is no unit or
component test runner** — no Vitest, Jest, or `node:test` in `package.json`.

**Package manager — npm**, evidenced by `package-lock.json` and `npm ci` in CI.

**CI/CD — GitHub Actions**, `.github/workflows/ci.yml`. Runs `npm ci` → `npx astro sync` →
`npm run lint` → `npm run build` on pushes and PRs to `main`/`master`. **E2E is not run in CI**
— `AGENTS.md:36` states this explicitly ("Playwright is local-only until CI is explicitly
updated").

**Deployment — Cloudflare Workers** via `wrangler.jsonc` and a scripted deploy chain
(`deploy:site-check` → `build` → `wrangler deploy --strict`), with tail/list/status/rollback
scripts alongside.

**Instruction files — both present.** `CLAUDE.md` (54 lines, tool-specific) and `AGENTS.md`
(44 lines, cross-agent). Pre-commit enforcement via husky + lint-staged (`eslint --fix` on
`*.{ts,tsx,astro}`, `prettier --write` on `*.{json,css,md}`).

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict |
|-------------|-------|------------|---------------|------------|---------|
| Language    | ✓     | —          | —             | —          | pass    |
| Framework   | —     | ✓          | ~             | ✓          | pass (partial on training data) |
| Build tool  | —     | ✓          | ~             | ✓          | pass (partial on training data) |
| Test runner | —     | —          | ✓             | ✓          | pass    |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable

**8 full passes, 1 partial (shared across framework and build tool), 0 outright failures.**

### Gate Details

#### Typed — PASS (language)

Evidence: `tsconfig.json:2` extends `astro/tsconfigs/strict`. `npx tsc --showConfig` resolves
to `strict: true`, `strictNullChecks: true`. Reinforced beyond the compiler by
`eslint.config.js:15` (`strictTypeChecked` + `stylisticTypeChecked` with `projectService`),
which CI enforces on every push via `npm run lint`.

**One targeted gap inside the pass**: `noUncheckedIndexedAccess` is **not** enabled. Array and
index-signature reads are typed as always-defined. For a grid game this is directly load-bearing
— the agent will write `board[y][x]` and TypeScript will not require an out-of-bounds guard.
The PRD's change makes board indexing pervasive and mutable (boulder support lookups scan the
tile *beneath* each boulder, including at the bottom row), so this is the one type-safety hole
that the planned work will actually walk into.

#### Convention-based — PASS (framework, build tool)

Evidence: the on-disk layout matches Astro's conventions exactly — file-based routing in
`src/pages/`, API routes in `src/pages/api/`, layouts in `src/layouts/`, shared helpers in
`src/lib/`, styles in `src/styles/`. React is confined to islands under `src/components/`.
Middleware sits at the conventional `src/middleware.ts`.

Reinforced by documented conventions in both instruction files: `AGENTS.md:5-12` states the
folder contract, `AGENTS.md:30-32` the formatting and alias conventions, and `CLAUDE.md`
repeats the API-route (`prerender = false`, uppercase `GET`/`POST`, zod validation) and
Tailwind (`cn()` helper, never manual string concat) rules. This is a pass-with-reinforcement:
the framework carries the conventions and the project has written them down.

#### Popular in training data — PARTIAL (framework, build tool), PASS (test runner)

Assessed within the JS/TS family, per the per-language-family rule.

At the *ecosystem* level this is a clear pass: Astro, React, Vite, Tailwind, Playwright, and
ESLint are all top-tier JS choices with deep training-corpus coverage.

The partial is at the **version** level. Nearly every load-bearing dependency sits a major
version ahead of where the bulk of training data concentrates:

| Dependency | Installed | Where most training data sits | Concrete confabulation risk |
|---|---|---|---|
| Astro | 7.1.6 | 4.x–5.x | outdated config keys, retired adapter options |
| Tailwind | 4.2 | 3.x | agent creates a `tailwind.config.js` that v4 ignores |
| Vite | 8 | 5.x–6.x | stale plugin API assumptions |
| React | 19.2 + react-compiler | 18.x | manual `useMemo`/`useCallback` the compiler makes redundant |
| ESLint | 9 flat config | 8.x `.eslintrc` | agent proposes `.eslintrc` edits that do nothing |

None of these makes the stack agent-hostile — they mean the agent's first guess will often be
the previous major's idiom, and the project must correct it in writing rather than rely on
recall. Compensation below.

Playwright 1.62 is a full pass: the API has been stable across recent versions and the idioms
in training data still apply.

#### Well-documented — PASS (framework, build tool, test runner)

Evidence: Astro publishes versioned docs at `docs.astro.build`; Tailwind 4, Vite 8, and
Playwright all maintain current, version-pinned, link-able official documentation. The
Cloudflare adapter (`@astrojs/cloudflare` 14.x) is the weakest link — it moves faster than the
Astro core docs and its Workers-runtime caveats are split across Astro and Cloudflare docs —
but it is still officially maintained and current.

**Project-level erosion of this gate**: `CLAUDE.md` opens with "**Astro 6** SSR app" while
`package.json` declares `^7.1.6` and the installed version is `7.1.6`. `AGENTS.md:3` correctly
says Astro 7. The project's own primary instruction file is a major version stale — an agent
that trusts it will reason about the wrong framework generation. This is the highest-value
single fix in this assessment because instruction files are read before any code.

## Gaps & Compensation

### Gap 1 — `CLAUDE.md` states the wrong Astro major version

**What failed**: not a criterion failure, but a direct erosion of the documentation gate at the
project level. `CLAUDE.md:7` says "Astro 6 SSR app"; reality is Astro 7.1.6.

**Why it matters for agent workflows**: instruction files are the first thing an agent reads and
the thing it trusts most, because it is stated as fact about *this* repo rather than recalled
from training. A wrong major version here actively steers the agent toward the older idioms it
was already biased toward — the two errors compound instead of cancelling.

**Compensation**: correct the version and add a version-pinning block covering every dependency
that is a major ahead of the training-data centre of mass. Ready-to-paste text below.

### Gap 2 — No unit-test layer, and the planned change specifically needs one

**What failed**: no criterion — Playwright passes both applicable gates. This is a *coverage*
gap, not a quality gap, but it collides head-on with the work described in the PRD.

**Why it matters**: the PRD introduces a 400 ms grace window and 120 ms-per-tile fall, and its
Open Question #2 asks how time-dependent behavior gets tested. The PRD also lists as a required
quality property that "the same inputs issued at the same moments produce the same outcome".
Playwright is the wrong instrument for that: it drives a real browser on a real clock, so
assertions on a 400 ms window become flaky-by-construction and each case costs seconds of wall
time. A boulder-support/gravity resolver is pure logic over a grid — it wants millisecond-level
unit tests with an injected clock, run in the hundreds.

Compounding it: **CI runs neither**. `.github/workflows/ci.yml:20-21` runs lint and build only,
so today no test of any kind gates a merge.

**Compensation**: this one is genuinely a small piece of work rather than a doc entry — add
Vitest for the simulation logic and keep Playwright for the browser-level guardrails. Because
Vite 8 is already in the tree, Vitest needs no new build config. Record the two-layer split as a
convention so the agent stops reaching for Playwright to test pure functions. Instruction text
below; the actual setup belongs in the implementation plan, not here.

### Gap 3 — `noUncheckedIndexedAccess` is off while the change makes grid indexing pervasive

**What failed**: nothing at the criterion level — the typed gate passes. This is a strictness
hole that the specific planned change will exercise.

**Why it matters**: boulder support resolution reads the tile below every boulder each time the
board changes. At the bottom row that read is out of bounds. Without
`noUncheckedIndexedAccess`, TypeScript reports `board[y + 1][x]` as a definite `Tile`, and the
agent has no compiler pressure to write the guard. The failure surfaces at runtime as a crash or
a boulder falling off the board.

**Compensation**: two options, and the cheaper one is the instruction-file rule. Enabling the
flag repo-wide would surface findings across all 29 existing source files inside a one-week
budget. The rule below gets the agent to guard board reads without a repo-wide type sweep;
enabling the flag is the better long-term move once this change ships.

### Gap 4 — Version-skew idioms (the partial on training data)

**What failed**: the training-data criterion, partially, at version granularity.

**Why it matters**: the agent's default output will be one major behind for Tailwind, ESLint,
React, and Vite. These are silent failures, not errors — a `tailwind.config.js` the agent
creates is simply ignored by v4, and manual memoization the react-compiler already handles just
adds noise to the diff.

**Compensation**: an explicit "this repo's version reality" block in the instruction file that
names the trap for each dependency.

### Recommended Instruction File Additions

Paste these into `CLAUDE.md` (the tool-specific reference). Gap 1's first line is a correction
to existing text, not an addition.

---

**1. Correct the stale version line.** In `CLAUDE.md`, replace:

```markdown
**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components.
```

with:

```markdown
**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components.
```

---

**2. Add a version-reality block** (addresses Gaps 1 and 4):

```markdown
## Version reality — do not rely on recall

Every load-bearing dependency here is a major ahead of where most examples sit. Check the
installed version before applying a remembered idiom.

| Dependency | Installed | Do NOT do |
| --- | --- | --- |
| Astro | 7.x | Do not use Astro 4/5 config keys or adapter options. `output: "server"` + `@astrojs/cloudflare` is the current setup. |
| Tailwind | 4.x | Do not create `tailwind.config.js` — v4 ignores it. Config is CSS-first; Tailwind loads as a Vite plugin (`@tailwindcss/vite`) and theme customization lives in `src/styles/global.css`. |
| Vite | 8.x | Do not assume Vite 5/6 plugin APIs. |
| React | 19.x + react-compiler | Do not add `useMemo`/`useCallback` for referential stability — `react-compiler` handles it and the rule is `error`. Add them only for genuinely expensive computation. |
| ESLint | 9.x flat config | Config lives in `eslint.config.js`. Do not propose `.eslintrc*` changes — they do nothing here. |

When a remembered API and the installed version disagree, the installed version wins. Verify
against `package.json` rather than guessing.
```

---

**3. Add a test-layering convention** (addresses Gap 2):

```markdown
## Testing layers

Two layers, and the choice between them is not a preference:

- **Unit tests — pure game logic.** Board state, digging, boulder support resolution, fall
  scheduling, win/lose evaluation. These are pure functions over a grid; test them directly
  with an injected clock, never through a browser.
- **E2E (`tests/e2e/*.spec.ts`, Playwright) — browser-level guardrails only.** Anonymous entry,
  keyboard input reaching the game, guardrail `data-testid` presence, replay reset.

Never assert a timing window (the 400 ms grace, the 120 ms-per-tile fall) through Playwright.
Real-clock browser assertions on sub-second windows are flaky by construction. Timing belongs
in unit tests with a controllable clock.

All simulation timing constants must be injectable — a module-level `const` that tests cannot
override makes the timing behavior untestable. Export them and allow an override at the
simulation's entry point.

Run `npm run test:e2e` when a change touches game entry, browser behavior, guardrail selectors,
or replay/input readiness. CI currently runs lint and build only.
```

---

**4. Add a board-indexing safety rule** (addresses Gap 3):

```markdown
## Board indexing

`noUncheckedIndexedAccess` is NOT enabled, so TypeScript will type `board[y][x]` as a defined
tile even when the index is out of bounds. The compiler will not catch it — you must.

Every board read that can leave the grid needs an explicit bounds check first. This applies
especially to support resolution, which reads the tile *below* a boulder: a boulder on the
bottom row has no tile beneath it, and `board[y + 1]` is `undefined` at runtime.

Prefer a single accessor over raw indexing:

    function tileAt(board: Board, x: number, y: number): Tile | undefined

and treat `undefined` as "outside the cave" — which, for support resolution, means supported
(a boulder does not fall off the bottom of the board).
```

---

**5. Optional, after this change ships** — enable the flag itself in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true
  }
}
```

Deferred deliberately: turning it on now surfaces findings across all existing source files
inside a one-week delivery window. Rule 4 buys the safety without the sweep.

## Summary

**Overall readiness: ready-with-compensation.** Eight of nine applicable criteria pass outright,
one is partial, none fail.

**Key strengths**

- End-to-end TypeScript in Astro's strict preset, with type-aware ESLint enforced in CI — the
  agent can reason about contracts from source without running anything.
- Astro's file-based conventions are followed faithfully on disk, and both instruction files
  restate them. An agent can predict where a new file belongs.
- Two instruction files already exist and are well-structured. Compensation here is editing
  good documents, not writing them from nothing.
- Pre-commit hooks (husky + lint-staged) catch style and type-aware lint issues before they
  reach a diff review.

**Key gaps**

1. `CLAUDE.md` says Astro 6; the project is on Astro 7. A one-line fix with outsized impact,
   because instruction files are trusted over recall.
2. No unit-test layer. Directly blocks the PRD's Open Question #2 — a 400 ms grace window and a
   120 ms-per-tile fall cannot be tested honestly through Playwright, and CI currently runs no
   tests at all.
3. `noUncheckedIndexedAccess` is off while the planned change makes grid indexing pervasive and
   introduces reads that go out of bounds at the board edge.
4. Version skew across Astro, Tailwind, Vite, React, and ESLint — the agent's first guess will
   often be the previous major's idiom.

Gaps 1, 3, and 4 are closed by pasting the instruction-file blocks above. Gap 2 is real work and
should be scheduled in the implementation plan for the boulder-gravity change rather than
treated as documentation.

**Recommended next step**: `/10x-health-check` — it audits dependency health, test-suite
coverage, and CI/CD gaps, and will pick up Gap 2 (no unit tests, no tests in CI) with concrete
remediation.
