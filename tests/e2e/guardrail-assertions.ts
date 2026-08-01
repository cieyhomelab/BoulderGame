import { expect, type Page } from "@playwright/test";

import {
  GAME_ATTEMPT_SESSION_KEY,
  GAME_GUARDRAIL_TEST_IDS,
  GAME_GUARDRAIL_THRESHOLDS,
} from "../../src/lib/game-guardrails";

export async function expectGameEntrySurface(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.entrySurface)).toBeVisible();
}

export async function expectGameReady(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.readyMarker)).toBeVisible({
    timeout: GAME_GUARDRAIL_THRESHOLDS.firstSessionReadyMs,
  });
}

export async function expectGameReadyFromNavigationStart(page: Page, navigationStartedAtMs: number): Promise<void> {
  const elapsedMs = Date.now() - navigationStartedAtMs;
  expect(elapsedMs).toBeLessThanOrEqual(GAME_GUARDRAIL_THRESHOLDS.firstSessionReadyMs);

  const remainingMs = Math.max(GAME_GUARDRAIL_THRESHOLDS.firstSessionReadyMs - elapsedMs, 1);

  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.readyMarker)).toBeVisible({
    timeout: remainingMs,
  });
}

export async function expectInputResponseMarker(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.inputResponseMarker)).toBeVisible();
}

export async function expectInputResponseText(page: Page, expectedText: string): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.inputResponseMarker)).toHaveText(expectedText, {
    timeout: GAME_GUARDRAIL_THRESHOLDS.inputResponseMs,
  });
}

export async function pressAndExpectInputResponse(page: Page, key: string, expectedText: string): Promise<void> {
  const inputStartedAtMs = Date.now();

  await page.keyboard.press(key);

  const elapsedMs = Date.now() - inputStartedAtMs;
  expect(elapsedMs).toBeLessThanOrEqual(GAME_GUARDRAIL_THRESHOLDS.inputResponseMs);

  const remainingMs = Math.max(GAME_GUARDRAIL_THRESHOLDS.inputResponseMs - elapsedMs, 1);
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.inputResponseMarker)).toHaveText(expectedText, {
    timeout: remainingMs,
  });
}

export async function expectPlayerAt(page: Page, row: number, col: number): Promise<void> {
  const player = page.getByTestId(GAME_GUARDRAIL_TEST_IDS.player);

  await expect(player).toHaveAttribute("data-row", String(row));
  await expect(player).toHaveAttribute("data-col", String(col));
}

export async function expectAttemptCounterAtTarget(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.attemptCounter)).toHaveText(
    String(GAME_GUARDRAIL_THRESHOLDS.replayAttemptTarget),
  );
}

export async function expectAttemptCounter(page: Page, expectedCount: number): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.attemptCounter)).toHaveText(String(expectedCount));
}

export async function expectSessionAttemptCount(page: Page, expectedCount: number): Promise<void> {
  await expect
    .poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), GAME_ATTEMPT_SESSION_KEY))
    .toBe(String(expectedCount));
}

export async function expectGemsRemaining(page: Page, expectedCount: number): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.gemsRemaining)).toHaveText(
    String(expectedCount).padStart(2, "0"),
  );
}

export async function expectScore(page: Page, expectedScore: number): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.score)).toHaveText(String(expectedScore));
}

export async function expectCollectedGems(page: Page, expectedCount: number): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.collectedGems)).toHaveText(String(expectedCount));
}
