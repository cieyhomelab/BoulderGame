# Public Playtest Deploy Path Verification

Date: 2026-08-01

## Commands

- `npx prettier --check README.md AGENTS.md package.json astro.config.mjs eslint.config.js wrangler.jsonc scripts/require-public-site-url.mjs context/changes/public-playtest-deploy-path/plan.md context/changes/public-playtest-deploy-path/plan-brief.md` - passed.
- `npm run lint` - passed with existing `astro-eslint-parser` projectService warnings.
- `npm audit --audit-level=moderate` - passed, 0 vulnerabilities.
- `npm run build` - passed without sitemap missing-site warning when `PUBLIC_SITE_URL` is unset.
- `PUBLIC_SITE_URL=https://boulder-game.real-account.workers.dev npm run build` - passed and generated `sitemap-index.xml`.
- `npm run deploy:site-check` - failed as expected when `PUBLIC_SITE_URL` is unset.
- `PUBLIC_SITE_URL=https://boulder-game.real-account.workers.dev npm run deploy:site-check` - passed.
- `PUBLIC_SITE_URL=https://boulder-game.your-account.workers.dev npm run deploy:site-check` - failed as expected for the documentation placeholder.
- `npm run deploy:dry-run` - passed, built first, and exited with `--dry-run: exiting now`; sandbox logged Wrangler `EPERM` warnings for `~/Library/Preferences/.wrangler/logs` but returned exit code 0.
- `npm run test:e2e` - passed, 1 skipped and 1 passed.
- `npx astro dev status` - passed, no dev server running.
