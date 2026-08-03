/**
 * Teaches Node's resolver the `@/*` -> `./src/*` alias from tsconfig.json, so plain
 * `node --experimental-strip-types` can run the game's TypeScript modules directly. Node strips
 * types but knows nothing about tsconfig path mapping; this is the missing half.
 *
 * Written as a `module.register()` loader rather than the newer `registerHooks()`: this API is
 * available from Node 20.6, while `registerHooks` needs 22.15 — and .nvmrc pins 22.14.0.
 *
 * Deliberately no bundler. esbuild is only a transitive dependency here, and building a CLI on a
 * binary nobody declared is a dependency waiting to vanish.
 */
const sourceRoot = new URL("../src/", import.meta.url);

/**
 * @param {string} specifier
 * @param {unknown} context
 * @param {(specifier: string, context: unknown) => unknown} nextResolve
 */
export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const withoutAlias = specifier.slice(2);
  // Source files write `@/lib/levels`; callers may write `@/lib/levels.ts` — accept both. Type-only
  // imports are erased before resolution, so every specifier reaching here is real code.
  const target = new URL(withoutAlias.endsWith(".ts") ? withoutAlias : `${withoutAlias}.ts`, sourceRoot);

  // Hand the resolved URL back through the chain so Node still decides the module format.
  return nextResolve(target.href, context);
}
