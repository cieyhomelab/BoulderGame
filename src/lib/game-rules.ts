import {
  NO_BOULDER_MOTIONS,
  motionKey,
  stepSimulation,
  tileAt,
  withTile,
  type Board,
  type BoulderMotions,
  type Coordinate,
} from "@/lib/boulder-simulation";
import { createTreasurerState, releaseTreasurer, stepTreasurer, type TreasurerState } from "@/lib/treasurer";
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

/** Why the level was lost. The status set stays `active | lost | won`; being crushed or caught is
 * a new cause of the existing losing status, not a new status value. */
export type LossCause = "spikes" | "crushed" | "treasurer";

export interface GameState {
  /** The level being played. Held in state rather than module scope so the keyboard handler's
   * functional update reads the active level instead of a stale closure over the first one. */
  level: ParsedLevel;
  board: Board;
  boulderMotions: BoulderMotions;
  playerPosition: Coordinate;
  /** The Skarbek, or `null` in a cave that has none — and in the solver, which searches without
   * him on purpose. See `level-solver.ts`. */
  treasurer: TreasurerState | null;
  moveCount: number;
  collectedGemCount: number;
  /** Cumulative count of boulders that have finished a fall this attempt. A counter rather than a
   * per-step event list so a driver can detect landings by comparing against the previous state. */
  boulderLandingCount: number;
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

/**
 * Whether the exit is passable. It is barred until the quota is met, so unlike every other tile
 * its walkability depends on the run rather than on the board — which is why `isWalkable` cannot
 * answer for it alone. The renderer asks the same question to decide whether to draw the bars.
 */
export function isExitOpen(level: ParsedLevel, collectedGemCount: number): boolean {
  return collectedGemCount >= level.definition.requiredGemCount;
}

export interface InitialStateOptions {
  /**
   * Whether the cave's Skarbek is present. Only the solver passes `false`, and only because a
   * walker with a step always pending has no settled state to search — see `level-solver.ts`.
   */
  includeTreasurer?: boolean;
}

export function createInitialGameState(level: ParsedLevel, options: InitialStateOptions = {}): GameState {
  const includeTreasurer = options.includeTreasurer ?? true;

  return {
    level,
    // Row-level copy: a shallow copy of the outer array alone would let a dug corridor leak
    // from one attempt into the next.
    board: level.template.map((row) => [...row]),
    boulderMotions: NO_BOULDER_MOTIONS,
    playerPosition: level.playerStart,
    treasurer: includeTreasurer && level.treasurerStart !== null ? createTreasurerState(level.treasurerStart) : null,
    moveCount: 0,
    collectedGemCount: 0,
    boulderLandingCount: 0,
    status: "active",
    lossCause: null,
  };
}

/**
 * Runs everything the cave does on its own against the current state — gravity, then the Skarbek's
 * walk. Returns the same state object when the step changed nothing, so the animation-frame
 * subscription cannot re-render an idle board.
 *
 * Gravity outlives the level. A boulder left in mid-air when the level ended — the one stacked on
 * top of the boulder that crushed the Miner, most visibly — still finishes its fall, so the cave
 * comes to rest rather than freezing mid-collapse.
 */
export function applySimulation(currentState: GameState, nowMs: number): GameState {
  const result = stepSimulation({ board: currentState.board, boulderMotions: currentState.boulderMotions }, nowMs);

  // He walks the board the boulders have just left behind, not the one they started on — a tunnel
  // a falling boulder plugged this very step is closed to him.
  //
  // Unlike gravity, the hunt does not outlive the level. A fall already under way finishes because
  // the cave must come to rest; a spirit stalking a cave with nobody left in it is only noise.
  const treasurer =
    currentState.treasurer && currentState.status === "active"
      ? stepTreasurer(result.board, currentState.treasurer, currentState.playerPosition, nowMs)
      : currentState.treasurer;

  if (
    result.board === currentState.board &&
    result.boulderMotions === currentState.boulderMotions &&
    treasurer === currentState.treasurer
  ) {
    return currentState;
  }

  // A boulder that moved into the Miner's tile crushes them. Compared against the position in the
  // state the step was applied to, so a boulder dropping into a tile the Miner just left is safe.
  // Only while the level is still running: an outcome is final, so a later boulder must not turn a
  // win into a loss, nor relabel a spike death as a crush.
  const crushed =
    currentState.status === "active" &&
    result.landedOn.some((coordinate) => isSameCoordinate(coordinate, currentState.playerPosition));

  // The Skarbek kills by touch, so reaching the Miner's tile is the whole of it. A boulder in the
  // same step takes the attribution: gravity resolved first, and a cause is never relabelled.
  const caught =
    currentState.status === "active" &&
    !crushed &&
    treasurer !== null &&
    treasurer.released &&
    isSameCoordinate(treasurer.position, currentState.playerPosition);

  // `landedOn` records every one-tile step of a fall; a landing is the step after which the
  // boulder is still there and no longer in motion.
  const settledBoulderCount = result.landedOn.filter(
    (coordinate) =>
      tileAt(result.board, coordinate.row, coordinate.col) === "r" &&
      !result.boulderMotions.has(motionKey(coordinate.row, coordinate.col)),
  ).length;

  return {
    ...currentState,
    board: result.board,
    boulderMotions: result.boulderMotions,
    treasurer,
    boulderLandingCount: currentState.boulderLandingCount + settledBoulderCount,
    status: crushed || caught ? "lost" : currentState.status,
    lossCause: crushed ? "crushed" : caught ? "treasurer" : currentState.lossCause,
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

  // The bars are not decoration: one gem short of the quota, the exit refuses the Miner the same
  // way a wall does. Rejected rather than accepted-and-ignored, so the move does not burn a step.
  if (nextTile === "e" && !isExitOpen(currentState.level, currentState.collectedGemCount)) {
    return { state: currentState, accepted: false };
  }

  // Walking into the Skarbek is as fatal as being walked into: he is drawn on open space, so the
  // tile itself never refuses the step. A dormant one is just a hollow in the rock — the legend
  // only turns on the miner who has already taken a gem out of his cave.
  const walkedIntoTreasurer =
    currentState.treasurer !== null &&
    currentState.treasurer.released &&
    isSameCoordinate(currentState.treasurer.position, nextPosition);

  const collectedGemCount = currentState.collectedGemCount + (nextTile === "g" ? 1 : 0);
  const board = isDiggable(nextTile)
    ? withTile(currentState.board, nextPosition.row, nextPosition.col, " ")
    : currentState.board;
  // Reaching the exit tile at all now means the quota was already met — the gate above is what
  // proves it, so the win no longer re-checks the count.
  const status = walkedIntoTreasurer || nextTile === "h" ? "lost" : nextTile === "e" ? "won" : "active";

  // The first gem out of the cave is what looses him. Read from the count before this move, so a
  // Miner who takes a second gem does not release a second time and reset his cadence.
  const treasurer =
    currentState.treasurer !== null && nextTile === "g" && currentState.collectedGemCount === 0
      ? releaseTreasurer(currentState.treasurer, nowMs)
      : currentState.treasurer;

  const movedState: GameState = {
    ...currentState,
    board,
    playerPosition: nextPosition,
    treasurer,
    moveCount: currentState.moveCount + 1,
    collectedGemCount,
    status,
    lossCause: walkedIntoTreasurer ? "treasurer" : status === "lost" ? "spikes" : currentState.lossCause,
  };

  // The cave re-evaluates support after every board change, so digging registers instability in
  // the same update that produced the hole rather than a frame later.
  return { accepted: true, state: applySimulation(movedState, nowMs) };
}
