import { expect, type Page } from "@playwright/test";

import { GAME_GUARDRAIL_TEST_IDS, GAME_GUARDRAIL_THRESHOLDS } from "../../src/lib/game-guardrails";

export async function expectGameReady(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.readyMarker)).toBeVisible({
    timeout: GAME_GUARDRAIL_THRESHOLDS.firstSessionReadyMs,
  });
}

export async function expectInputResponseMarker(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.inputResponseMarker)).toBeVisible({
    timeout: GAME_GUARDRAIL_THRESHOLDS.inputResponseMs,
  });
}

export async function expectAttemptCounterAtTarget(page: Page): Promise<void> {
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.attemptCounter)).toHaveText(
    String(GAME_GUARDRAIL_THRESHOLDS.replayAttemptTarget),
  );
}
