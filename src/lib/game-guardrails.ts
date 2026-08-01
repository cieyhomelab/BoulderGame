export const GAME_GUARDRAIL_THRESHOLDS = {
  firstSessionReadyMs: 3000,
  inputResponseMs: 100,
  replayAttemptTarget: 3,
} as const;

export const GAME_GUARDRAIL_TEST_IDS = {
  entrySurface: "game-entry-surface",
  readyMarker: "game-ready",
  inputResponseMarker: "game-input-response",
  attemptCounter: "game-attempt-counter",
} as const;

export const GAME_ATTEMPT_SESSION_KEY = "boulder-game:attempt-count";

export type GameGuardrailTestId = (typeof GAME_GUARDRAIL_TEST_IDS)[keyof typeof GAME_GUARDRAIL_TEST_IDS];

export interface GameAttemptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(storage?: GameAttemptStorage): GameAttemptStorage | null {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

export function readGameAttemptCount(storage?: GameAttemptStorage): number {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return 0;
  }

  const value = targetStorage.getItem(GAME_ATTEMPT_SESSION_KEY);
  const parsedValue = value === null ? 0 : Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

export function incrementGameAttemptCount(storage?: GameAttemptStorage): number {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return 0;
  }

  const nextCount = readGameAttemptCount(targetStorage) + 1;
  targetStorage.setItem(GAME_ATTEMPT_SESSION_KEY, String(nextCount));

  return nextCount;
}

export function resetGameAttemptCount(storage?: GameAttemptStorage): void {
  const targetStorage = resolveStorage(storage);
  targetStorage?.removeItem(GAME_ATTEMPT_SESSION_KEY);
}
