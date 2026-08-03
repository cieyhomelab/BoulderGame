import { expect, test, type Page } from "@playwright/test";

import { GAME_GUARDRAIL_TEST_IDS } from "../../src/lib/game-guardrails";

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

/**
 * Start (3,2) → spikes (5,5), routed through row 4 so it never digs the Dirt at (3,4) that holds
 * the boulder stack. Five accepted moves, no gem collected.
 */
const ROUTE_TO_SPIKES = ["ArrowRight", "ArrowDown", "ArrowRight", "ArrowRight", "ArrowDown"];

/** Start (3,2) → the quota gem at (5,3). Three accepted moves. */
const ROUTE_TO_FIRST_GEM = ["ArrowRight", "ArrowDown", "ArrowDown"];

/** (5,3) → the second quota gem at (5,7), along row 6. Six accepted moves. */
const ROUTE_FIRST_GEM_TO_SECOND = ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowUp"];

/** (5,7) → the exit at (6,10). Four accepted moves. */
const ROUTE_SECOND_GEM_TO_EXIT = ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowRight"];

async function collectBothQuotaGems(page: Page): Promise<void> {
  await pressKeys(page, ROUTE_TO_FIRST_GEM);
  await expectPlayerAt(page, 5, 3);
  await expectCollectedGems(page, 1);

  await pressKeys(page, ROUTE_FIRST_GEM_TO_SECOND);
  await expectPlayerAt(page, 5, 7);
  await expectCollectedGems(page, 2);
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
  await expectPlayerAt(page, 3, 2);

  await pressAndExpectInputResponse(page, "ArrowLeft", "1:3,1");
  await expectPlayerAt(page, 3, 1);

  // (3,0) is the border wall — the move is rejected and costs nothing.
  await page.keyboard.press("ArrowLeft");
  await expectPlayerAt(page, 3, 1);
  await expectInputResponseText(page, "1:3,1");

  await pressAndExpectInputResponse(page, "ArrowRight", "2:3,2");
  await expectPlayerAt(page, 3, 2);
});

test("player collects a gem and updates the HUD", async ({ page }) => {
  await page.goto("/");

  await expectPlayerAt(page, 3, 2);
  await expectGemsRemaining(page, 3);
  await expectScore(page, 0);
  await expectCollectedGems(page, 0);
  await expectGemQuota(page, "00/02");
  await expectBonusGems(page, "0/1");

  await pressKeys(page, ROUTE_TO_FIRST_GEM);

  await expectPlayerAt(page, 5, 3);
  await expectInputResponseText(page, "3:5,3");
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
  await expectHazardAt(page, 5, 5);

  await pressKeys(page, ROUTE_TO_SPIKES);
  await expectInputResponseText(page, "5:5,5");
  await expectLevelStatus(page, "lost");
  // The dead Miner disappears — the spikes they stepped on show in their place.
  await expectHazardAt(page, 5, 5);
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.player)).toHaveCount(0);

  await page.keyboard.press("ArrowLeft");
  await expectInputResponseText(page, "5:5,5");
  await expectOutcomeMessage(page, /cave-in/i);
  await expectReplayButtonVisible(page);

  await activateReplay(page);
  await expectAttemptCounter(page, 2);
  await expectSessionAttemptCount(page, 2);
  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 2);
  await expectInputResponseText(page, "0:3,2");
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
  await expectExitAt(page, 6, 10);
  await collectBothQuotaGems(page);
  await expectGemsRemaining(page, 1);
  await expectGemQuota(page, "02/02");
  await expectBonusGems(page, "0/1");
  await expectScore(page, 200);

  await pressKeys(page, ROUTE_SECOND_GEM_TO_EXIT);
  await expectPlayerAt(page, 6, 10);
  await expectLevelStatus(page, "won");
  await expectGemsRemaining(page, 1);
  await expectScore(page, 200);

  await expectPlayerRemainsAtAfterInput(page, "ArrowLeft", 6, 10);
  await expectLevelStatus(page, "won");
  await expectOutcomeMessage(page, /level complete/i);
  await expectReplayButtonVisible(page);

  await activateReplay(page);
  await expectAttemptCounter(page, 2);
  await expectSessionAttemptCount(page, 2);
  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 2);
  await expectInputResponseText(page, "0:3,2");
  await expectGemsRemaining(page, 3);
  await expectScore(page, 0);
  await expectCollectedGems(page, 0);
  await expectGemQuota(page, "00/02");
  await expectBonusGems(page, "0/1");
  await expectReplayButtonHidden(page);
});

test("a collected gem's score survives losing on the way onward", async ({ page }) => {
  await page.goto("/");

  await expectInputResponseMarker(page);
  await expectHazardAt(page, 5, 5);

  await pressKeys(page, ROUTE_TO_FIRST_GEM);
  await expectScore(page, 100);

  // (5,3) → (5,4) → the spikes at (5,5).
  await pressKeys(page, ["ArrowRight", "ArrowRight"]);
  await expectLevelStatus(page, "lost");
  await expectHazardAt(page, 5, 5);
  await expectScore(page, 100);
  await expectCollectedGems(page, 1);
  await expectReplayButtonVisible(page);
});

test("replay loop reaches the repeat-play threshold", async ({ page }) => {
  await page.goto("/");

  await expectAttemptCounter(page, 1);

  await expectHazardAt(page, 5, 5);
  await pressKeys(page, ROUTE_TO_SPIKES);
  await expectLevelStatus(page, "lost");
  await activateReplay(page);
  await expectAttemptCounter(page, 2);
  await expectLevelStatus(page, "active");

  await pressKeys(page, ROUTE_TO_SPIKES);
  await expectLevelStatus(page, "lost");
  await activateReplay(page);
  await expectAttemptCounterAtTarget(page);
  await expectSessionAttemptCount(page, 3);
  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 2);
  await expectInputResponseText(page, "0:3,2");
  await expectReplayButtonHidden(page);
});

test("mobile terminal states keep replay action in viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expectInputResponseMarker(page);
  await pressKeys(page, ROUTE_TO_SPIKES);
  await expectLevelStatus(page, "lost");
  await expectReplayButtonInViewport(page);

  await activateReplay(page);
  await collectBothQuotaGems(page);
  await pressKeys(page, ROUTE_SECOND_GEM_TO_EXIT);
  await expectLevelStatus(page, "won");
  await expectReplayButtonInViewport(page);
});
