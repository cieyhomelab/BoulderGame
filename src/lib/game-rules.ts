import {
  NO_BOULDER_MOTIONS,
  stepSimulation,
  tileAt,
  withTile,
  type Board,
  type BoulderMotions,
  type Coordinate,
} from "@/lib/boulder-simulation";
import type { ParsedLevel } from "@/lib/levels";

import type { Tile } from "@/components/game/TileArt";

/**
 * The cave's rules, independent of how they are driven. `GameEntry` drives them from a keyboard
 * and an animation frame; the level solver drives them from a search. Both must agree exactly,
 * which is why neither owns a private copy.
 *
 * Everything here is pure and takes `nowMs` as an argument, for the same reason `stepSimulation`
 * does: a rule that reads the clock itself cannot be replayed or searched.
 */

export type LevelStatus = "active" | "lost" | "won";

/** Why the level was lost. The status set stays `active | lost | won`; being crushed is a new
 * cause of the existing losing status, not a new status value. */
export type LossCause = "spikes" | "crushed";

export interface GameState {
  /** The level being played. Held in state rather than module scope so the keyboard handler's
   * functional update reads the active level instead of a stale closure over the first one. */
  level: ParsedLevel;
  board: Board;
  boulderMotions: BoulderMotions;
  playerPosition: Coordinate;
  moveCount: number;
  collectedGemCount: number;
  status: LevelStatus;
  lossCause: LossCause | null;
}

export interface MoveResult {
  state: GameState;
  accepted: boolean;
}

/** The four moves the cave allows. Key bindings are the caller's business, not the rules'. */
export const MOVE_DELTAS = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
} as const satisfies Record<string, Coordinate>;

export type MoveDirection = keyof typeof MOVE_DELTAS;

export function isSameCoordinate(a: Coordinate, b: Coordinate): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isWalkable(tile: Tile | undefined): boolean {
  return tile === "." || tile === " " || tile === "g" || tile === "e" || tile === "h";
}

export function isDiggable(tile: Tile | undefined): boolean {
  return tile === "." || tile === "g";
}

export function createInitialGameState(level: ParsedLevel): GameState {
  return {
    level,
    // Row-level copy: a shallow copy of the outer array alone would let a dug corridor leak
    // from one attempt into the next.
    board: level.template.map((row) => [...row]),
    boulderMotions: NO_BOULDER_MOTIONS,
    playerPosition: level.playerStart,
    moveCount: 0,
    collectedGemCount: 0,
    status: "active",
    lossCause: null,
  };
}

/**
 * Runs the cave's gravity rule against the current state. Returns the same state object when the
 * step changed nothing, so the animation-frame subscription cannot re-render an idle board.
 */
export function applySimulation(currentState: GameState, nowMs: number): GameState {
  if (currentState.status !== "active") {
    return currentState;
  }

  const result = stepSimulation({ board: currentState.board, boulderMotions: currentState.boulderMotions }, nowMs);

  if (result.board === currentState.board && result.boulderMotions === currentState.boulderMotions) {
    return currentState;
  }

  // A boulder that moved into the Miner's tile crushes them. Compared against the position in the
  // state the step was applied to, so a boulder dropping into a tile the Miner just left is safe.
  const crushed = result.landedOn.some((coordinate) => isSameCoordinate(coordinate, currentState.playerPosition));

  return {
    ...currentState,
    board: result.board,
    boulderMotions: result.boulderMotions,
    status: crushed ? "lost" : currentState.status,
    lossCause: crushed ? "crushed" : currentState.lossCause,
  };
}

export function resolveMove(currentState: GameState, delta: Coordinate, nowMs: number): MoveResult {
  if (currentState.status !== "active") {
    return { state: currentState, accepted: false };
  }

  const nextPosition = {
    row: currentState.playerPosition.row + delta.row,
    col: currentState.playerPosition.col + delta.col,
  };

  // Read the target before digging it — after the dig it is open space and the gem/spike
  // branches below would be lost.
  const nextTile = tileAt(currentState.board, nextPosition.row, nextPosition.col);
  if (!isWalkable(nextTile)) {
    return { state: currentState, accepted: false };
  }

  const collectedGemCount = currentState.collectedGemCount + (nextTile === "g" ? 1 : 0);
  const board = isDiggable(nextTile)
    ? withTile(currentState.board, nextPosition.row, nextPosition.col, " ")
    : currentState.board;
  const status =
    nextTile === "h"
      ? "lost"
      : nextTile === "e" && collectedGemCount >= currentState.level.definition.requiredGemCount
        ? "won"
        : "active";

  const movedState: GameState = {
    ...currentState,
    board,
    playerPosition: nextPosition,
    moveCount: currentState.moveCount + 1,
    collectedGemCount,
    status,
    lossCause: status === "lost" ? "spikes" : currentState.lossCause,
  };

  // The cave re-evaluates support after every board change, so digging registers instability in
  // the same update that produced the hole rather than a frame later.
  return { accepted: true, state: applySimulation(movedState, nowMs) };
}
