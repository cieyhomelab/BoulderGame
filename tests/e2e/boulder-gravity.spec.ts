import { expect, test, type Page } from "@playwright/test";

import { GAME_TIMING } from "../../src/lib/game-clock";

import {
  activateReplay,
  advanceGameClock,
  expectBoulderAt,
  expectDirtAt,
  expectGameHydrated,
  expectLevelStatus,
  expectNoBoulderAt,
  expectOpenSpaceAt,
  expectPlayerAt,
  expectUnstableBoulderAt,
  pressAndExpectInputResponse,
} from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

/**
 * Walks from the start at (3,3) down and around to (6,3) — the Dirt holding up the boulder at
 * (5,3) — then one tile clear of it. Six accepted moves.
 */
const UNDERMINE_ROUTE = ["ArrowDown", "ArrowLeft", "ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight"];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function undermineTheBoulder(page: Page): Promise<void> {
  await pressKeys(page, UNDERMINE_ROUTE);
  await expectPlayerAt(page, 6, 4);
}

test("an undermined boulder holds position for the whole grace window", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await expectBoulderAt(page, 5, 3);

  await undermineTheBoulder(page);

  // Support is gone, so the boulder telegraphs immediately — but must not move.
  await expectUnstableBoulderAt(page, 5, 3);
  await expectOpenSpaceAt(page, 6, 3);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs - 1);
  await expectUnstableBoulderAt(page, 5, 3);
  await expectNoBoulderAt(page, 6, 3);
});

test("the boulder falls one tile the moment the grace window expires", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await undermineTheBoulder(page);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  await expectNoBoulderAt(page, 5, 3);
  await expectBoulderAt(page, 6, 3);
  await expectOpenSpaceAt(page, 5, 3);
});

test("the boulder rests on the first support and stops telegraphing", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await undermineTheBoulder(page);
  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  // (7,3) is wall, so the boulder is supported again the instant it lands.
  await expectBoulderAt(page, 6, 3);

  // Well past any further fall step — a landed boulder does not keep moving.
  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs * 10);
  await expectBoulderAt(page, 6, 3);
  await expect(page.getByText("The cave is stable.")).toBeAttached();
});

test("the cave reports instability to the live status region", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await expect(page.getByText("The cave is stable.")).toBeAttached();

  await undermineTheBoulder(page);
  await expect(page.getByText("1 boulder losing support.")).toBeAttached();
});

test("input stays responsive while a boulder is unstable", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await undermineTheBoulder(page);
  await expectUnstableBoulderAt(page, 5, 3);

  // Six moves so far; the seventh must still be acknowledged inside the 100 ms threshold.
  await pressAndExpectInputResponse(page, "ArrowRight", "7:6,5");
  await expectPlayerAt(page, 6, 5);
});

test("Play again returns the boulder to its starting position", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await undermineTheBoulder(page);
  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);
  await expectBoulderAt(page, 6, 3);

  // Walk right along row 6 and step up into the spikes at (5,8) to end the attempt.
  await pressKeys(page, ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowUp"]);
  await expectLevelStatus(page, "lost");

  await activateReplay(page);

  await expectLevelStatus(page, "active");
  await expectBoulderAt(page, 5, 3);
  await expectNoBoulderAt(page, 6, 3);
  await expectDirtAt(page, 6, 3);
});
