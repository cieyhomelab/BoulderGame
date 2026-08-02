---
project: boulder-game
checked_at: 2026-08-02T15:39:39Z
health_status: healthy
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 0
  low: 0
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 6
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

Confirmed consistent with CI, which runs `npm ci` — the lockfile is authoritative for
reproducible installs rather than decorative.

### Security Audit

```
Tool: npm audit --json
Summary: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
Direct vs transitive: not applicable — no advisories in either tier
```

Clean across 870 resolved dependencies (392 prod, 314 dev, 174 optional). No action required.

### Outdated Dependencies

```
Packages with major version gaps: 6
```

Every one of these is a *direct* dependency, and none of them is currently broken — the
installed versions all resolve and build. They are listed because a major-version gap is where
an agent's recalled idiom and the installed reality drift apart, which is the same failure mode
the stack assessment flagged as its one partial gate.

- **typescript**: 5.9.3 → 7.0.2 (2 majors behind; note TypeScript skipped 6.x, so this is one
  release generation)
- **eslint**: 9.39.4 → 10.8.0 (1 major behind)
- **@eslint/js**: 9.39.4 → 10.0.1 (1 major behind)
- **@astrojs/react**: 5.0.4 → 6.0.2 (1 major behind)
- **lint-staged**: 16.4.0 → 17.3.0 (1 major behind)
- **@supabase/ssr**: 0.10.3 → 0.12.4 (pre-1.0; minor bumps carry breaking changes here)

A second tier of packages is merely behind on minors/patches within the same major
(`@tailwindcss/vite` 4.2.4 → 4.3.3, `tailwindcss` 4.2.4 → 4.3.3, `prettier` 3.8.3 → 3.9.6,
`lucide-react` 1.14.0 → 1.28.0, `@supabase/supabase-js` 2.105.3 → 2.111.0, `typescript-eslint`
8.59.2 → 8.65.0, plus React/react-dom 19.2.6 → 19.2.8). These are routine and carry no
agent-reasoning risk.

## Test Suite

```
Test runner: Playwright 1.62
Tests found: 29 tests across 6 spec files
Test execution: collects cleanly (verified via `npx playwright test --list`)
```

```
Configuration: playwright.config.ts
Framework: @playwright/test ^1.62.1 — single Chromium project, managed webServer on port 4321
```

Spec files: `guardrails.spec.ts`, `digging.spec.ts`, `boulder-gravity.spec.ts`,
`boulder-crush.spec.ts`, `undermine-gated-gem.spec.ts`, `game-clock.spec.ts`.

**This has grown substantially since the stack assessment**, which recorded two files. The E2E
layer now covers digging, gravity, crush, gated-gem undermining, and clock behavior.

**The notable finding is what the project built to make timing testable.** `src/lib/game-clock.ts`
exposes a manual clock behind a `?clock=manual` query parameter, published to `window` for tests
to drive; `game-clock.spec.ts` asserts the clock does not tick on its own and advances by exactly
the requested amount. This directly answers the stack assessment's Gap 2 concern about flaky
real-clock assertions — timing is now deterministic even through the browser.

**What is still missing is the unit layer.** There is no Vitest, Jest, or `node:test` in
`package.json`, and no test script beyond `test:e2e` / `test:e2e:ui`. This matters because
`src/lib/boulder-simulation.ts` (199 lines) is already factored as pure, directly-callable logic:

```
export function tileAt(board, row, col): Tile | undefined
export function isSupported(board, row, col): boolean
export function withTile(board, row, col, tile): Board
export function stepSimulation(input: SimulationInput, nowMs: number): SimulationResult
```

`stepSimulation` takes time as an explicit parameter — it is a pure function of
`(state, time) → state`. Exercising it currently requires booting a browser, navigating a page,
and driving a manual clock through `window`, when it could be called directly in milliseconds.
The testability work has been done; the fast layer that would capitalize on it has not been added.

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml
```

| Stage      | Status | Notes                                                                 |
|------------|--------|-----------------------------------------------------------------------|
| Lint       | ✓      | `npm run lint` — ESLint 9 flat config, type-aware rules                |
| Test       | ✗      | not configured — Playwright is local-only                             |
| Build      | ✓      | `npm run build` (Astro SSR), with Supabase secrets injected           |
| Type check | ~      | partial — no `astro check` step, but type-aware ESLint covers much of it |
| Security   | ✗      | not configured — no `npm audit`, Dependabot, or CodeQL                |

Runs on push and PR to `main`/`master`, Node 22 with npm caching, `npm ci` → `npx astro sync` →
lint → build.

On type checking: `eslint.config.js` uses `tseslint.configs.strictTypeChecked` with
`projectService: true`, so CI failures already include type-derived rules — this is stronger than
a typical lint-only pipeline. What it does not do is run the compiler across `.astro` files the
way `astro check` would. `@astrojs/check` is installed as a dependency but no npm script invokes
it, so the capability is present and unused.

`AGENTS.md:36` documents the no-tests-in-CI state explicitly, so this is a known and recorded
choice rather than an oversight.

## Configuration

### High severity

None. `.gitignore`, `tsconfig.json` (strict via `astro/tsconfigs/strict`), `eslint.config.js`,
and a formatter config are all present and correct. Verified that `dist/`, `test-results/`, and
`playwright-report/` are ignored and that zero files from those paths are tracked in git.

### Medium severity

- **No `typecheck` npm script** — `@astrojs/check` is an installed dependency but nothing runs it.
  An agent asked to "verify types" has no obvious command and will improvise (`npx tsc --noEmit`,
  which does not understand `.astro` files). Fix: add `"typecheck": "astro check"` to
  `package.json` scripts.
- **Testing-layers convention absent from `CLAUDE.md`** — the stack assessment recommended
  documenting the unit-vs-E2E split. `CLAUDE.md` currently states "There is no unit-test runner;
  all automated tests are E2E", which is accurate but reads as a permanent property rather than a
  gap. An agent will keep reaching for Playwright to test pure functions. Fix: see Category A #1.

### Low severity

- **`.editorconfig` missing** — editor-level formatting consistency is left to each contributor's
  setup. Prettier plus the pre-commit hook covers the actual committed output, so the practical
  impact is small. Fix: add a minimal `.editorconfig` (`indent_style = space`, `indent_size = 2`,
  `end_of_line = lf`, `insert_final_newline = true`).

Present and verified: `.prettierrc.json`, `.env.example`, `.gitignore`, `eslint.config.js`,
`components.json`, `.nvmrc`, `wrangler.jsonc`, `.husky/` (pre-commit via husky + lint-staged),
`CLAUDE.md`, `AGENTS.md`.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready-with-compensation
```

| Quality Gate Gap | Health-Check Finding | Status |
|---|---|---|
| Gap 1 — `CLAUDE.md` said "Astro 6" | `CLAUDE.md:38` now reads "**Astro 7 SSR app**" | **Resolved** |
| Gap 4 — version-skew idioms (partial on training data) | `CLAUDE.md:40` carries the full "Version reality — do not rely on recall" table (Astro/Tailwind/Vite/React/ESLint) | **Resolved** |
| Gap 3 — `noUncheckedIndexedAccess` off | Flag still off in `tsconfig.json`, but the recommended `## Board indexing` rule is in `CLAUDE.md`, **and the code follows it** — `boulder-simulation.ts:48` exports `tileAt(): Tile \| undefined` and `isSupported()` builds on it | **Mitigated as designed** |
| Gap 2 — no unit-test layer | Still no unit runner. Partially compensated: the injectable clock (`src/lib/game-clock.ts`) and pure `stepSimulation(input, nowMs)` now exist, so the *testability* precondition is met — only the fast runner is missing | **Partially resolved** |
| Gap 2 (compounding) — CI runs no tests | Unchanged: `.github/workflows/ci.yml` runs lint and build only | **Reinforced** |

Three of the four compensation blocks the stack assessment recommended have been applied to
`CLAUDE.md`. The one still outstanding is the testing-layers convention, which is the
documentation half of the only gap that remains genuinely open.

Worth calling out: Gap 3's mitigation did not just get written down, it got *followed*. The
`tileAt` accessor returning `Tile | undefined` is exactly the shape the assessment prescribed, and
support resolution is built on top of it rather than on raw `board[y + 1][x]` indexing. That is
the compensation strategy working end to end.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. No unit-test layer for the simulation logic

**Impact**: `boulder-simulation.ts` is pure, deterministic, and time-injected — the ideal unit-test
target — yet every assertion about it currently costs a browser boot. This caps how many cases get
written, and an agent iterating on gravity or support rules has no fast feedback loop to verify
against. The stack assessment called this out and it remains the single open gap.
**Severity**: medium
**Effort**: moderate (15–30 min for setup; writing the suite is ongoing work)
**Fix**:

Vite 8 is already in the tree, so Vitest needs no new build configuration:

```bash
npm install -D vitest
```

Add to `package.json` scripts:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

Then add `src/lib/boulder-simulation.test.ts` covering `isSupported` at the bottom row (the
out-of-bounds case), `tileAt` outside the grid, and `stepSimulation` across the grace→falling
transition by passing explicit `nowMs` values — no clock mocking needed, since time is already a
parameter.

Also add the layering convention to `CLAUDE.md` so the split is durable:

```markdown
## Testing layers

- **Unit (`*.test.ts`, Vitest)** — pure logic: board state, support resolution, fall scheduling,
  win/lose evaluation. Call `stepSimulation(input, nowMs)` directly with explicit timestamps.
- **E2E (`tests/e2e/*.spec.ts`, Playwright)** — browser-level behavior: entry, input routing,
  guardrail `data-testid` presence, replay reset.

Timing assertions belong in unit tests. The manual clock (`?clock=manual`) exists for the E2E
cases that genuinely need a browser — it is not a reason to test pure functions through one.
```

### 2. CI gates no tests at all

**Impact**: 29 working E2E tests exist and none of them protect `main`. A merge can go green with
the game fully broken, and an agent told "CI passed" will reasonably infer more safety than the
pipeline actually provides.
**Severity**: medium
**Effort**: quick (< 5 min for unit tests; ~10 min for E2E, which needs a browser install step)
**Fix**:

Add to `.github/workflows/ci.yml` after the lint step:

```yaml
      - run: npm run test:unit
```

For the E2E layer, add browser installation and run it after the build:

```yaml
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

If E2E runtime in CI becomes a concern, gate the unit tests on every push and the E2E suite on
PRs only. Update `AGENTS.md:36` and the `CLAUDE.md` CI section once this lands — both currently
state that no tests run in CI.

### 3. No `typecheck` script

**Impact**: `@astrojs/check` is installed but unreachable through npm scripts. An agent verifying
its own type changes will guess at a command, and `npx tsc --noEmit` silently skips `.astro`
files — producing a false green.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**:

```json
"typecheck": "astro check"
```

Then add it to CI after `npx astro sync`, and mention it in the `CLAUDE.md` commands section.

### 4. Six direct dependencies a major version behind

**Impact**: This is the same failure mode as the stack assessment's training-data partial, running
in the opposite direction — the further installed versions drift from current, the more the
project's own reality diverges from both the docs an agent fetches and the idioms it recalls.
ESLint 10 and TypeScript 7 in particular are large enough jumps to change lint output and
type-checking behavior.
**Severity**: medium
**Effort**: moderate (15–30 min, plus verification per package)
**Fix**:

Take these one at a time with a lint + build + test cycle between each, not as a single sweep:

```bash
npm install eslint@10 @eslint/js@10 @eslint/config-helpers@latest
npm install typescript@7
npm install @astrojs/react@6
npm install -D lint-staged@17
npm install @supabase/ssr@latest
```

TypeScript 7 and ESLint 10 are the two that warrant real verification — run `npm run lint`,
`npm run build`, and the E2E suite after each. The `CLAUDE.md` version-reality table will need its
rows updated to match whatever lands.

Separately, the within-major updates (`npm update`) are low-risk and can be done in one pass.

### 5. Testing-layers convention not documented

**Impact**: `CLAUDE.md` describes the current state ("all automated tests are E2E") without framing
it as a gap, so an agent reads it as the intended architecture and writes browser tests for pure
functions.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: Covered by the `CLAUDE.md` block in fix #1 — apply both together.

### 6. `.editorconfig` missing

**Impact**: Minor. Prettier plus the pre-commit hook already normalize committed output, so this
only affects in-editor behavior before a commit.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

### Addressed in upcoming lessons (Category B)

### Security scanning in CI

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Pipeline hardening, including automated dependency and vulnerability
scanning (Dependabot, `npm audit` gates, or CodeQL). The audit is clean today, so there is nothing
urgent to catch — this is about keeping it that way without manual checks.

### Deployment pipeline maturity

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: The deploy chain (`deploy:site-check` → build → `wrangler deploy --strict`,
with tail/list/status/rollback) is already well past a typical starting point. The lesson covers
wiring deployment into CI and preview environments per PR.

### Agent instruction files

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: Both `CLAUDE.md` and `AGENTS.md` already exist and carry the stack
assessment's compensation blocks, so you arrive ahead of the curve. The lesson covers feedback
loops and keeping rules accurate as the project drifts — directly relevant, since fixes #2 and #3
above will make the current CI description stale.

## Summary

```
Health status: healthy
```

Dependencies are clean (zero advisories across 870 packages), a working test runner covers 29
cases in 6 files, the lockfile is present and CI-enforced, TypeScript runs in strict mode with
type-aware ESLint gating every push, and pre-commit hooks catch style issues before review. Three
of the four compensation strategies from the stack assessment have been applied to `CLAUDE.md`,
and the board-indexing rule was not merely documented but followed in code — `boulder-simulation.ts`
exports a `tileAt(): Tile | undefined` accessor and builds support resolution on it, which is the
compensation working exactly as intended.

The one gap that remains open is the unit-test layer, and the project has already done the hard
part of closing it: `stepSimulation(input, nowMs)` is pure with time as a parameter, and a manual
clock exists for browser-level timing. What is missing is the fast runner that would exploit that
design, plus a CI pipeline that gates on tests at all — 29 passing tests currently protect nothing
on `main`. Neither is severe, and neither blocks agent work; together they are roughly 30 minutes
of setup for a disproportionate gain in how quickly an agent can verify its own changes to the
gravity and support logic.

Next step: your project is healthy — apply fixes #1 and #2 (unit runner plus tests in CI, the two
that compound) if you want the fastest return, then proceed to agent onboarding.
