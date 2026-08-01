---
project: boulder-game
researched_at: 2026-08-01
recommended_platform: Cloudflare Workers + Pages
runner_up: Vercel
context_type: mvp
tech_stack:
  language: JavaScript/TypeScript
  framework: Astro 6 + React islands
  runtime: Cloudflare Workers via @astrojs/cloudflare
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

Cloudflare is the best MVP target because the selected starter already uses `@astrojs/cloudflare`, `wrangler.jsonc`, and a Cloudflare deployment target. The developer interview also weighted speed of iteration, existing Cloudflare familiarity, single-region tolerance, and external service usage over lowest possible cost or co-located platform services. The main caveat is that Cloudflare Workers is not a traditional always-on Node server; if future gameplay needs persistent multiplayer state, Durable Objects or a separate backend should be planned deliberately.

## Platform Comparison

| Platform | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP / integration | Stack fit | Result |
|---|---|---|---|---|---|---|---|
| Cloudflare Workers + Pages | Pass | Pass | Pass | Pass | Pass | Pass | Recommended |
| Vercel | Pass | Pass | Pass | Pass | Pass, beta MCP | Partial | Runner-up |
| Netlify | Pass | Pass | Pass | Pass | Pass | Partial | Third |
| Fly.io | Pass | Partial | Pass | Pass | Partial | Partial | Not shortlisted |
| Railway | Pass | Partial | Partial | Pass | Partial | Partial | Not shortlisted |
| Render | Pass | Partial | Partial | Pass | Pass | Partial | Not shortlisted |

Cloudflare scores highest because it is the only candidate that matches the current runtime without changing the Astro adapter. Its official docs cover Astro deployment, Wrangler deployment, rollbacks, limits, pricing, and agent resources including `llms.txt` and MCP endpoints.

Vercel has excellent CLI and managed frontend workflow, with `vercel` deploy, logs, rollback, and MCP support. It ranks second because moving this repo to Vercel would require an adapter/runtime decision instead of using the Cloudflare configuration already produced by the stack selector.

Netlify is similarly strong for previews, rollbacks, CLI operation, and agent setup, but it also requires changing the deployment adapter and accepting different edge/function limits. It remains a credible fallback if Cloudflare account or organization constraints block the first choice.

Fly.io, Railway, and Render are more attractive if the game becomes server-heavy, needs an always-on process, or needs containerized services. For this MVP, they add operational surface area without solving a current PRD requirement.

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

Cloudflare wins on stack fit, CLI-first operation, low MVP cost, and agent-readability. The current repository already has `wrangler.jsonc`, Cloudflare assets binding configuration, `@astrojs/cloudflare`, and `npm run build` producing the deployable artifact.

#### 2. Vercel

Vercel is the best fallback for developer experience. It provides a mature CLI, previews, logs, production rollback, and MCP support, but it is not the runtime this repository is currently configured for.

#### 3. Netlify

Netlify is the best fallback for JAMstack-style deployments with good preview and rollback workflows. The gap is the same: using it well means changing the Astro adapter and validating runtime behavior again.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate - Weaknesses

1. The starter still contains Supabase-oriented scaffolding even though the game MVP does not require auth or database work; unused deployment secrets can become a source of confusion.
2. `wrangler.jsonc` still names the Worker `10x-astro-starter`, so the first deploy would publish under the wrong project identity unless renamed.
3. Astro sitemap is enabled, but `astro.config.mjs` has no `site` value, so builds currently produce a sitemap warning that should be fixed before public deployment.
4. Workers has runtime limits that are easy to ignore when developing locally; heavy server-side rendering or gameplay computation should stay out of the Worker request path.
5. Rollbacks do not magically roll back external resources, bindings, secrets, or database migrations; any later data layer needs its own rollback story.

### Pre-Mortem - How This Could Fail

Six months later, the Cloudflare choice has failed because the team treated it like a generic Node host. The game started as client-side arcade gameplay, but then added multiplayer rooms, server-authoritative collision checks, and a shared world state without pausing to choose a state model. Instead of introducing Durable Objects intentionally, ad hoc state was spread across request handlers and external services. At the same time, the original starter's Supabase remnants stayed in the repo, so secrets and CI variables were configured without a clear reason. The Worker was deployed with the starter name, making account resources hard to identify. Build warnings were ignored until sitemap and canonical URL issues appeared in production. When a bad deploy shipped, `wrangler rollback` reverted code quickly, but not the changed bindings and data assumptions. The platform was still capable, but the team failed by letting MVP hosting silently become production architecture.

### Unknown Unknowns

- The deployed runtime is Cloudflare Workers, not full Node.js. `nodejs_compat` helps, but it does not turn Workers into a normal long-running server.
- Free-tier CPU limits are tighter than paid-tier limits; keep game logic client-side and avoid expensive server work on each request.
- Cloudflare Pages, Workers, and Workers Assets overlap in terminology. This repo's `wrangler.jsonc` points at the Cloudflare Worker entrypoint and `./dist` assets.
- Rollback commands are available through Wrangler, but binding changes, secrets, and external data changes need separate rollback procedures.
- Git preview deployment should be validated after the first Cloudflare project connection; local `wrangler deploy` and Git integration are related but not identical workflows.

## Operational Story

- **Preview deploys**: Use Cloudflare Git integration for branch/PR previews after the project is connected. Until then, use local `npm run build` plus `npx wrangler deploy` for manual verification.
- **Secrets**: Keep production tokens in Cloudflare Workers secrets or GitHub Actions secrets. Agents may read secret names and validation errors, but must not print secret values.
- **Rollback**: Use `npx wrangler rollback` for Worker code rollback. Treat bindings, environment variables, Supabase data, and other external resources as separate rollback items.
- **Approval**: An agent may run build, lint, deploy preview, inspect logs, and propose production deployment. First production deployment, domain changes, paid plan changes, destructive data operations, and primary secret rotation require human approval.
- **Logs**: Use `npx wrangler tail` for live runtime logs and Cloudflare Workers Logs for dashboard queries. CI build failures remain visible in GitHub Actions logs.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Worker deployed with starter name | Research finding | High | Medium | Rename `wrangler.jsonc` `name` from `10x-astro-starter` to `boulder-game` before first deploy. |
| Sitemap warning becomes public metadata issue | Research finding | Medium | Low | Add a production `site` value to `astro.config.mjs` before public launch. |
| Serverless runtime assumed to be full Node | Unknown unknowns | Medium | High | Keep gameplay logic client-side for MVP; document any server feature that needs Worker-specific APIs. |
| Persistent multiplayer added without architecture change | Devil's advocate | Medium | High | If realtime becomes required, evaluate Durable Objects or a separate backend before implementation. |
| Rollback misses bindings or external data | Devil's advocate | Medium | High | Pair every new binding, secret, migration, or external service with an explicit rollback note. |
| Unused Supabase scaffolding creates config drift | Pre-mortem | Medium | Medium | Remove or quarantine auth/Supabase code when the game shell is implemented if it remains out of scope. |
| Free-tier runtime/log limits hide production behavior | Unknown unknowns | Medium | Medium | Re-check Cloudflare usage after the first public playtest and budget for Workers Paid if runtime or observability limits become painful. |

## Getting Started

1. Rename the Worker in `wrangler.jsonc` to `boulder-game`.
2. Add a real production `site` URL to `astro.config.mjs` before publishing the sitemap.
3. Run `npm run lint` and `npm run build` locally before every deployment candidate.
4. Authenticate Cloudflare locally with Wrangler, then deploy with `npx wrangler deploy`.
5. After the first deploy, verify runtime logs with `npx wrangler tail` and record the production URL in project docs.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture such as multi-region failover, HA, or disaster recovery

## Sources Checked

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Astro deployment guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/
- Cloudflare Wrangler Workers commands: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Cloudflare Workers rollback docs: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Cloudflare agent resources and MCP docs: https://developers.cloudflare.com/workers/get-started/prompting/
- Vercel CLI docs: https://vercel.com/docs/cli
- Vercel rollback docs: https://vercel.com/docs/cli/rollback
- Vercel MCP docs: https://vercel.com/docs/ai-tooling/vercel-mcp
- Netlify deploy overview: https://docs.netlify.com/deploy/deploy-overview/
- Netlify rollback docs: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/
- Netlify agent setup docs: https://docs.netlify.com/build/build-with-ai/agent-setup-guides/agent-setup-overview/
- Fly.io deploy docs: https://www.fly.io/docs/launch/deploy/
- Railway CLI deploy docs: https://docs.railway.com/cli/deploying
- Render CLI docs: https://render.com/docs/cli-reference
