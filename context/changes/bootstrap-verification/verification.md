---
bootstrapped_at: 2026-08-01T16:23:47Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: boulder-game
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: boulder-game
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

BoulderGame is a small JavaScript/TypeScript web-app MVP with a 3-week after-hours timeline and no auth, payments, realtime, AI, or background-job requirements. The recommended starter for this product shape is 10x Astro Starter: it gives a TypeScript-first, convention-based web foundation with Cloudflare Pages as the default deployment target and GitHub Actions for automatic deployment after merge. The starter includes more full-stack capability than this PRD needs for the first game loop, but the standard path keeps scaffolding predictable and leaves unused capabilities out of the MVP scope.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | cmd_template starts with `git clone`; no create-* package to check |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed `2026-05-17T10:33:39Z` | fresh | from card.docs_url |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 31375
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 1 CRITICAL, 12 HIGH, 7 MODERATE, 2 LOW
**Direct vs transitive**: direct findings were 0 CRITICAL, 1 HIGH, 2 MODERATE, 0 LOW; remaining findings were transitive.

#### CRITICAL findings

- `tar` — transitive via `supabase`; advisories include `GHSA-23hp-3jrh-7fpw` and related tar parser/DoS issues. Fix available.

#### HIGH findings

- `astro` — direct dependency; advisories include XSS and host-header SSRF issues. Fix available.
- `brace-expansion` — transitive dependency; DoS advisories. Fix available.
- `devalue` — transitive dependency; sparse-array deserialization DoS advisory. Fix available.
- `fast-uri` — transitive dependency; host confusion advisories. Fix available.
- `js-yaml` — transitive dependency; YAML CPU-consumption advisories. Fix available.
- `miniflare` — transitive dependency; affected through `sharp`, `undici`, and `ws`. Fix available.
- `postcss` — transitive dependency; source map path traversal advisory. Fix available.
- `sharp` — transitive dependency; inherited libvips vulnerabilities. Fix available.
- `svgo` — transitive dependency; executable-script removal advisory. Fix available.
- `undici` — transitive dependency; TLS/proxy, routing, and DoS advisories. Fix available.
- `vite` — transitive dependency; Windows path/disclosure advisories. Fix available.
- `ws` — transitive dependency; memory disclosure / DoS advisories. Fix available.

#### MODERATE findings

- `@astrojs/language-server` — transitive dependency via `volar-service-yaml`. Fix available.
- `@cloudflare/vite-plugin` — transitive dependency affected through `miniflare`, `wrangler`, and `ws`. Fix available.
- `supabase` — direct dependency affected through `tar`. Fix available.
- `volar-service-yaml` — transitive dependency through `yaml-language-server`. Fix available.
- `wrangler` — direct dependency affected through `esbuild` and `miniflare`. Fix available.
- `yaml` — transitive dependency; stack overflow advisory. Fix available.
- `yaml-language-server` — transitive dependency through `yaml`. Fix available.

#### LOW / INFO findings

- `@babel/core` — transitive dependency; arbitrary file read advisory. Fix available.
- `esbuild` — transitive dependency; development-server file read advisory on Windows. Fix available.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | false |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
