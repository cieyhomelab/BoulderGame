import { expect, test } from "@playwright/test";

import { GAME_GUARDRAIL_TEST_IDS, GAME_GUARDRAIL_THRESHOLDS } from "../../src/lib/game-guardrails";

test("root route loads without forcing an auth redirect", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page.locator("body")).toBeVisible();
  await expect(page).not.toHaveURL(/\/auth\/signin/);
});

test.skip("future game surface exposes readiness, input, and attempt markers", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.readyMarker)).toBeVisible({
    timeout: GAME_GUARDRAIL_THRESHOLDS.firstSessionReadyMs,
  });
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.inputResponseMarker)).toBeVisible({
    timeout: GAME_GUARDRAIL_THRESHOLDS.inputResponseMs,
  });
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.attemptCounter)).toHaveText(
    String(GAME_GUARDRAIL_THRESHOLDS.replayAttemptTarget),
  );
});
