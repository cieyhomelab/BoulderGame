import { expect, type Page } from "@playwright/test";

import { MANUAL_CLOCK_WINDOW_KEY } from "../../src/lib/game-clock";
import {
  GAME_ATTEMPT_SESSION_KEY,
  GAME_GUARDRAIL_TEST_IDS,
  GAME_GUARDRAIL_THRESHOLDS,
} from "../../src/lib/game-guardrails";
import { GAME_HIGH_SCORE_KEY } from "../../src/lib/game-score";

/**
 * Waits until the game island has hydrated. The attempt counter renders as `-` on the server and
 * only becomes a number once the mount effect runs, so it is the cheapest available proof that
 * client-side code — including clock resolution — has actually executed.
 */
export async function expectGameHydrated(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.attemptCounter)).toHaveText(/^\d+$/);
}

/**
 * Steps game time forward deterministically. Requires the page to have been opened with
 * `?clock=manual`, otherwise the manual clock is absent and this throws rather than silently
 * passing on a page where nothing can move.
 */
export async function advanceGameClock(page: Page, deltaMs: number): Promise<void> {
  await page.evaluate(
    ({ key, delta }) => {
      const clock = window[key as typeof MANUAL_CLOCK_WINDOW_KEY];
      if (!clock) {
        throw new Error("Manual game clock is not installed — open the page with `?clock=manual`.");
      }

      clock.advance(delta);
    },
    { key: MANUAL_CLOCK_WINDOW_KEY, delta: deltaMs },
  );
}

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

export async function expectPlayerRemainsAtAfterInput(
  page: Page,
  key: string,
  row: number,
  col: number,
): Promise<void> {
  await page.keyboard.press(key);
  await expectPlayerAt(page, row, col);
}

export async function expectHazardAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.hazard}"][data-row="${row}"][data-col="${col}"]`),
  ).toBeVisible();
}

export async function expectOpenSpaceAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.openSpace}"][data-row="${row}"][data-col="${col}"]`),
  ).toBeVisible();
}

export async function expectDirtAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.dirt}"][data-row="${row}"][data-col="${col}"]`),
  ).toBeVisible();
}

export async function expectBoulderAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.boulder}"][data-row="${row}"][data-col="${col}"]`),
  ).toBeVisible();
}

export async function expectUnstableBoulderAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.unstableBoulder}"][data-row="${row}"][data-col="${col}"]`),
  ).toBeVisible();
}

export async function expectNoBoulderAt(page: Page, row: number, col: number): Promise<void> {
  const boulderIds = [GAME_GUARDRAIL_TEST_IDS.boulder, GAME_GUARDRAIL_TEST_IDS.unstableBoulder];
  const selector = boulderIds.map((id) => `[data-testid="${id}"][data-row="${row}"][data-col="${col}"]`).join(", ");

  await expect(page.locator(selector)).toHaveCount(0);
}

export async function expectExitAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.exit}"][data-row="${row}"][data-col="${col}"]`),
  ).toBeVisible();
}

/**
 * The exit's two looks. The difference is entirely inside the tile's SVG, so the assertion reads
 * the `data-exit-locked` attribute the board publishes rather than the art itself.
 */
export async function expectExitSealedAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.exit}"][data-row="${row}"][data-col="${col}"]`),
  ).toHaveAttribute("data-exit-locked", "true");
}

export async function expectExitOpenAt(page: Page, row: number, col: number): Promise<void> {
  await expect(
    page.locator(`[data-testid="${GAME_GUARDRAIL_TEST_IDS.exit}"][data-row="${row}"][data-col="${col}"]`),
  ).toHaveAttribute("data-exit-locked", "false");
}

export async function expectReplayButtonVisible(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.replayButton)).toBeVisible();
}

export async function expectReplayButtonInViewport(page: Page): Promise<void> {
  const replayButton = page.getByTestId(GAME_GUARDRAIL_TEST_IDS.replayButton);

  await expect(replayButton).toBeVisible();
  await expect
    .poll(() =>
      replayButton.evaluate((button) => {
        const rect = button.getBoundingClientRect();

        return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
      }),
    )
    .toBe(true);
}

export async function expectReplayButtonHidden(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.replayButton)).toHaveCount(0);
}

export async function expectOutcomeMessage(page: Page, expectedText: RegExp | string): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.outcomeMessage)).toHaveText(expectedText);
}

export async function activateReplay(page: Page): Promise<void> {
  await page.getByTestId(GAME_GUARDRAIL_TEST_IDS.replayButton).click();
}

export async function expectNextLevelButtonVisible(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.nextLevelButton)).toBeVisible();
}

export async function expectNextLevelButtonHidden(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.nextLevelButton)).toHaveCount(0);
}

export async function activateNextLevel(page: Page): Promise<void> {
  await page.getByTestId(GAME_GUARDRAIL_TEST_IDS.nextLevelButton).click();
}

export async function expectLevelName(page: Page, expectedName: string): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.readyMarker)).toContainText(expectedName);
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

export async function expectGemQuota(page: Page, expectedText: string): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.gemQuota)).toHaveText(expectedText);
}

export async function expectBonusGems(page: Page, expectedText: string): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.bonusGems)).toHaveText(expectedText);
}

export async function expectScore(page: Page, expectedScore: number): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.score)).toHaveText(String(expectedScore));
}

/**
 * The score as the HUD currently shows it. Read rather than asserted, so a test can carry the total
 * a searched route happens to earn across a cave boundary instead of hard-coding a gem count that
 * goes stale the moment the route changes.
 */
export async function readScore(page: Page): Promise<number> {
  const scoreText = await page.getByTestId(GAME_GUARDRAIL_TEST_IDS.score).textContent();

  return Number(scoreText);
}

/** Gems collected in the cave being played, which the running total is built from. */
export async function readCollectedGems(page: Page): Promise<number> {
  const collectedText = await page.getByTestId(GAME_GUARDRAIL_TEST_IDS.collectedGems).textContent();

  return Number(collectedText);
}

export async function expectHighScore(page: Page, expectedHighScore: number): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.highScore)).toHaveText(String(expectedHighScore));
}

export async function expectStoredHighScore(page: Page, expectedHighScore: number): Promise<void> {
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), GAME_HIGH_SCORE_KEY))
    .toBe(String(expectedHighScore));
}

export async function expectCollectedGems(page: Page, expectedCount: number): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.collectedGems)).toHaveText(String(expectedCount));
}

export async function expectLevelStatus(page: Page, expectedStatus: "active" | "lost" | "won"): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.levelStatus)).toHaveText(expectedStatus.toUpperCase());
}
