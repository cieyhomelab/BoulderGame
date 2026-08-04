/** Points awarded per gem, required and bonus alike. */
export const GEM_SCORE_VALUE = 100;

export const GAME_HIGH_SCORE_KEY = "boulder-game:high-score";

export interface GameScoreStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage rather than sessionStorage: the record outlives the tab and dies with the cache. */
function resolveStorage(storage?: GameScoreStorage): GameScoreStorage | null {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readHighScore(storage?: GameScoreStorage): number {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return 0;
  }

  try {
    const value = targetStorage.getItem(GAME_HIGH_SCORE_KEY);
    const parsedValue = value === null ? 0 : Number.parseInt(value, 10);

    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
  } catch {
    return 0;
  }
}

/** Writes only on a new record, and returns the record that stands afterwards. */
export function recordHighScore(score: number, storage?: GameScoreStorage): number {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) {
    return score;
  }

  try {
    const currentHighScore = readHighScore(targetStorage);
    if (score <= currentHighScore) {
      return currentHighScore;
    }

    targetStorage.setItem(GAME_HIGH_SCORE_KEY, String(score));

    return score;
  } catch {
    return score;
  }
}

export function resetHighScore(storage?: GameScoreStorage): void {
  const targetStorage = resolveStorage(storage);
  try {
    targetStorage?.removeItem(GAME_HIGH_SCORE_KEY);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}
