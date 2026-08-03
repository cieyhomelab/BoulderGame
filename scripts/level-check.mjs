import { register } from "node:module";

register("./ts-path-alias-loader.mjs", import.meta.url);

/**
 * Audits every cave in the registry and prints a report. Exits non-zero when any check fails, so
 * CI refuses a level that seals its own exit, drops a boulder before the player moves, or cannot
 * be won at all.
 *
 * The rules come from src/lib/level-audit.ts — the same module the e2e suite asserts.
 *
 * Usage:
 *   npm run level:check              audit every level
 *   npm run level:check -- --routes  also print each level's winning key sequence
 */
const { LEVELS } = await import("@/lib/levels.ts");
const { auditLevel } = await import("@/lib/level-audit.ts");
const { parseLevel } = await import("@/lib/levels.ts");
const { solveLevel } = await import("@/lib/level-solver.ts");

const showRoutes = process.argv.includes("--routes");

const KEY_BY_DIRECTION = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

let failed = 0;

for (const definition of LEVELS) {
  const audit = auditLevel(definition);
  if (!audit.ok) {
    failed += 1;
  }

  console.log(`\n${audit.ok ? "PASS" : "FAIL"}  ${audit.id}  (${audit.name})`);
  for (const check of audit.checks) {
    console.log(`  ${check.ok ? "ok  " : "FAIL"}  ${check.name} — ${check.detail}`);
  }

  if (showRoutes) {
    const solution = solveLevel(parseLevel(definition));
    if (solution.solved) {
      console.log(`  route (${solution.route.length} moves):`);
      console.log(`    ${solution.route.map((direction) => KEY_BY_DIRECTION[direction]).join(", ")}`);
    }
  }
}

console.log(
  failed === 0 ? `\nAll ${LEVELS.length} levels pass every check.` : `\n${failed} of ${LEVELS.length} levels failed.`,
);

process.exit(failed === 0 ? 0 : 1);
