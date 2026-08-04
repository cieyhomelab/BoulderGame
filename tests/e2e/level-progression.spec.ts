import { expect, test, type Page } from "@playwright/test";

import { GAME_TIMING } from "../../src/lib/game-clock";
import type { MoveDirection } from "../../src/lib/game-rules";
import { solveLevel } from "../../src/lib/level-solver";
import { LEVELS, parseLevel, type LevelDefinition } from "../../src/lib/levels";

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
  readScore,
} from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

const KEY_BY_DIRECTION: Record<MoveDirection, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

/**
 * The winning keystrokes for a cave, searched rather than hand-derived. Working these out by hand
 * was the most error-prone step in authoring cave-02 — two of the first attempts walked into a
 * wall — and the sequences went stale the moment a row changed.
 */
function winningKeysFor(definition: LevelDefinition): string[] {
  const solution = solveLevel(parseLevel(definition));

  if (!solution.solved) {
    throw new Error(`${definition.id} has no winning route; \`npm run level:check\` explains why.`);
  }

  // A route that never destabilises a boulder produces the same outcome at any press speed, which
  // is what makes it safe to replay as keystrokes against the real clock.
  if (solution.disturbsBoulders) {
    throw new Error(`${definition.id}'s shortest route disturbs a boulder, so it is timing-dependent.`);
  }

  return solution.route.map((direction) => KEY_BY_DIRECTION[direction]);
}

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

/** Returns the score banked by clearing cave-01, which the caves after it build on. */
async function winCaveOneAndAdvance(page: Page): Promise<number> {
  await pressKeys(page, winningKeysFor(LEVELS[0]));
  await expectLevelStatus(page, "won");
  const bankedScore = await readScore(page);
  await activateNextLevel(page);
  await expectLevelStatus(page, "active");

  return bankedScore;
}

test("clearing a cave that has a successor offers the way onward", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, winningKeysFor(LEVELS[0]));

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

  const bankedScore = await winCaveOneAndAdvance(page);

  await expectLevelName(page, "Level 02");
  await expectPlayerAt(page, 3, 3);
  // The board is fresh; the score deliberately is not. Cave-01's gems stay banked in the total
  // while the per-cave counters below all restart.
  expect(bankedScore).toBeGreaterThan(0);
  await expectScore(page, bankedScore);
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

/**
 * Walks the whole registry rather than naming a cave as the last one. Pinning cave-02 here is what
 * broke the first time a third level was tried: the level was fine, the test's assumption was not.
 */
test("every cave leads to the next, and the final one offers no successor", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  for (const [index, definition] of LEVELS.entries()) {
    await expectLevelName(page, definition.name);
    await pressKeys(page, winningKeysFor(definition));
    await expectLevelStatus(page, "won");
    await expectReplayButtonVisible(page);

    if (index === LEVELS.length - 1) {
      await expectOutcomeMessage(page, /play again/i);
      await expectNextLevelButtonHidden(page);
      break;
    }

    await expectOutcomeMessage(page, /a deeper cave is open/i);
    await activateNextLevel(page);
    await expectLevelStatus(page, "active");
  }
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
