// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

const publicSiteUrl = process.env.PUBLIC_SITE_URL;

// https://astro.build/config
export default defineConfig({
  ...(publicSiteUrl ? { site: publicSiteUrl } : {}),
  output: "server",
  integrations: [react(), ...(publicSiteUrl ? [sitemap()] : [])],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
