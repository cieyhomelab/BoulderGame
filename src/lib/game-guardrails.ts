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
  board: "game-board",
  player: "game-player",
  gemsRemaining: "game-gems-remaining",
  score: "game-score",
  collectedGems: "game-collected-gems",
  levelStatus: "game-level-status",
  hazard: "game-hazard",
  exit: "game-exit",
  replayButton: "game-replay-button",
  outcomeMessage: "game-outcome-message",
  gemQuota: "game-gem-quota",
  bonusGems: "game-bonus-gems",
  dirt: "game-dirt",
  openSpace: "game-open-space",
  boulder: "game-boulder",
  unstableBoulder: "game-unstable-boulder",
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

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readGameAttemptCount(storage?: GameAttemptStorage): number {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return 0;
  }

  try {
    const value = targetStorage.getItem(GAME_ATTEMPT_SESSION_KEY);
    const parsedValue = value === null ? 0 : Number.parseInt(value, 10);

    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
  } catch {
    return 0;
  }
}

export function incrementGameAttemptCount(storage?: GameAttemptStorage): number {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return 0;
  }

  try {
    const nextCount = readGameAttemptCount(targetStorage) + 1;
    targetStorage.setItem(GAME_ATTEMPT_SESSION_KEY, String(nextCount));

    return nextCount;
  } catch {
    return 0;
  }
}

export function resetGameAttemptCount(storage?: GameAttemptStorage): void {
  const targetStorage = resolveStorage(storage);
  try {
    targetStorage?.removeItem(GAME_ATTEMPT_SESSION_KEY);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}
