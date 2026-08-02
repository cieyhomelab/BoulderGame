import { expect, test, type Page } from "@playwright/test";

import { MANUAL_CLOCK_QUERY_PARAM, MANUAL_CLOCK_QUERY_VALUE, MANUAL_CLOCK_WINDOW_KEY } from "../../src/lib/game-clock";

import { advanceGameClock, expectGameHydrated } from "./guardrail-assertions";

const MANUAL_CLOCK_ROUTE = `/?${MANUAL_CLOCK_QUERY_PARAM}=${MANUAL_CLOCK_QUERY_VALUE}`;

type ManualClockWindowKey = typeof MANUAL_CLOCK_WINDOW_KEY;

async function currentClockNow(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const clock = window[key as ManualClockWindowKey];
    if (!clock) {
      throw new Error("Manual game clock is not installed on this page.");
    }

    return clock.now();
  }, MANUAL_CLOCK_WINDOW_KEY);
}

test("normal play does not expose the manual clock", async ({ page }) => {
  await page.goto("/");
  await expectGameHydrated(page);

  const hasManualClock = await page.evaluate(
    (key) => window[key as ManualClockWindowKey] !== undefined,
    MANUAL_CLOCK_WINDOW_KEY,
  );

  expect(hasManualClock).toBe(false);
});

test("the manual clock is installed and does not tick on its own", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await expect.poll(() => currentClockNow(page)).toBe(0);
  await expect.poll(() => currentClockNow(page)).toBe(0);
});

test("advancing the manual clock moves time by exactly the requested amount", async ({ page }) => {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  await advanceGameClock(page, 400);
  expect(await currentClockNow(page)).toBe(400);

  await advanceGameClock(page, 120);
  expect(await currentClockNow(page)).toBe(520);
});
