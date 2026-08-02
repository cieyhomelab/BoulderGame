import { GAME_TIMING } from "@/lib/game-clock";

import type { Tile } from "@/components/game/TileArt";

export type Board = Tile[][];

export interface Coordinate {
  row: number;
  col: number;
}

export type BoulderPhase = "grace" | "falling";

export interface BoulderMotion {
  phase: BoulderPhase;
  dueAtMs: number;
}

/** Keyed by `"row:col"` — the key travels with the boulder as it falls. */
export type BoulderMotions = ReadonlyMap<string, BoulderMotion>;

export const NO_BOULDER_MOTIONS: BoulderMotions = new Map<string, BoulderMotion>();

export interface SimulationInput {
  board: Board;
  boulderMotions: BoulderMotions;
}

export interface SimulationResult extends SimulationInput {
  /** Tiles a boulder moved *into* during this step. `S-03` reads this to detect a crush. */
  landedOn: Coordinate[];
}

/**
 * A drain pass cannot legitimately need more iterations than this; the cap turns a logic error
 * into a dropped frame rather than a hung tab.
 */
const MAX_DRAIN_ITERATIONS = 256;

export function motionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Reads a tile without trusting the index. `noUncheckedIndexedAccess` is off in this project, so
 * `board[row][col]` type-checks even outside the grid — `undefined` means "outside the cave".
 */
export function tileAt(board: Board, row: number, col: number): Tile | undefined {
  return board[row]?.[col];
}

/** Copies only the row being written, so unchanged rows stay shared between renders. */
export function withTile(board: Board, row: number, col: number, tile: Tile): Board {
  return board.map((boardRow, rowIndex) => {
    if (rowIndex !== row) {
      return boardRow;
    }

    const nextRow = [...boardRow];
    nextRow[col] = tile;

    return nextRow;
  });
}

/**
 * A boulder is supported by anything that is not open space. Outside the board counts as
 * supported — a boulder on the bottom row does not fall out of the cave. The Miner is not a
 * support: they stand in open space, so a boulder above them is unsupported and will fall.
 */
export function isSupported(board: Board, row: number, col: number): boolean {
  return tileAt(board, row + 1, col) !== " ";
}

/** Every boulder on the board, bottom row first. */
function bouldersBottomUp(board: Board): Coordinate[] {
  const boulders: Coordinate[] = [];

  // Bottom-up, so a boulder can move into the cell the boulder beneath it vacated in this pass.
  for (let row = board.length - 1; row >= 0; row -= 1) {
    const boardRow = board[row];
    for (let col = 0; col < boardRow.length; col += 1) {
      if (boardRow[col] === "r") {
        boulders.push({ row, col });
      }
    }
  }

  return boulders;
}

/**
 * Rebuilds the motion record from the board: every unsupported boulder has an entry, every
 * supported one has none, and an entry whose boulder has moved on simply is not rebuilt. Returns
 * the same reference when nothing changed, so an idle tick cannot trigger a re-render.
 */
function syncMotions(board: Board, boulderMotions: BoulderMotions, nowMs: number): BoulderMotions {
  const next = new Map<string, BoulderMotion>();
  let changed = false;

  for (const { row, col } of bouldersBottomUp(board)) {
    if (isSupported(board, row, col)) {
      continue;
    }

    const key = motionKey(row, col);
    const existing = boulderMotions.get(key);

    if (existing) {
      next.set(key, existing);
    } else {
      next.set(key, { phase: "grace", dueAtMs: nowMs + GAME_TIMING.boulderGraceWindowMs });
      changed = true;
    }
  }

  // A size mismatch means at least one prior entry was not rebuilt: its boulder regained support,
  // moved, or is gone.
  return changed || next.size !== boulderMotions.size ? next : boulderMotions;
}

interface DueBoulder extends Coordinate {
  motion: BoulderMotion;
}

function findDueBoulder(board: Board, boulderMotions: BoulderMotions, nowMs: number): DueBoulder | null {
  for (const { row, col } of bouldersBottomUp(board)) {
    const motion = boulderMotions.get(motionKey(row, col));
    if (motion && nowMs >= motion.dueAtMs && !isSupported(board, row, col)) {
      return { row, col, motion };
    }
  }

  return null;
}

/** Moves the bottom-most due boulder one tile down. Returns `null` when nothing is due. */
function applyNextDueMove(
  board: Board,
  boulderMotions: BoulderMotions,
  nowMs: number,
): { board: Board; boulderMotions: BoulderMotions; movedInto: Coordinate } | null {
  const due = findDueBoulder(board, boulderMotions, nowMs);
  if (!due) {
    return null;
  }

  const nextRow = due.row + 1;
  const nextBoard = withTile(withTile(board, due.row, due.col, " "), nextRow, due.col, "r");

  const nextMotions = new Map(boulderMotions);
  nextMotions.delete(motionKey(due.row, due.col));
  nextMotions.set(motionKey(nextRow, due.col), {
    phase: "falling",
    // Advance from the due time, not from `nowMs`, so one large clock jump resolves to the same
    // number of tiles as many small ones would.
    dueAtMs: due.motion.dueAtMs + GAME_TIMING.boulderFallIntervalMs,
  });

  return { board: nextBoard, boulderMotions: nextMotions, movedInto: { row: nextRow, col: due.col } };
}

/**
 * Resolves the cave's gravity rule up to `nowMs`: registers newly unsupported boulders, then
 * drains every transition already due, re-deriving support after each individual move so chain
 * reactions resolve within the same step.
 *
 * Returns the input's own `board` / `boulderMotions` references when nothing changed.
 */
export function stepSimulation(input: SimulationInput, nowMs: number): SimulationResult {
  let board = input.board;
  let boulderMotions = syncMotions(board, input.boulderMotions, nowMs);
  const landedOn: Coordinate[] = [];

  for (let iteration = 0; iteration < MAX_DRAIN_ITERATIONS; iteration += 1) {
    const moved = applyNextDueMove(board, boulderMotions, nowMs);
    if (!moved) {
      break;
    }

    board = moved.board;
    landedOn.push(moved.movedInto);
    boulderMotions = syncMotions(board, moved.boulderMotions, nowMs);
  }

  return { board, boulderMotions, landedOn };
}
