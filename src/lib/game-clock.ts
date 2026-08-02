/**
 * The game's only source of elapsed time.
 *
 * Gameplay reads time from a `GameClock` rather than from ad-hoc timers, so a browser test can
 * swap in a manual clock and step time by an exact number of milliseconds instead of sleeping.
 * `now()` is milliseconds since the clock was created, not a wall-clock epoch.
 */

/** The two tunable gravity constants. Declared here and nowhere else. */
export const GAME_TIMING = {
  boulderGraceWindowMs: 400,
  boulderFallIntervalMs: 120,
} as const;

export type GameClockTickHandler = (nowMs: number) => void;

export interface GameClock {
  now(): number;
  subscribe(onTick: GameClockTickHandler): () => void;
}

export interface ManualGameClock extends GameClock {
  advance(deltaMs: number): void;
}

export const MANUAL_CLOCK_WINDOW_KEY = "__boulderGameClock";
export const MANUAL_CLOCK_QUERY_PARAM = "clock";
export const MANUAL_CLOCK_QUERY_VALUE = "manual";

function notify(subscribers: Set<GameClockTickHandler>, nowMs: number): void {
  // Iterate a copy so a handler that unsubscribes mid-tick cannot corrupt the iteration.
  for (const onTick of [...subscribers]) {
    onTick(nowMs);
  }
}

export function createFrameGameClock(): GameClock {
  const originMs = performance.now();
  const subscribers = new Set<GameClockTickHandler>();
  let frameHandle: number | null = null;

  function now(): number {
    return performance.now() - originMs;
  }

  function runFrame(): void {
    frameHandle = null;
    if (subscribers.size === 0) {
      return;
    }

    notify(subscribers, now());
    scheduleFrame();
  }

  function scheduleFrame(): void {
    if (frameHandle !== null || subscribers.size === 0) {
      return;
    }

    frameHandle = requestAnimationFrame(runFrame);
  }

  return {
    now,
    subscribe(onTick) {
      subscribers.add(onTick);
      scheduleFrame();

      return () => {
        subscribers.delete(onTick);
        if (subscribers.size === 0 && frameHandle !== null) {
          cancelAnimationFrame(frameHandle);
          frameHandle = null;
        }
      };
    },
  };
}

export function createManualGameClock(startMs = 0): ManualGameClock {
  const subscribers = new Set<GameClockTickHandler>();
  let currentMs = startMs;

  return {
    now() {
      return currentMs;
    },
    subscribe(onTick) {
      subscribers.add(onTick);

      return () => {
        subscribers.delete(onTick);
      };
    },
    advance(deltaMs) {
      if (!(deltaMs > 0)) {
        return;
      }

      currentMs += deltaMs;
      notify(subscribers, currentMs);
    },
  };
}

function isManualClockRequested(search: string): boolean {
  return new URLSearchParams(search).get(MANUAL_CLOCK_QUERY_PARAM) === MANUAL_CLOCK_QUERY_VALUE;
}

/**
 * Picks the clock the current page should run on. `?clock=manual` yields a manual clock published
 * on `window` for tests to drive; anything else yields the animation-frame clock players get.
 * Must be called from the client (an effect), never during render — it reads and writes `window`.
 */
export function resolveGameClock(search?: string): GameClock {
  if (typeof window === "undefined") {
    return createManualGameClock();
  }

  if (!isManualClockRequested(search ?? window.location.search)) {
    return createFrameGameClock();
  }

  const manualClock = createManualGameClock();
  window[MANUAL_CLOCK_WINDOW_KEY] = manualClock;

  return manualClock;
}
