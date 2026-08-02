// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

const publicSiteUrl = process.env.PUBLIC_SITE_URL;

// GitHub Pages hosts static files only, so that build drops the Cloudflare adapter
// and serves from the repository subpath. Without the flag the config stays SSR.
const isGitHubPages = process.env.DEPLOY_TARGET === "github-pages";

// https://astro.build/config
export default defineConfig({
  ...(isGitHubPages
    ? { output: "static", site: "https://cieyhomelab.github.io", base: "/BoulderGame" }
    : { output: "server", adapter: cloudflare(), ...(publicSiteUrl ? { site: publicSiteUrl } : {}) }),
  integrations: [react(), ...(publicSiteUrl && !isGitHubPages ? [sitemap()] : [])],
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
