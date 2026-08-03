import { expect, test, type Page } from "@playwright/test";

import { GAME_TIMING } from "../../src/lib/game-clock";
import { GAME_GUARDRAIL_TEST_IDS } from "../../src/lib/game-guardrails";

import {
  advanceGameClock,
  expectBoulderAt,
  expectGameHydrated,
  expectLevelStatus,
  expectNoBoulderAt,
  expectOutcomeMessage,
  expectPlayerAt,
  expectUnstableBoulderAt,
} from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

/**
 * A supported boulder slides sideways once a whole flank — the tile beside it AND the diagonal
 * below that tile — is open. These tests exercise the rule against cave-01's two set pieces: the
 * shaft boulder at (1,8) and the stack at (1,4)/(2,4).
 */

/**
 * Start (3,2) → (2,7) via row 4 (clear of the stack), then up to (1,7). Digging (2,7) then (1,7)
 * opens the left flank of the boulder at (1,8) while its support at (2,8) stays intact. Nine
 * accepted moves, ending on the roll target.
 */
const OPEN_THE_SHAFT_BOULDER_FLANK = [
  "ArrowRight",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowUp",
];

/**
 * The same approach stopped one tile short: only the diagonal (2,7) is dug, the side tile (1,7)
 * stays Dirt, so the flank never opens. Ends at (2,6), clear of everything.
 */
const DIG_ONLY_THE_DIAGONAL = [
  "ArrowRight",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowLeft",
];

/**
 * Opens BOTH flanks of the (1,4)/(2,4) stack without ever touching its support at (3,4): up the
 * left side for (1,3)/(2,3), back down and around through row 4 for (3,3)/(3,5)/(2,5)/(1,5),
 * ending clear at (1,6). Fourteen accepted moves, all with the clock frozen.
 */
const OPEN_BOTH_STACK_FLANKS = [
  "ArrowUp",
  "ArrowRight",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowDown",
  "ArrowRight",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowUp",
  "ArrowUp",
  "ArrowRight",
];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function expectLossCause(page: Page, expected: "spikes" | "crushed" | "none"): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.lossCause)).toHaveText(expected);
}

test("a boulder rolls into an opened flank after the grace window, then keeps moving", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await expectBoulderAt(page, 1, 8);

  await pressKeys(page, [...OPEN_THE_SHAFT_BOULDER_FLANK, "ArrowLeft"]);
  await expectPlayerAt(page, 1, 6);

  // The flank is open but the support at (2,8) is intact — the boulder is unsettled, not falling.
  await expectUnstableBoulderAt(page, 1, 8);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs - 1);
  await expectUnstableBoulderAt(page, 1, 8);
  await expectNoBoulderAt(page, 1, 7);

  // The roll fires exactly when the grace window expires: one tile sideways, not down.
  await advanceGameClock(page, 1);
  await expectBoulderAt(page, 1, 7);
  await expectNoBoulderAt(page, 1, 8);

  // From there ordinary gravity takes over at the fall cadence, down the corridor the Miner dug.
  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs);
  await expectBoulderAt(page, 2, 7);

  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs);
  await expectBoulderAt(page, 3, 7);

  // (3,7) is supported by Dirt at (4,7), but the pre-carved shaft (3,8)/(4,8) is an open right
  // flank — the boulder rolls again, into the shaft, and settles on the Dirt at (5,8).
  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs);
  await expectBoulderAt(page, 3, 8);

  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs);
  await expectBoulderAt(page, 4, 8);

  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs * 5);
  await expectBoulderAt(page, 4, 8);
  await expect(page.getByText("The cave is stable.")).toBeAttached();
});

test("no roll while the side tile stays plugged — a diagonal alone is not a flank", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, DIG_ONLY_THE_DIAGONAL);
  await expectPlayerAt(page, 2, 6);

  // Not unstable: (2,7) is open but the Dirt at (1,7) still closes the flank.
  await expectBoulderAt(page, 1, 8);
  await expect(page.getByText("The cave is stable.")).toBeAttached();

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs * 3);
  await expectBoulderAt(page, 1, 8);
});

test("left wins when both flanks are open, and a lost support beats a roll", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await expectBoulderAt(page, 1, 4);
  await expectBoulderAt(page, 2, 4);

  await pressKeys(page, OPEN_BOTH_STACK_FLANKS);
  await expectPlayerAt(page, 1, 6);

  // The clock never advanced during the trek, so the whole stack is still in place.
  await expectUnstableBoulderAt(page, 2, 4);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  // The lower boulder had both flanks open and chose left. The upper one lost its support the
  // moment the lower moved — an unsupported boulder falls straight down, it never rolls.
  await expectBoulderAt(page, 2, 3);
  await expectBoulderAt(page, 2, 4);
  await expectNoBoulderAt(page, 1, 4);

  // Let the chain play out: the left boulder drops to the gem at (5,3)'s roof, the right one
  // finds its remaining open flank and settles above the spikes at (5,5).
  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs * 6);
  await expectBoulderAt(page, 4, 3);
  await expectBoulderAt(page, 4, 5);
  await expectLevelStatus(page, "active");
  await expect(page.getByText("The cave is stable.")).toBeAttached();
});

test("a boulder that rolls onto the Miner crushes them", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  // The Miner opens the flank and stays on (1,7) — the roll target.
  await pressKeys(page, OPEN_THE_SHAFT_BOULDER_FLANK);
  await expectPlayerAt(page, 1, 7);
  await expectUnstableBoulderAt(page, 1, 8);
  await expectLevelStatus(page, "active");

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  await expectLevelStatus(page, "lost");
  await expectLossCause(page, "crushed");
  await expectOutcomeMessage(page, /failed — crushed by a falling boulder/i);
  // The Miner's tile renders the Miner, not the boulder that rolled onto it — the proof the roll
  // happened is the vacated shaft mouth.
  await expectPlayerAt(page, 1, 7);
  await expectNoBoulderAt(page, 1, 8);
});
