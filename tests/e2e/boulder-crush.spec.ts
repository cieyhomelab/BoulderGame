import { expect, test, type Page } from "@playwright/test";

import { GAME_TIMING } from "../../src/lib/game-clock";
import { GAME_GUARDRAIL_TEST_IDS } from "../../src/lib/game-guardrails";

import {
  activateReplay,
  advanceGameClock,
  expectAttemptCounter,
  expectBoulderAt,
  expectDirtAt,
  expectGameHydrated,
  expectInputResponseText,
  expectLevelStatus,
  expectOutcomeMessage,
  expectPlayerAt,
  expectReplayButtonHidden,
  expectReplayButtonVisible,
  expectUnstableBoulderAt,
} from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

/** Walks from the start at (3,3) to (6,3) — the Dirt holding the boulder at (5,3) — and stops
 * there, directly underneath it. Five accepted moves. */
const UNDERMINE_AND_STAND_UNDER = ["ArrowDown", "ArrowLeft", "ArrowDown", "ArrowDown", "ArrowRight"];

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function expectLossCause(page: Page, expected: "spikes" | "crushed" | "none"): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.lossCause)).toHaveText(expected);
}

test("a boulder that falls onto the Miner ends the level as Failed", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, UNDERMINE_AND_STAND_UNDER);
  await expectPlayerAt(page, 6, 3);
  await expectUnstableBoulderAt(page, 5, 3);
  await expectLevelStatus(page, "active");

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  await expectLevelStatus(page, "lost");
  await expectLossCause(page, "crushed");
  await expectOutcomeMessage(page, /failed — crushed by a falling boulder/i);
  await expectReplayButtonVisible(page);
});

test("stepping clear during the grace window survives the fall", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, UNDERMINE_AND_STAND_UNDER);
  await expectUnstableBoulderAt(page, 5, 3);

  // The reaction window is real: escaping before it expires is the difference between outcomes.
  await pressKeys(page, ["ArrowRight"]);
  await expectPlayerAt(page, 6, 4);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);

  await expectBoulderAt(page, 6, 3);
  await expectLevelStatus(page, "active");
  await expectLossCause(page, "none");
  await expectReplayButtonHidden(page);
});

test("walking into a boulder is a rejected move, never a death", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await pressKeys(page, ["ArrowDown"]);
  await expectPlayerAt(page, 4, 3);

  // (5,3) is a boulder — the move must be refused, and refusing it must not cost a move.
  await pressKeys(page, ["ArrowDown"]);

  await expectPlayerAt(page, 4, 3);
  await expectInputResponseText(page, "1:4,3");
  await expectLevelStatus(page, "active");
  await expectLossCause(page, "none");
});

test("a supported boulder overhead is safe indefinitely", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  // Stand beside the boulder without touching the Dirt that holds it up.
  await pressKeys(page, ["ArrowDown", "ArrowLeft", "ArrowDown", "ArrowDown"]);
  await expectPlayerAt(page, 6, 2);
  await expectBoulderAt(page, 5, 3);

  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs + GAME_TIMING.boulderFallIntervalMs * 50);

  await expectBoulderAt(page, 5, 3);
  await expectLevelStatus(page, "active");
  await expectLossCause(page, "none");
});

test("Play again after a crush resets exactly as it does after a spike loss", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);
  await expectAttemptCounter(page, 1);

  await pressKeys(page, UNDERMINE_AND_STAND_UNDER);
  await advanceGameClock(page, GAME_TIMING.boulderGraceWindowMs);
  await expectLevelStatus(page, "lost");

  await activateReplay(page);

  await expectAttemptCounter(page, 2);
  await expectLevelStatus(page, "active");
  await expectLossCause(page, "none");
  await expectPlayerAt(page, 3, 3);
  await expectInputResponseText(page, "0:3,3");
  await expectBoulderAt(page, 5, 3);
  await expectDirtAt(page, 6, 3);
  await expectReplayButtonHidden(page);
});
