import { test, type Page } from "@playwright/test";

import { GAME_TIMING } from "../../src/lib/game-clock";

import {
  advanceGameClock,
  expectBonusGems,
  expectBoulderAt,
  expectCollectedGems,
  expectGameHydrated,
  expectGemQuota,
  expectLevelStatus,
  expectOpenSpaceAt,
  expectPlayerAt,
  expectScore,
} from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

/**
 * Start (3,2) → (2,7), the tile west of the boulder that plugs the gem chamber's only opening.
 * Routed through row 4 so it never disturbs the boulder stack at column 4. Eight accepted moves.
 */
const ROUTE_TO_THE_BOULDER_DOOR = [
  "ArrowRight",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

test("the bonus gem cannot be reached while the boulder plugs its chamber", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  // (1,9) is walled on every side but (1,8), and (1,8) holds a boulder.
  await expectBoulderAt(page, 1, 8);

  await pressKeys(page, ROUTE_TO_THE_BOULDER_DOOR);
  await expectPlayerAt(page, 2, 7);

  // From (1,7), the only way east is through the boulder — and boulders are impassable.
  await pressKeys(page, ["ArrowUp", "ArrowRight"]);
  await expectPlayerAt(page, 1, 7);
  await expectCollectedGems(page, 0);
  await expectBonusGems(page, "0/1");
});

test("undermining the boulder opens the chamber and the bonus gem becomes collectable", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, ROUTE_TO_THE_BOULDER_DOOR);
  await expectPlayerAt(page, 2, 7);

  // Dig the Dirt plug at (2,8) that holds the boulder up, then step back out of its path.
  await pressKeys(page, ["ArrowRight", "ArrowLeft"]);
  await expectPlayerAt(page, 2, 7);
  await expectOpenSpaceAt(page, 2, 8);

  // Grace window plus two fall intervals: the boulder drops down the shaft and rests on (5,8).
  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs + GAME_TIMING.boulderFallIntervalMs * 2);
  await expectBoulderAt(page, 4, 8);

  // (1,8) is now open space, so the chamber is walkable.
  await expectOpenSpaceAt(page, 1, 8);
  await pressKeys(page, ["ArrowUp", "ArrowRight", "ArrowRight"]);

  await expectPlayerAt(page, 1, 9);
  await expectCollectedGems(page, 1);
  await expectBonusGems(page, "0/1");
  await expectGemQuota(page, "01/02");
  await expectScore(page, 100);
  await expectLevelStatus(page, "active");
});
