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
 * Start (3,2) → (3,4), the Dirt holding the boulder stack at (2,4)/(1,4) → back to (3,3), clear
 * of the drop. Three accepted moves.
 */
const UNDERMINE_STACK_AND_STEP_CLEAR = ["ArrowRight", "ArrowRight", "ArrowLeft"];

/**
 * Start (3,2) → (2,8), the Dirt plug holding the shaft boulder at (1,8) → back to (2,7). Routed
 * through row 4 so it never disturbs the stack at column 4. Ten accepted moves.
 */
const UNDERMINE_SHAFT_AND_STEP_CLEAR = [
  "ArrowRight",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowRight",
  "ArrowLeft",
];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

test("an undermined boulder holds position for the whole grace window", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await expectBoulderAt(page, 2, 4);

  await pressKeys(page, UNDERMINE_STACK_AND_STEP_CLEAR);
  await expectPlayerAt(page, 3, 3);

  await expectUnstableBoulderAt(page, 2, 4);
  await expectOpenSpaceAt(page, 3, 4);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs - 1);
  await expectUnstableBoulderAt(page, 2, 4);
  await expectNoBoulderAt(page, 3, 4);
});

test("the boulder falls one tile the moment the grace window expires", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, UNDERMINE_STACK_AND_STEP_CLEAR);
  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  await expectNoBoulderAt(page, 2, 4);
  await expectBoulderAt(page, 3, 4);
});

test("a falling boulder advances exactly one tile per fall interval (FR-005)", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await expectBoulderAt(page, 1, 8);

  await pressKeys(page, UNDERMINE_SHAFT_AND_STEP_CLEAR);
  await expectPlayerAt(page, 2, 7);
  await expectUnstableBoulderAt(page, 1, 8);

  // (3,8) and (4,8) are pre-carved shaft, so the boulder has three tiles to travel.
  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);
  await expectBoulderAt(page, 2, 8);

  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs);
  await expectBoulderAt(page, 3, 8);

  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs);
  await expectBoulderAt(page, 4, 8);

  // (5,8) is Dirt — the boulder is supported again and stops.
  await advanceGameClock(page, GAME_TIMING.boulderFallIntervalMs * 5);
  await expectBoulderAt(page, 4, 8);
  await expect(page.getByText("The cave is stable.")).toBeAttached();
});

test("a boulder whose support fell away becomes unstable in turn (FR-009)", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await expectBoulderAt(page, 1, 4);
  await expectBoulderAt(page, 2, 4);

  await pressKeys(page, UNDERMINE_STACK_AND_STEP_CLEAR);

  // Only the lower boulder is unstable — the upper one is still supported by it.
  await expectUnstableBoulderAt(page, 2, 4);
  await expectBoulderAt(page, 1, 4);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  // The lower boulder has landed; the upper one has lost its support and starts its own window.
  await expectBoulderAt(page, 3, 4);
  await expectUnstableBoulderAt(page, 1, 4);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  await expectBoulderAt(page, 2, 4);
  await expectBoulderAt(page, 3, 4);
  await expectNoBoulderAt(page, 1, 4);
  await expect(page.getByText("The cave is stable.")).toBeAttached();
});

test("the cave reports instability to the live status region", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await expect(page.getByText("The cave is stable.")).toBeAttached();

  await pressKeys(page, UNDERMINE_STACK_AND_STEP_CLEAR);
  await expect(page.getByText("1 boulder losing support.")).toBeAttached();
});

test("input stays responsive while a boulder is unstable", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, UNDERMINE_STACK_AND_STEP_CLEAR);
  await expectUnstableBoulderAt(page, 2, 4);

  // Three moves so far; the fourth must still be acknowledged inside the 100 ms threshold.
  await pressAndExpectInputResponse(page, "ArrowLeft", "4:3,2");
  await expectPlayerAt(page, 3, 2);
});

test("Play again returns the boulder to its starting position", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, UNDERMINE_STACK_AND_STEP_CLEAR);
  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs * 2);
  await expectBoulderAt(page, 3, 4);
  await expectBoulderAt(page, 2, 4);

  // Walk down and into the spikes at (5,5) to end the attempt.
  await pressKeys(page, ["ArrowDown", "ArrowRight", "ArrowRight", "ArrowDown"]);
  await expectLevelStatus(page, "lost");

  await activateReplay(page);

  await expectLevelStatus(page, "active");
  await expectBoulderAt(page, 1, 4);
  await expectBoulderAt(page, 2, 4);
  await expectNoBoulderAt(page, 3, 4);
  await expectDirtAt(page, 3, 4);
});
