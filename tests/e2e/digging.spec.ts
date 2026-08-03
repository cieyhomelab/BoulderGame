import { expect, test, type Page } from "@playwright/test";

import { GAME_GUARDRAIL_TEST_IDS } from "../../src/lib/game-guardrails";

import {
  activateReplay,
  expectCollectedGems,
  expectDirtAt,
  expectGameHydrated,
  expectHazardAt,
  expectInputResponseText,
  expectLevelStatus,
  expectOpenSpaceAt,
  expectPlayerAt,
} from "./guardrail-assertions";

async function pressKeys(page: Page, keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function expectNotOpenSpaceAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.openSpace}"][data-row="${row}"][data-col="${col}"]`),
  ).toHaveCount(0);
}

test("moving into Dirt digs it out and leaves open space behind", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await expectPlayerAt(page, 3, 2);
  await expectDirtAt(page, 3, 3);

  await pressKeys(page, ["ArrowRight", "ArrowDown"]);

  await expectPlayerAt(page, 4, 3);
  await expectOpenSpaceAt(page, 3, 3);
});

test("a dug corridor persists and re-entering it costs nothing", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  // Down through row 4, keeping clear of the Dirt at (3,4) that holds the boulder stack.
  await pressKeys(page, ["ArrowRight", "ArrowDown", "ArrowRight", "ArrowRight"]);
  await expectPlayerAt(page, 4, 5);

  await expectOpenSpaceAt(page, 3, 3);
  await expectOpenSpaceAt(page, 4, 3);
  await expectOpenSpaceAt(page, 4, 4);

  // Walk back across the corridor: already-dug tiles remove nothing and collect nothing.
  await pressKeys(page, ["ArrowLeft", "ArrowLeft"]);
  await expectPlayerAt(page, 4, 3);
  await expectInputResponseText(page, "6:4,3");
  await expectCollectedGems(page, 0);

  await expectOpenSpaceAt(page, 4, 4);
  await expectOpenSpaceAt(page, 4, 5);
});

test("a wall is not diggable and the move is rejected", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, ["ArrowLeft"]);
  await expectPlayerAt(page, 3, 1);

  // (3,0) is the border wall.
  await pressKeys(page, ["ArrowLeft"]);

  await expectPlayerAt(page, 3, 1);
  await expectInputResponseText(page, "1:3,1");
  await expectNotOpenSpaceAt(page, 3, 0);
});

test("Play again restores dug Dirt", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  // Dig a corridor down to the spikes at (5,5) and die there.
  await pressKeys(page, ["ArrowRight", "ArrowDown", "ArrowRight", "ArrowRight"]);
  await expectOpenSpaceAt(page, 3, 3);
  await expectOpenSpaceAt(page, 4, 3);

  await pressKeys(page, ["ArrowDown"]);
  await expectLevelStatus(page, "lost");
  // The dead Miner disappears — the spikes they stepped on show in their place.
  await expectHazardAt(page, 5, 5);
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.player)).toHaveCount(0);

  await activateReplay(page);

  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 2);
  await expectDirtAt(page, 3, 3);
  await expectDirtAt(page, 4, 3);
  await expectDirtAt(page, 4, 4);
});
