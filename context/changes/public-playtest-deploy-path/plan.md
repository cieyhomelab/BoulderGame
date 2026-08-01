# Public Playtest Deploy Path Implementation Plan

## Overview

This plan prepares the smallest useful public playtest path for BoulderGame on Cloudflare Workers. It fixes starter deployment identity, removes the sitemap warning with a documented public URL, and makes build, deploy, log tailing, and rollback commands discoverable without performing the first production deployment automatically.

## Current State Analysis

The app is already configured for Cloudflare Workers SSR through `@astrojs/cloudflare` and `wrangler.jsonc`, and local build/lint/E2E checks pass after F-01. The remaining deployment foundation gaps are operational rather than gameplay-related: the Worker still uses the starter name, the README still speaks as the starter, sitemap generation has no `site` URL, package scripts do not expose Wrangler deploy/log commands, and docs still imply Supabase secrets are required even though the MVP is no-auth and Astro marks them optional.

## Desired End State

After this change, a developer can identify the Cloudflare Worker as BoulderGame, build the project without a sitemap warning, inspect a dry-run deploy bundle, and know the exact manual commands for first public deploy, live logs, deployment listing, and rollback. The first production deployment remains a manual approval step because infrastructure guidance requires human approval for first production deployment and domain changes.

### Key Discoveries:

- `wrangler.jsonc` still names the Worker `10x-astro-starter`: `wrangler.jsonc:3`.
- `package.json` still names the package `10x-astro-starter`: `package.json:2`.
- Cloudflare is the selected MVP platform and the current stack already has the Cloudflare adapter and Wrangler config: `context/foundation/infrastructure.md:15`.
- Infrastructure research explicitly says to rename the Worker before first deploy and verify logs with Wrangler tail: `context/foundation/infrastructure.md:96`.
- Astro sitemap needs a top-level `site` URL starting with `http://` or `https://` to generate sitemap files.
- Wrangler docs confirm `wrangler deploy`, `wrangler tail`, and `wrangler rollback` as current Worker commands.
- F-01 intentionally left Cloudflare deployment naming, sitemap `site`, and production deployment setup to this change: `context/changes/performance-play-signal-guardrails/plan.md:32`.

## What We're NOT Doing

- Performing the first production deployment automatically.
- Adding Cloudflare deploy automation to GitHub Actions.
- Changing domains, paid plans, Cloudflare account bindings, or secrets.
- Removing the starter auth/Supabase scaffold from the app path; S-01 owns game entry.
- Adding gameplay logic, public analytics, Durable Objects, database state, or multiplayer infrastructure.

## Implementation Approach

Make the local repo ready for a manual Cloudflare playtest deployment: rename project/deploy identity to `boulder-game`, set a conservative Workers URL as the current public `site`, add Wrangler scripts for deploy dry run, deploy, log tail, deployment status/listing, and rollback, then document the manual operating path in README and AGENTS. Verification stops at local build, lint, E2E, and Wrangler dry-run because production deployment requires approval.

## Critical Implementation Details

### Approval Boundary

Agents may build, lint, run deploy dry-runs, inspect logs, and propose deployment. The first production deploy, domain changes, paid plan changes, destructive data operations, and primary secret rotation require human approval.

## Phase 1: Deployment Identity and Build Metadata

### Overview

Rename starter deployment identity to BoulderGame and make production metadata deterministic enough for public playtest builds.

### Changes Required:

#### 1. Cloudflare Worker identity

**File**: `wrangler.jsonc`

**Intent**: Ensure any manual Cloudflare deployment uses the BoulderGame identity instead of the starter template name.

**Contract**: Set `name` to `boulder-game`; keep the existing Astro Cloudflare entrypoint, assets binding, compatibility settings, and observability enabled.

#### 2. Package identity

**File**: `package.json`

**Intent**: Align npm/package metadata with the actual project name so CLI output and agent context do not keep referring to the starter.

**Contract**: Set `name` to `boulder-game`; preserve existing scripts and dependency versions except where Phase 2 adds scripts.

#### 3. Public site metadata

**File**: `astro.config.mjs`

**Intent**: Remove the sitemap warning and give public playtest builds stable absolute URLs until a custom domain is chosen.

**Contract**: Add a top-level `site` value for the current Workers playtest identity. Do not add route/domain configuration or Cloudflare account-specific bindings.

### Success Criteria:

#### Automated Verification:

- Type-aware lint passes after identity changes: `npm run lint`.
- Production build passes without the prior sitemap missing-site warning: `npm run build`.
- Local Playwright smoke still passes against the app shell: `npm run test:e2e`.

#### Manual Verification:

- `wrangler.jsonc` and `package.json` no longer expose `10x-astro-starter` as the project/deploy identity.
- The configured public `site` value is clearly documented as the current playtest URL placeholder until a custom domain is approved.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Deploy Commands and Operator Documentation

### Overview

Expose the manual Cloudflare playtest workflow through package scripts and docs so agents and humans can build, dry-run, deploy, inspect logs, and reason about rollback consistently.

### Changes Required:

#### 1. Wrangler scripts

**File**: `package.json`

**Intent**: Make deployment and log access discoverable through npm scripts instead of relying on remembered Wrangler commands.

**Contract**: Add scripts for deploy dry-run, deploy, live log tail, deployment listing/status, and rollback. Production `deploy` may exist as a command, but docs must say first production deploy requires human approval.

#### 2. Public playtest documentation

**File**: `README.md`

**Intent**: Give a concise deployment runbook that starts with local verification, then Cloudflare auth, dry-run, deploy, URL recording, log tailing, and rollback.

**Contract**: Update the project title/starter references where they confuse identity. Add a Public Playtest Deployment section with commands and approval boundaries. Clarify Supabase variables are optional scaffold variables for now, not required for the no-auth MVP playtest.

#### 3. Agent-facing deploy rules

**File**: `AGENTS.md`

**Intent**: Tell future agents when they may run deploy-adjacent commands and when they must not deploy without approval.

**Contract**: Add deploy dry-run/log commands to Build/Test commands and state the first production deploy/domain/paid-plan/secrets boundary.

#### 4. Plan and brief handoff

**File**: `context/changes/public-playtest-deploy-path/plan.md`, `context/changes/public-playtest-deploy-path/plan-brief.md`

**Intent**: Keep the final handoff explicit that CI deployment is out of scope and F-02 provides a manual public playtest path for S-04.

**Contract**: Plan and brief must name the manual-first Cloudflare path and say production deployment was not performed by this implementation.

### Success Criteria:

#### Automated Verification:

- Formatting check passes for changed docs/config files: `npx prettier --check README.md AGENTS.md package.json astro.config.mjs wrangler.jsonc context/changes/public-playtest-deploy-path/plan.md context/changes/public-playtest-deploy-path/plan-brief.md`.
- Type-aware lint still passes: `npm run lint`.
- Production build still passes: `npm run build`.
- Local Playwright smoke still passes: `npm run test:e2e`.
- Wrangler deploy dry-run completes without publishing: `npm run deploy:dry-run`.

#### Manual Verification:

- README clearly shows the manual first-deploy, log tail, deployment listing/status, and rollback path.
- AGENTS.md clearly forbids first production deploy, domain changes, paid plan changes, destructive data operations, and primary secret rotation without human approval.
- No GitHub Actions production deploy workflow is introduced in this change.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change implemented.

---

## Testing Strategy

### Unit Tests:

- No unit tests are needed; this change is deploy configuration and documentation.

### Integration Tests:

- `npm run build` verifies Astro/Cloudflare output.
- `npm run test:e2e` verifies the local app shell still launches after deployment metadata changes.
- `npm run deploy:dry-run` verifies Wrangler can compile the Worker upload without publishing.

### Manual Testing Steps:

1. Review `wrangler.jsonc`, `package.json`, and README for BoulderGame identity.
2. Review README deploy steps and confirm they do not claim that production deployment already happened.
3. Review AGENTS.md approval boundaries.
4. If Cloudflare credentials are available and human approval is explicit, run the documented `npm run deploy` and record the resulting public URL.
5. If a deployment exists, run the documented log/status commands and confirm they target `boulder-game`.

## Performance Considerations

This change keeps runtime behavior unchanged. The main performance constraint remains that gameplay logic should stay client-side for MVP and Cloudflare Workers should not become a server-authoritative game loop.

## Migration Notes

No data migration is required. Renaming the Worker before first deploy is safe; if a Cloudflare Worker named `10x-astro-starter` has already been created manually, do not delete it automatically.

## References

- Roadmap item: `context/foundation/roadmap.md` (`F-02`, `public-playtest-deploy-path`)
- Infrastructure recommendation: `context/foundation/infrastructure.md`
- Tech stack handoff: `context/foundation/tech-stack.md`
- Product requirements: `context/foundation/prd.md`
- Prior foundation: `context/changes/performance-play-signal-guardrails/plan.md`
- Cloudflare Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Cloudflare rollback docs: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Astro sitemap docs: https://v4.docs.astro.build/en/guides/integrations-guide/sitemap/

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Deployment Identity and Build Metadata

#### Automated

- [x] 1.1 Type-aware lint passes after identity changes
- [x] 1.2 Production build passes without the prior sitemap missing-site warning
- [x] 1.3 Local Playwright smoke still passes against the app shell

#### Manual

- [x] 1.4 `wrangler.jsonc` and `package.json` no longer expose `10x-astro-starter` as the project/deploy identity
- [x] 1.5 Configured public `site` value is clearly documented as the current playtest URL placeholder until a custom domain is approved

### Phase 2: Deploy Commands and Operator Documentation

#### Automated

- [ ] 2.1 Formatting check passes for changed docs/config files
- [ ] 2.2 Type-aware lint still passes
- [ ] 2.3 Production build still passes
- [ ] 2.4 Local Playwright smoke still passes
- [ ] 2.5 Wrangler deploy dry-run completes without publishing

#### Manual

- [ ] 2.6 README clearly shows the manual first-deploy, log tail, deployment listing/status, and rollback path
- [ ] 2.7 AGENTS.md clearly states production deployment approval boundaries
- [ ] 2.8 No GitHub Actions production deploy workflow is introduced in this change
