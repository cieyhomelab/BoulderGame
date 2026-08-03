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

export type RollDirection = -1 | 1;

/**
 * A supported boulder still slides sideways when a whole flank is open: the tile beside it AND the
 * diagonal below that tile. Left wins when both flanks qualify, so the cave stays deterministic
 * for the solver. Which side rolls is a property of the board alone — outside the cave reads as
 * `undefined`, never `" "`, so a border boulder cannot roll out of the grid.
 */
export function rollDirection(board: Board, row: number, col: number): RollDirection | null {
  for (const side of [-1, 1] as const) {
    if (tileAt(board, row, col + side) === " " && tileAt(board, row + 1, col + side) === " ") {
      return side;
    }
  }

  return null;
}

/** A boulder at rest: supported from below and with no open flank to slide into. */
export function isSettled(board: Board, row: number, col: number): boolean {
  return isSupported(board, row, col) && rollDirection(board, row, col) === null;
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
 * Rebuilds the motion record from the board: every unsettled boulder (falling or about to roll)
 * has an entry, every settled one has none, and an entry whose boulder has moved on simply is not
 * rebuilt. Returns the same reference when nothing changed, so an idle tick cannot trigger a
 * re-render.
 */
function syncMotions(board: Board, boulderMotions: BoulderMotions, nowMs: number): BoulderMotions {
  const next = new Map<string, BoulderMotion>();
  let changed = false;

  for (const { row, col } of bouldersBottomUp(board)) {
    if (isSettled(board, row, col)) {
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

/**
 * The earliest-due unsettled boulder, bottom-up on ties. Due-time order, not board order: a roll's
 * direction depends on what its neighbours have already done, so draining a lower boulder's whole
 * fall before an earlier-due roll would make one large clock jump resolve differently from the
 * same interval delivered as many small frames.
 */
function findDueBoulder(board: Board, boulderMotions: BoulderMotions, nowMs: number): DueBoulder | null {
  let earliest: DueBoulder | null = null;

  for (const { row, col } of bouldersBottomUp(board)) {
    const motion = boulderMotions.get(motionKey(row, col));
    if (motion && nowMs >= motion.dueAtMs && !isSettled(board, row, col)) {
      if (!earliest || motion.dueAtMs < earliest.motion.dueAtMs) {
        earliest = { row, col, motion };
      }
    }
  }

  return earliest;
}

interface AppliedMove {
  board: Board;
  boulderMotions: BoulderMotions;
  movedInto: Coordinate;
  /** When the move actually happened — not when it was noticed. */
  atMs: number;
}

/**
 * Moves the bottom-most due boulder one tile: straight down when unsupported, otherwise sideways
 * into its open flank. Returns `null` when nothing is due.
 */
function applyNextDueMove(board: Board, boulderMotions: BoulderMotions, nowMs: number): AppliedMove | null {
  const due = findDueBoulder(board, boulderMotions, nowMs);
  if (!due) {
    return null;
  }

  // `findDueBoulder` only returns unsettled boulders, so a supported one must have an open flank.
  const target: Coordinate = !isSupported(board, due.row, due.col)
    ? { row: due.row + 1, col: due.col }
    : { row: due.row, col: due.col + (rollDirection(board, due.row, due.col) ?? 0) };
  const nextBoard = withTile(withTile(board, due.row, due.col, " "), target.row, target.col, "r");

  const nextMotions = new Map(boulderMotions);
  nextMotions.delete(motionKey(due.row, due.col));
  nextMotions.set(motionKey(target.row, target.col), {
    phase: "falling",
    // Advance from the due time, not from `nowMs`, so one large clock jump resolves to the same
    // number of tiles as many small ones would.
    dueAtMs: due.motion.dueAtMs + GAME_TIMING.boulderFallIntervalMs,
  });

  return {
    board: nextBoard,
    boulderMotions: nextMotions,
    movedInto: target,
    atMs: due.motion.dueAtMs,
  };
}

/**
 * Resolves the cave's gravity rule up to `nowMs`: registers newly unsettled boulders, then
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
    // Sync at the time the move happened, not at `nowMs`. A boulder that just lost its support
    // starts its grace window *then* — otherwise one large clock jump would resolve a chain
    // reaction differently from the same interval delivered as many small frames.
    boulderMotions = syncMotions(board, moved.boulderMotions, moved.atMs);
  }

  return { board, boulderMotions, landedOn };
}
