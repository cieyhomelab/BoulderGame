import { expect, test, type Page } from "@playwright/test";

import { GAME_GUARDRAIL_TEST_IDS } from "../../src/lib/game-guardrails";

import {
  activateReplay,
  expectCollectedGems,
  expectDirtAt,
  expectGameHydrated,
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

  await expectPlayerAt(page, 3, 3);
  await expectDirtAt(page, 3, 4);

  await pressKeys(page, ["ArrowRight", "ArrowRight"]);

  await expectPlayerAt(page, 3, 5);
  await expectOpenSpaceAt(page, 3, 4);
});

test("a dug corridor persists and re-entering it costs nothing", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]);
  await expectPlayerAt(page, 3, 7);

  for (const col of [4, 5, 6]) {
    await expectOpenSpaceAt(page, 3, col);
  }

  // Walk back across the corridor: already-dug tiles remove nothing and collect nothing.
  await pressKeys(page, ["ArrowLeft", "ArrowLeft", "ArrowLeft"]);
  await expectPlayerAt(page, 3, 4);
  await expectInputResponseText(page, "7:3,4");
  await expectCollectedGems(page, 0);

  for (const col of [5, 6, 7]) {
    await expectOpenSpaceAt(page, 3, col);
  }
});

test("a wall is not diggable and the move is rejected", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, ["ArrowUp"]);
  await expectPlayerAt(page, 2, 3);

  await pressKeys(page, ["ArrowLeft"]);

  await expectPlayerAt(page, 2, 3);
  await expectInputResponseText(page, "1:2,3");
  await expectNotOpenSpaceAt(page, 2, 2);
});

test("Play again restores dug Dirt", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  await pressKeys(page, ["ArrowRight", "ArrowRight"]);
  await expectOpenSpaceAt(page, 3, 4);

  await pressKeys(page, ["ArrowLeft", "ArrowLeft", "ArrowLeft"]);
  await expectPlayerAt(page, 3, 2);
  await expectLevelStatus(page, "lost");

  await activateReplay(page);

  await expectLevelStatus(page, "active");
  await expectPlayerAt(page, 3, 3);
  await expectDirtAt(page, 3, 4);
  await expectDirtAt(page, 3, 5);
});
