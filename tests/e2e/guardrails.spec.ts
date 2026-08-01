import { expect, test } from "@playwright/test";

import { expectAttemptCounterAtTarget, expectGameReady, expectInputResponseMarker } from "./guardrail-assertions";

test("root route loads without forcing an auth redirect", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("10x Astro Starter");
  await expect(page.getByRole("heading", { level: 1, name: "10x Astro Starter" })).toBeVisible();
  await expect(page.locator("body")).toBeVisible();
  await expect(page).not.toHaveURL(/\/auth\/signin/);
});

test.skip("future game surface exposes readiness, input, and attempt markers", async ({ page }) => {
  await page.goto("/");

  await expectGameReady(page);
  await expectInputResponseMarker(page);
  await expectAttemptCounterAtTarget(page);
});
