const publicSiteUrl = process.env.PUBLIC_SITE_URL;

if (!publicSiteUrl) {
  console.error(
    "PUBLIC_SITE_URL is required before production deploy. Use the real Workers URL, for example https://boulder-game.<account-subdomain>.workers.dev.",
  );
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(publicSiteUrl);
} catch {
  console.error("PUBLIC_SITE_URL must be a valid absolute URL.");
  process.exit(1);
}

if (!["https:", "http:"].includes(parsedUrl.protocol)) {
  console.error("PUBLIC_SITE_URL must start with https:// or http://.");
  process.exit(1);
}

if (parsedUrl.hostname === "boulder-game.workers.dev") {
  console.error("PUBLIC_SITE_URL must include the Cloudflare account subdomain, not only boulder-game.workers.dev.");
  process.exit(1);
}

if (parsedUrl.hostname.includes("your-account") || parsedUrl.hostname.includes("example")) {
  console.error("PUBLIC_SITE_URL must be the confirmed deployed URL, not a documentation placeholder.");
  process.exit(1);
}
