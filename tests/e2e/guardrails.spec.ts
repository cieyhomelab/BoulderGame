import { expect, test, type Page } from "@playwright/test";

import {
  activateReplay,
  expectAttemptCounter,
  expectAttemptCounterAtTarget,
  expectBonusGems,
  expectCollectedGems,
  expectExitAt,
  expectGameEntrySurface,
  expectGameReadyFromNavigationStart,
  expectGemQuota,
  expectGemsRemaining,
  expectHazardAt,
  expectInputResponseMarker,
  expectInputResponseText,
  expectLevelStatus,
  expectOutcomeMessage,
  expectPlayerAt,
  expectPlayerRemainsAtAfterInput,
  expectReplayButtonHidden,
  expectReplayButtonInViewport,
  expectReplayButtonVisible,
  expectScore,
  expectSessionAttemptCount,
  pressAndExpectInputResponse,
} from "./guardrail-assertions";

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function collectFirstTwoGems(page: Page): Promise<void> {
  await pressKeys(page, ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]);
  await expectCollectedGems(page, 1);

  await pressKeys(page, ["ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowUp", "ArrowUp"]);
  await expectPlayerAt(page, 1, 3);
  await expectCollectedGems(page, 2);
}

async function moveFromTopGemToExitSafely(page: Page): Promise<void> {
  await pressKeys(page, [
    "ArrowDown",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowDown",
    "ArrowDown",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowUp",
  ]);
}

async function collectRiskyBonusFromTopGem(page: Page): Promise<void> {
  await pressKeys(page, [
    "ArrowDown",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowDown",
    "ArrowDown",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowRight",
    "ArrowUp",
  ]);
  await expectPlayerAt(page, 5, 7);
  await expectCollectedGems(page, 3);
}

async function moveFromBonusGemToExitSafely(page: Page): Promise<void> {
  await pressKeys(page, ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowUp"]);
}

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
  await expectGemQuota(page, "00/02");
  await expectBonusGems(page, "0/1");
  await expectReplayButtonHidden(page);
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
  await expectGemQuota(page, "00/02");
  await expectBonusGems(page, "0/1");

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
  await expectGemQuota(page, "01/02");
  await expectBonusGems(page, "0/1");
  await expectReplayButtonHidden(page);
  await expect(page.getByText(/won|lost/i)).toHaveCount(0);
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
  await expectOutcomeMessage(page, /cave-in/i);
  await expectReplayButtonVisible(page);

  await activateReplay(page);
  await expectAttemptCounter(page, 2);
  await expectSessionAttemptCount(page, 2);
  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 3);
  await expectInputResponseText(page, "0:3,3");
  await expectGemsRemaining(page, 3);
  await expectScore(page, 0);
  await expectCollectedGems(page, 0);
  await expectGemQuota(page, "00/02");
  await expectBonusGems(page, "0/1");
  await expectReplayButtonHidden(page);
});

test("player completes the level safely after meeting the gem quota", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectExitAt(page, 5, 9);
  await collectFirstTwoGems(page);
  await expectGemsRemaining(page, 1);
  await expectGemQuota(page, "02/02");
  await expectBonusGems(page, "0/1");
  await expectScore(page, 200);

  await moveFromTopGemToExitSafely(page);
  await expectPlayerAt(page, 5, 9);
  await expectLevelStatus(page, "won");
  await expectGemsRemaining(page, 1);
  await expectScore(page, 200);

  await expectPlayerRemainsAtAfterInput(page, "ArrowLeft", 5, 9);
  await expectLevelStatus(page, "won");
  await expectOutcomeMessage(page, /level complete/i);
  await expectReplayButtonVisible(page);

  await activateReplay(page);
  await expectAttemptCounter(page, 2);
  await expectSessionAttemptCount(page, 2);
  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 3);
  await expectInputResponseText(page, "0:3,3");
  await expectGemsRemaining(page, 3);
  await expectScore(page, 0);
  await expectCollectedGems(page, 0);
  await expectGemQuota(page, "00/02");
  await expectBonusGems(page, "0/1");
  await expectReplayButtonHidden(page);
});

test("player can take the risky bonus gem for a higher completion score", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectHazardAt(page, 5, 8);
  await collectFirstTwoGems(page);
  await collectRiskyBonusFromTopGem(page);
  await expectGemsRemaining(page, 0);
  await expectGemQuota(page, "02/02");
  await expectBonusGems(page, "1/1");
  await expectScore(page, 300);

  await moveFromBonusGemToExitSafely(page);
  await expectPlayerAt(page, 5, 9);
  await expectLevelStatus(page, "won");
  await expectScore(page, 300);
});

test("player loses by stepping from the risky bonus gem into the adjacent hazard", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectHazardAt(page, 5, 8);
  await collectFirstTwoGems(page);
  await collectRiskyBonusFromTopGem(page);

  await page.keyboard.press("ArrowRight");
  await expectPlayerAt(page, 5, 8);
  await expectLevelStatus(page, "lost");
  await expectScore(page, 300);
  await expectReplayButtonVisible(page);
});

test("replay loop reaches the repeat-play threshold", async ({ page }) => {
  await page.goto("/");

  await expectAttemptCounter(page, 1);

  await expectHazardAt(page, 3, 2);
  await pressAndExpectInputResponse(page, "ArrowLeft", "1:3,2");
  await expectLevelStatus(page, "lost");
  await activateReplay(page);
  await expectAttemptCounter(page, 2);
  await expectLevelStatus(page, "active");

  await expectHazardAt(page, 3, 2);
  await pressAndExpectInputResponse(page, "ArrowLeft", "1:3,2");
  await expectLevelStatus(page, "lost");
  await activateReplay(page);
  await expectAttemptCounterAtTarget(page);
  await expectSessionAttemptCount(page, 3);
  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 3);
  await expectInputResponseText(page, "0:3,3");
  await expectReplayButtonHidden(page);
});

test("mobile terminal states keep replay action in viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectInputResponseMarker(page);
  await pressAndExpectInputResponse(page, "ArrowLeft", "1:3,2");
  await expectLevelStatus(page, "lost");
  await expectReplayButtonInViewport(page);

  await activateReplay(page);
  await collectFirstTwoGems(page);
  await collectRiskyBonusFromTopGem(page);
  await moveFromBonusGemToExitSafely(page);
  await expectLevelStatus(page, "won");
  await expectReplayButtonInViewport(page);
});
