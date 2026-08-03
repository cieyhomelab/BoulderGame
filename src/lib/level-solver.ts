import { tileAt, type Board, type Coordinate } from "@/lib/boulder-simulation";
import {
  MOVE_DELTAS,
  applySimulation,
  createInitialGameState,
  resolveMove,
  type GameState,
  type MoveDirection,
} from "@/lib/game-rules";
import type { ParsedLevel } from "@/lib/levels";

/**
 * Searches a level for a winning route, driving the real rules in `game-rules.ts` rather than a
 * second copy of them. What it proves is therefore what the game actually does.
 *
 * Time model: the Miner acts, then the cave is allowed to settle completely before the next move.
 * This is a deliberate restriction of the strategy space, and it is what makes the search finite —
 * a settled cave has no pending boulder motion, so the clock reading stops mattering and states
 * can be compared by board alone.
 *
 * The cost is real and worth stating: routes that depend on acting *during* a fall are outside
 * what this can find. cave-02's bonus gem is exactly such a trick — stepping aside inside the
 * grace window. `solveLevel` is an oracle for "can this cave be won", not for "is every trick in
 * it possible". The latter stays an e2e concern.
 */

/** A settle pass cannot legitimately need more rounds than this; the cap turns a logic error into
 * a reported failure rather than a hung search. Mirrors MAX_DRAIN_ITERATIONS in the simulation. */
const MAX_SETTLE_ROUNDS = 256;

const DEFAULT_MAX_STATES = 250_000;

export interface SolveOptions {
  /** Search budget. Hitting it reports `exhausted: false` rather than claiming unsolvability. */
  maxStates?: number;
}

export interface SolveResult {
  solved: boolean;
  /** The winning sequence of moves, shortest first by construction (breadth-first). */
  route: MoveDirection[];
  statesExplored: number;
  /** True when the whole reachable space was searched — so `solved: false` means truly unwinnable. */
  exhausted: boolean;
  /**
   * Whether the route ever leaves a boulder unsupported. A route that does not is independent of
   * the clock, which is what makes it safe to replay as an e2e key sequence: no wall-clock timing
   * can change its outcome.
   */
  disturbsBoulders: boolean;
}

interface SearchNode {
  state: GameState;
  nowMs: number;
  route: MoveDirection[];
  disturbed: boolean;
}

/**
 * Runs the cave forward until nothing is falling. Advances to the latest pending due time each
 * round; `stepSimulation` drains every move owed by then, so a boulder passing *through* the
 * Miner's tile during the jump is still recorded as a crush.
 */
function settle(state: GameState, nowMs: number): { state: GameState; nowMs: number; disturbed: boolean } {
  let current = state;
  let currentMs = nowMs;
  let disturbed = false;

  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    if (current.status !== "active" || current.boulderMotions.size === 0) {
      break;
    }

    disturbed = true;
    const latestDueMs = Math.max(...[...current.boulderMotions.values()].map((motion) => motion.dueAtMs));
    currentMs = Math.max(currentMs, latestDueMs);
    current = applySimulation(current, currentMs);
  }

  return { state: current, nowMs: currentMs, disturbed };
}

/** Tiles that can never become open space. Dirt and gems are diggable and a boulder can vacate
 * its cell, so everything else may open up at some point during play. */
const PERMANENT_BLOCKERS = new Set(["#", "h", "e"]);

/**
 * Every cell whose dirt/space distinction could ever influence a boulder, over-approximated once
 * per solve. Boulders fall down and roll sideways into an open flank, so their reachable
 * positions are the closure of the starting positions under those moves — computed against
 * "could this cell ever be open" rather than the current board, which makes the set a superset
 * for every reachable state. A boulder's stability reads its own cell, the cell below, both side
 * cells, and both lower diagonals, so the sensitive set is the closure dilated by those offsets.
 */
function boulderSensitiveCells(board: Board): Set<string> {
  const canOpen = (row: number, col: number): boolean => {
    const tile = tileAt(board, row, col);
    return tile !== undefined && !PERMANENT_BLOCKERS.has(tile);
  };

  const occupiable = new Set<string>();
  const queue: Coordinate[] = [];

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < board[rowIndex].length; colIndex += 1) {
      if (board[rowIndex][colIndex] === "r") {
        occupiable.add(`${rowIndex}:${colIndex}`);
        queue.push({ row: rowIndex, col: colIndex });
      }
    }
  }

  // Same breadth-first idiom as the audit's reachability walk: the iterator sees appended cells.
  for (const { row, col } of queue) {
    const moves: Coordinate[] = [];
    if (canOpen(row + 1, col)) {
      moves.push({ row: row + 1, col });
    }
    for (const side of [-1, 1]) {
      if (canOpen(row, col + side) && canOpen(row + 1, col + side)) {
        moves.push({ row, col: col + side });
      }
    }

    for (const next of moves) {
      const key = `${next.row}:${next.col}`;
      if (!occupiable.has(key)) {
        occupiable.add(key);
        queue.push(next);
      }
    }
  }

  const sensitive = new Set<string>();
  for (const key of occupiable) {
    const [row, col] = key.split(":").map(Number);
    sensitive.add(key);
    sensitive.add(`${row + 1}:${col}`);
    // A flank only matters when the whole flank can open: with one cell permanently blocked, the
    // roll check's answer for that side never depends on the other cell.
    for (const side of [-1, 1]) {
      if (canOpen(row, col + side) && canOpen(row + 1, col + side)) {
        sensitive.add(`${row}:${col + side}`);
        sensitive.add(`${row + 1}:${col + side}`);
      }
    }
  }

  return sensitive;
}

/**
 * Identity of a settled state. Two things are deliberately absent.
 *
 * The clock: with nothing in motion, states with the same board have identical futures.
 *
 * Most of the board: Dirt is walkable, so digging never opens a path the Miner did not already
 * have — it only matters where a boulder could read it as support or as an open flank. Outside
 * `boulderSensitive`, dirt and open space collapse to one symbol.
 *
 * Without this, each dug tile doubles the state space and the search drowns in routes that differ
 * only by which corridor the Miner scratched on the way.
 */
function stateKey(state: GameState, boulderSensitive: Set<string>): string {
  const canonical = state.board
    .map((row, rowIndex) =>
      row
        .map((tile, colIndex) => {
          if (tile !== "." && tile !== " ") {
            return tile;
          }

          return boulderSensitive.has(`${rowIndex}:${colIndex}`) ? tile : "_";
        })
        .join(""),
    )
    .join("/");

  return `${canonical}|${state.playerPosition.row},${state.playerPosition.col}|${state.collectedGemCount}`;
}

/**
 * With every boulder pinned in place, the only cells whose dirt/space state can matter are the
 * ones the pinned boulders themselves read: their support and both flanks. Everything else
 * collapses, which is what keeps the undisturbed search tiny.
 */
function pinnedBoulderCells(board: Board): Set<string> {
  const sensitive = new Set<string>();

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] !== "r") {
        continue;
      }

      sensitive.add(`${row + 1}:${col}`);
      for (const side of [-1, 1]) {
        sensitive.add(`${row}:${col + side}`);
        sensitive.add(`${row + 1}:${col + side}`);
      }
    }
  }

  return sensitive;
}

interface SearchOptions {
  maxStates: number;
  /** Reject any move that sets a boulder in motion. What makes the small `sensitive` set sound. */
  undisturbedOnly: boolean;
  sensitive: Set<string>;
}

function search(start: { state: GameState; nowMs: number; disturbed: boolean }, options: SearchOptions): SolveResult {
  const queue: SearchNode[] = [{ state: start.state, nowMs: start.nowMs, route: [], disturbed: start.disturbed }];
  const seen = new Set([stateKey(start.state, options.sensitive)]);
  let statesExplored = 0;

  for (const node of queue) {
    statesExplored += 1;
    if (statesExplored > options.maxStates) {
      return {
        solved: false,
        route: [],
        statesExplored: statesExplored - 1,
        exhausted: false,
        disturbsBoulders: false,
      };
    }

    for (const direction of Object.keys(MOVE_DELTAS) as MoveDirection[]) {
      const moved = resolveMove(node.state, MOVE_DELTAS[direction], node.nowMs);
      if (!moved.accepted) {
        continue;
      }

      const route = [...node.route, direction];
      const settled = settle(moved.state, node.nowMs);
      const disturbed = node.disturbed || settled.disturbed;

      if (options.undisturbedOnly && settled.disturbed) {
        continue;
      }

      if (settled.state.status === "won") {
        return { solved: true, route, statesExplored, exhausted: false, disturbsBoulders: disturbed };
      }

      // A lost branch is a real outcome, not a dead end to route around — it simply cannot be
      // extended, so it is dropped rather than queued.
      if (settled.state.status !== "active") {
        continue;
      }

      const key = stateKey(settled.state, options.sensitive);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      queue.push({ state: settled.state, nowMs: settled.nowMs, route, disturbed });
    }
  }

  return { solved: false, route: [], statesExplored, exhausted: true, disturbsBoulders: false };
}

/**
 * Two phases. First a search restricted to routes that never set a boulder in motion — with the
 * boulders pinned, almost the whole board canonicalizes and the search is cheap; a win here is
 * also clock-independent by construction. Only when no such route exists does the full search
 * run, with the closure-derived sensitive set that rolling boulders require. `exhausted` (and so
 * "no winning route exists") can only ever come from the full phase.
 */
export function solveLevel(level: ParsedLevel, options: SolveOptions = {}): SolveResult {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;

  const initial = createInitialGameState(level);
  // Derived from the pre-settle board: settling only moves boulders within their own closure, so
  // this set stays a superset of what any reachable state can need.
  const boulderSensitive = boulderSensitiveCells(initial.board);
  const start = settle(initial, 0);

  if (!start.disturbed) {
    const undisturbed = search(start, {
      maxStates,
      undisturbedOnly: true,
      sensitive: pinnedBoulderCells(start.state.board),
    });
    if (undisturbed.solved) {
      return undisturbed;
    }
  }

  return search(start, { maxStates, undisturbedOnly: false, sensitive: boulderSensitive });
}
