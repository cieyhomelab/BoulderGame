import { expect, test } from "@playwright/test";

import {
  expectAttemptCounter,
  expectAttemptCounterAtTarget,
  expectCollectedGems,
  expectExitAt,
  expectGameEntrySurface,
  expectGameReadyFromNavigationStart,
  expectGemsRemaining,
  expectHazardAt,
  expectInputResponseMarker,
  expectInputResponseText,
  expectLevelStatus,
  expectPlayerAt,
  expectPlayerRemainsAtAfterInput,
  expectScore,
  expectSessionAttemptCount,
  pressAndExpectInputResponse,
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
  await expectLevelStatus(page, "active");
  await expect(page.getByRole("link", { name: /sign in|sign up/i })).toHaveCount(0);
  await expect(page.getByText("Supabase nie jest skonfigurowany")).toHaveCount(0);
});

test("player moves on accepted input and stays put against blockers", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectPlayerAt(page, 3, 3);

  await pressAndExpectInputResponse(page, "ArrowDown", "1:4,3");
  await expectPlayerAt(page, 4, 3);

  await page.keyboard.press("ArrowDown");
  await expectPlayerAt(page, 4, 3);
  await expectInputResponseText(page, "1:4,3");

  await pressAndExpectInputResponse(page, "ArrowRight", "2:4,4");
  await expectPlayerAt(page, 4, 4);
});

test("player collects a gem and updates the HUD", async ({ page }) => {
  await page.goto("/");

  await expectPlayerAt(page, 3, 3);
  await expectGemsRemaining(page, 3);
  await expectScore(page, 0);
  await expectCollectedGems(page, 0);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  await expectPlayerAt(page, 3, 8);
  await expectInputResponseText(page, "5:3,8");
  await expectGemsRemaining(page, 2);
  await expectScore(page, 100);
  await expectCollectedGems(page, 1);
  await expect(page.getByText(/won|lost|play again/i)).toHaveCount(0);
});

test("player loses on a hazard and movement freezes", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectHazardAt(page, 3, 2);
  await pressAndExpectInputResponse(page, "ArrowLeft", "1:3,2");
  await expectPlayerAt(page, 3, 2);
  await expectLevelStatus(page, "lost");

  await expectPlayerRemainsAtAfterInput(page, "ArrowRight", 3, 2);
  await expectInputResponseText(page, "1:3,2");
});

test("player completes the level after collecting all gems and entering the exit", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectExitAt(page, 5, 9);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expectCollectedGems(page, 1);

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expectPlayerAt(page, 1, 3);
  await expectCollectedGems(page, 2);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expectPlayerAt(page, 5, 7);
  await expectCollectedGems(page, 3);
  await expectGemsRemaining(page, 0);
  await expectScore(page, 300);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expectPlayerAt(page, 5, 9);
  await expectLevelStatus(page, "won");

  await expectPlayerRemainsAtAfterInput(page, "ArrowLeft", 5, 9);
  await expectLevelStatus(page, "won");
  await expect(page.getByText(/play again/i)).toHaveCount(0);
});

test.skip("future replay target marker reaches the repeat-play threshold", async ({ page }) => {
  await page.goto("/");

  await expectAttemptCounterAtTarget(page);
});
