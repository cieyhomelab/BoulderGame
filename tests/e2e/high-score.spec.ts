import { expect, test, type Page } from "@playwright/test";

import type { MoveDirection } from "../../src/lib/game-rules";
import { GEM_SCORE_VALUE } from "../../src/lib/game-score";
import { solveLevel } from "../../src/lib/level-solver";
import { LEVELS, parseLevel, type LevelDefinition } from "../../src/lib/levels";

import {
  activateNextLevel,
  activateReplay,
  expectCollectedGems,
  expectGameHydrated,
  expectHighScore,
  expectLevelStatus,
  expectScore,
  expectStoredHighScore,
  readCollectedGems,
  readScore,
} from "./guardrail-assertions";

const KEY_BY_DIRECTION: Record<MoveDirection, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

/** Searched rather than hand-written, for the reasons `level-progression.spec.ts` spells out. */
function winningKeysFor(definition: LevelDefinition): string[] {
  const solution = solveLevel(parseLevel(definition));

  if (!solution.solved) {
    throw new Error(`${definition.id} has no winning route; \`npm run level:check\` explains why.`);
  }

  if (solution.disturbsBoulders) {
    throw new Error(`${definition.id}'s shortest route disturbs a boulder, so it is timing-dependent.`);
  }

  return solution.route.map((direction) => KEY_BY_DIRECTION[direction]);
}

/** Start (3,2) → the quota gem at (5,3) on cave-01. Three accepted moves. */
const ROUTE_TO_FIRST_GEM = ["ArrowRight", "ArrowDown", "ArrowDown"];

/** (5,3) → the spikes at (5,5). Two accepted moves. */
const ROUTE_FIRST_GEM_TO_SPIKES = ["ArrowRight", "ArrowRight"];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

test("the score accumulates across caves rather than restarting with each one", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);
  await expectScore(page, 0);

  await pressKeys(page, winningKeysFor(LEVELS[0]));
  await expectLevelStatus(page, "won");
  const caveOneScore = await readScore(page);
  expect(caveOneScore).toBeGreaterThan(0);

  await activateNextLevel(page);
  await expectLevelStatus(page, "active");
  await expectCollectedGems(page, 0);
  await expectScore(page, caveOneScore);

  await pressKeys(page, winningKeysFor(LEVELS[1]));
  await expectLevelStatus(page, "won");

  // Cave-02's own gems, added on top of what cave-01 banked.
  const caveTwoGems = await readCollectedGems(page);
  expect(caveTwoGems).toBeGreaterThan(0);
  await expectScore(page, caveOneScore + caveTwoGems * GEM_SCORE_VALUE);
});

test("the record outlives the run that set it", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);
  await expectHighScore(page, 0);

  await pressKeys(page, ROUTE_TO_FIRST_GEM);
  await expectScore(page, GEM_SCORE_VALUE);
  await expectHighScore(page, GEM_SCORE_VALUE);
  await expectStoredHighScore(page, GEM_SCORE_VALUE);

  await pressKeys(page, ROUTE_FIRST_GEM_TO_SPIKES);
  await expectLevelStatus(page, "lost");
  // Dying keeps the record: it is banked as the run climbs, not awarded at a win.
  await expectHighScore(page, GEM_SCORE_VALUE);

  await activateReplay(page);
  await expectLevelStatus(page, "active");
  await expectScore(page, 0);
  await expectHighScore(page, GEM_SCORE_VALUE);
});

test("the record survives a reload while the run does not", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, ROUTE_TO_FIRST_GEM);
  await expectStoredHighScore(page, GEM_SCORE_VALUE);

  await page.reload();
  await expectGameHydrated(page);

  await expectScore(page, 0);
  await expectHighScore(page, GEM_SCORE_VALUE);
});

test("a run that falls short of the record leaves it standing", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, winningKeysFor(LEVELS[0]));
  const caveOneScore = await readScore(page);
  await expectStoredHighScore(page, caveOneScore);

  await page.reload();
  await expectGameHydrated(page);

  // One gem is worth less than clearing the cave, so the stored record must not be overwritten.
  await pressKeys(page, ROUTE_TO_FIRST_GEM);
  await expectScore(page, GEM_SCORE_VALUE);
  await expectHighScore(page, caveOneScore);
  await expectStoredHighScore(page, caveOneScore);
});
