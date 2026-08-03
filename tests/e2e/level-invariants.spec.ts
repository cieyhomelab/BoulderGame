import { expect, test } from "@playwright/test";

import { auditLevel } from "../../src/lib/level-audit";
import { LEVELS } from "../../src/lib/levels";

/**
 * Asserts the shared level audit over the registry. The rules themselves live in
 * `src/lib/level-audit.ts` so that `npm run level:check` and this suite can never disagree about
 * what makes a cave valid — a second copy of the design rules is exactly the drift this layer
 * exists to prevent.
 *
 * Opens no page. Adding a cave to `LEVELS` adds its coverage automatically.
 */
for (const definition of LEVELS) {
  test.describe(`${definition.id} level design`, () => {
    const audit = auditLevel(definition);

    for (const check of audit.checks) {
      test(check.name, () => {
        expect(check.ok, `${definition.id} — ${check.name}: ${check.detail}`).toBe(true);
      });
    }
  });
}
