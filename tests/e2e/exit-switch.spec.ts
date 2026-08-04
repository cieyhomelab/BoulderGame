import { test, type Page } from "@playwright/test";

import {
  expectCollectedGems,
  expectExitOpenAt,
  expectExitSealedAt,
  expectGameHydrated,
  expectGemQuota,
  expectInputResponseText,
  expectLevelStatus,
  expectPlayerAt,
} from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

/** cave-01's exit. Sealed until the two-gem quota is met, then open. */
const EXIT = { row: 6, col: 10 } as const;

/** Start (3,2) → the quota gem at (5,3). Three accepted moves, no boulder disturbed. */
const ROUTE_TO_THE_FIRST_QUOTA_GEM = ["ArrowRight", "ArrowDown", "ArrowDown"];

/** (5,3) → the second quota gem at (5,7), along row 6 and up. Six accepted moves. */
const ROUTE_TO_THE_SECOND_QUOTA_GEM = ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowUp"];

/**
 * Start (3,2) → (6,9), the tile west of the exit, down column 1 and east along row 6. Twelve
 * accepted moves that collect no gem and disturb no boulder — the Miner arrives at the exit with
 * an empty bag on purpose.
 */
const ROUTE_TO_THE_EXIT_DOOR = [
  "ArrowLeft",
  "ArrowDown",
  "ArrowDown",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

test("the exit stays sealed until the quota is met, then unseals in place", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await expectGemQuota(page, "00/02");
  await expectExitSealedAt(page, EXIT.row, EXIT.col);

  // One gem short of the quota is still short: the switch flips on the quota, not on any gem.
  await pressKeys(page, ROUTE_TO_THE_FIRST_QUOTA_GEM);
  await expectPlayerAt(page, 5, 3);
  await expectCollectedGems(page, 1);
  await expectExitSealedAt(page, EXIT.row, EXIT.col);

  await pressKeys(page, ROUTE_TO_THE_SECOND_QUOTA_GEM);
  await expectPlayerAt(page, 5, 7);
  await expectGemQuota(page, "02/02");

  // The exit opens where it always was — same tile, same guardrail — and the level runs on until
  // the Miner actually walks into it.
  await expectExitOpenAt(page, EXIT.row, EXIT.col);
  await expectLevelStatus(page, "active");
});

test("the sealed exit refuses the Miner and does not cost a move", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, ROUTE_TO_THE_EXIT_DOOR);
  await expectPlayerAt(page, 6, 9);
  await expectCollectedGems(page, 0);
  await expectExitSealedAt(page, EXIT.row, EXIT.col);

  // Walking east into the bars is refused the way a wall is: the Miner does not move, the level
  // is neither won nor lost, and the move counter does not advance.
  await expectInputResponseText(page, `${ROUTE_TO_THE_EXIT_DOOR.length}:6,9`);
  await pressKeys(page, ["ArrowRight"]);
  await expectPlayerAt(page, 6, 9);
  await expectInputResponseText(page, `${ROUTE_TO_THE_EXIT_DOOR.length}:6,9`);
  await expectLevelStatus(page, "active");
});
