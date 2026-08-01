import { expect, test } from "@playwright/test";

import {
  expectAttemptCounter,
  expectAttemptCounterAtTarget,
  expectGameEntrySurface,
  expectGameReadyFromNavigationStart,
  expectInputResponseMarker,
  expectSessionAttemptCount,
} from "./guardrail-assertions";

test("root route starts the anonymous BoulderGame level", async ({ page }) => {
  const navigationStartedAtMs = Date.now();
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("BoulderGame");
  await expect(page).not.toHaveURL(/\/auth\/signin/);
  await expect(page.getByRole("heading", { level: 1, name: "BoulderGame" })).toBeVisible();
  await expectGameEntrySurface(page);
  await expectGameReadyFromNavigationStart(page, navigationStartedAtMs);
  await expectAttemptCounter(page, 1);
  await expectSessionAttemptCount(page, 1);
  await expect(page.getByRole("link", { name: /sign in|sign up/i })).toHaveCount(0);
  await expect(page.getByText("Supabase nie jest skonfigurowany")).toHaveCount(0);
});

test.skip("future controllable board exposes input response and replay target markers", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectAttemptCounterAtTarget(page);
});
