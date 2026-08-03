import { test, type Page } from "@playwright/test";

import { GAME_TIMING } from "../../src/lib/game-clock";

import {
  activateNextLevel,
  activateReplay,
  advanceGameClock,
  expectAttemptCounter,
  expectBonusGems,
  expectBoulderAt,
  expectCollectedGems,
  expectExitAt,
  expectGameHydrated,
  expectGemQuota,
  expectGemsRemaining,
  expectHazardAt,
  expectLevelName,
  expectLevelStatus,
  expectNextLevelButtonHidden,
  expectNextLevelButtonVisible,
  expectOutcomeMessage,
  expectPlayerAt,
  expectReplayButtonVisible,
  expectScore,
} from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

/** Start (3,2) → exit (6,10) on cave-01, collecting both quota gems. Mirrors `guardrails.spec.ts`. */
const CAVE_01_WINNING_ROUTE = [
  "ArrowRight",
  "ArrowDown",
  "ArrowDown",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
];

/**
 * Start (3,3) → gem (2,2) → gem (5,10) → exit (6,1) on cave-02. Runs along row 3 and row 6, which
 * never touch a boulder's support at (2,4) or (2,9), so the cave stays still for the whole route.
 */
const CAVE_02_WINNING_ROUTE = [
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowDown",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowLeft",
  "ArrowLeft",
  "ArrowLeft",
  "ArrowLeft",
  "ArrowLeft",
  "ArrowLeft",
  "ArrowLeft",
  "ArrowLeft",
];

/** Start (3,3) → (2,9), the bonus gem that is boulder (1,9)'s only support. Seven accepted moves. */
const CAVE_02_ROUTE_TO_BONUS_GEM = [
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function winCaveOneAndAdvance(page: Page): Promise<void> {
  await pressKeys(page, CAVE_01_WINNING_ROUTE);
  await expectLevelStatus(page, "won");
  await activateNextLevel(page);
  await expectLevelStatus(page, "active");
}

test("clearing a cave that has a successor offers the way onward", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, CAVE_01_WINNING_ROUTE);

  await expectLevelStatus(page, "won");
  await expectOutcomeMessage(page, /a deeper cave is open/i);
  await expectNextLevelButtonVisible(page);
  // Advancing is offered alongside a replay, never instead of it.
  await expectReplayButtonVisible(page);
});

test("a lost cave is replayed, never skipped", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  // Spikes at (5,5) on cave-01 — a cave that does have a successor, so the absent button is the
  // rule being tested rather than an artefact of being on the last level.
  await pressKeys(page, ["ArrowRight", "ArrowDown", "ArrowRight", "ArrowRight", "ArrowDown"]);

  await expectLevelStatus(page, "lost");
  await expectReplayButtonVisible(page);
  await expectNextLevelButtonHidden(page);
});

test("advancing loads the second cave with a fresh board and HUD", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await winCaveOneAndAdvance(page);

  await expectLevelName(page, "Level 02");
  await expectPlayerAt(page, 3, 3);
  await expectScore(page, 0);
  await expectCollectedGems(page, 0);
  await expectGemsRemaining(page, 3);
  await expectGemQuota(page, "00/02");
  await expectBonusGems(page, "0/1");

  // cave-02's landmarks: the exit sits opposite the start, and both boulders rest in their columns.
  await expectExitAt(page, 6, 1);
  await expectHazardAt(page, 5, 2);
  await expectHazardAt(page, 5, 7);
  await expectBoulderAt(page, 1, 4);
  await expectBoulderAt(page, 1, 9);
});

test("advancing counts as a fresh attempt", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);
  await expectAttemptCounter(page, 1);

  await winCaveOneAndAdvance(page);

  await expectAttemptCounter(page, 2);
});

test("replaying the second cave restarts it rather than the first", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);
  await winCaveOneAndAdvance(page);

  // Down column 1 and onto the spikes at (5,2), the shortest terminal state on cave-02. Column 2
  // is walled at row 4, so the spikes are only reachable along row 5.
  await pressKeys(page, ["ArrowLeft", "ArrowLeft", "ArrowDown", "ArrowDown", "ArrowRight"]);
  await expectLevelStatus(page, "lost");

  await activateReplay(page);

  await expectLevelStatus(page, "active");
  await expectLevelName(page, "Level 02");
  await expectPlayerAt(page, 3, 3);
  await expectExitAt(page, 6, 1);
});

test("the last cave offers no successor", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);
  await winCaveOneAndAdvance(page);

  await pressKeys(page, CAVE_02_WINNING_ROUTE);

  await expectPlayerAt(page, 6, 1);
  await expectLevelStatus(page, "won");
  await expectOutcomeMessage(page, /play again/i);
  await expectNextLevelButtonHidden(page);
  await expectReplayButtonVisible(page);
});

test("cave-02's bonus gem is the boulder's support, so taking it and standing still is fatal", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await winCaveOneAndAdvance(page);

  await expectBoulderAt(page, 1, 9);
  await pressKeys(page, CAVE_02_ROUTE_TO_BONUS_GEM);

  // The gem is gone, so the boulder above has lost the only thing holding it up.
  await expectPlayerAt(page, 2, 9);
  await expectCollectedGems(page, 1);
  // The HUD fills the quota before the bonus, so an early bonus gem still reads as quota progress.
  await expectGemQuota(page, "01/02");
  await expectBonusGems(page, "0/1");
  await expectLevelStatus(page, "active");

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  await expectLevelStatus(page, "lost");
});

test("stepping aside within the grace window survives the bonus gem's boulder", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await winCaveOneAndAdvance(page);

  await pressKeys(page, CAVE_02_ROUTE_TO_BONUS_GEM);
  await expectPlayerAt(page, 2, 9);

  // Sideways, not down: the boulder falls through column 9 and would follow the Miner there.
  await pressKeys(page, ["ArrowLeft"]);
  await expectPlayerAt(page, 2, 8);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs + GAME_TIMING.boulderFallIntervalMs);

  await expectLevelStatus(page, "active");
  await expectCollectedGems(page, 1);
});
