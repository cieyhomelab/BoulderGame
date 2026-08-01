---
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
---

## Why this stack

BoulderGame is a small JavaScript/TypeScript web-app MVP with a 3-week after-hours timeline and no auth, payments, realtime, AI, or background-job requirements. The recommended starter for this product shape is 10x Astro Starter: it gives a TypeScript-first, convention-based web foundation with Cloudflare Pages as the default deployment target and GitHub Actions for automatic deployment after merge. The starter includes more full-stack capability than this PRD needs for the first game loop, but the standard path keeps scaffolding predictable and leaves unused capabilities out of the MVP scope.
