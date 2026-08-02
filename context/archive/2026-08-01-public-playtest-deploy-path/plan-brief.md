# Public Playtest Deploy Path - Plan Brief

> Full plan: `context/changes/public-playtest-deploy-path/plan.md`

## What & Why

This change prepares BoulderGame for a first public Cloudflare playtest without silently performing that production deploy. It fixes starter deployment identity, adds discoverable Wrangler commands, and documents how to deploy, inspect logs, and roll back once a human approves the first production release.

## Starting Point

The repo already builds for Cloudflare Workers SSR, but the Worker and package still use `10x-astro-starter`, sitemap generation has no confirmed public `site` URL, and deploy/log commands are not exposed through npm scripts. Infrastructure research chose Cloudflare Workers + Pages and called out the starter name and sitemap warning as pre-public-deploy risks.

## Desired End State

The project identifies as `boulder-game`, builds without the missing-site sitemap warning, and has an obvious manual playtest runbook. Developers can run local verification, Wrangler dry-run, production deploy with approval and a confirmed `PUBLIC_SITE_URL`, live log tailing, deployment inspection, and rollback commands.

## Key Decisions Made

| Decision     | Choice                            | Why (1 sentence)                                                                          |
| ------------ | --------------------------------- | ----------------------------------------------------------------------------------------- |
| Platform     | Cloudflare Workers                | Matches the selected stack and existing adapter/config without a runtime migration.       |
| First deploy | Manual with human approval        | Infrastructure guidance requires approval for first production deploy and domain changes. |
| CI deploy    | Out of scope                      | F-02 needs a safe playtest path, not an automated production release pipeline.            |
| Public URL   | `PUBLIC_SITE_URL` release input   | Avoids hardcoding an invalid Workers URL while keeping custom-domain work separate.       |
| Logs         | Wrangler tail plus dashboard logs | Matches the existing infrastructure operating story.                                      |

## Scope

**In scope:**

- Rename package and Worker identity to `boulder-game`.
- Add environment-driven public `site` metadata for playtest builds.
- Add npm scripts for deploy dry-run, deploy, log tail, deployment list/status, and rollback.
- Document manual first deploy, log inspection, rollback, and approval boundaries.

**Out of scope:**

- Performing the first production deploy automatically.
- Adding GitHub Actions production deployment.
- Changing Cloudflare domains, paid plan, account resources, or primary secrets.
- Removing auth/Supabase scaffold or building gameplay.

## Architecture / Approach

Keep the current Astro SSR + Cloudflare Workers architecture. F-02 only makes the existing deployment target correctly named, locally verifiable, and operationally documented.

## Phases at a Glance

| Phase                                         | What it delivers                                                    | Key risk                                                     |
| --------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1. Deployment Identity and Build Metadata     | BoulderGame Worker/package identity and sitemap-ready site metadata | Deploying before the real Workers URL is confirmed           |
| 2. Deploy Commands and Operator Documentation | npm Wrangler commands plus README/AGENTS runbook                    | Accidentally implying production deployment already happened |

**Prerequisites:** F-01 guardrail foundation complete; Cloudflare account access only needed for actual production deploy.  
**Estimated effort:** Small foundation change across 2 phases.

## Open Risks & Assumptions

- The current playtest URL must be confirmed from Cloudflare before production deploy.
- `npm run deploy:dry-run` may need Cloudflare/Wrangler network behavior even though it must not publish.
- Existing Supabase/auth scaffold remains in the repo until S-01 removes or bypasses it from the game path.

## Success Criteria (Summary)

- Build/lint/E2E stay green after deployment metadata changes.
- Wrangler dry-run can compile the deploy bundle without publishing.
- README and AGENTS clearly explain deploy/log/rollback commands and approval boundaries.
