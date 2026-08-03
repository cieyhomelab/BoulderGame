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

/**
 * Identity of a settled state. Two things are deliberately absent.
 *
 * The clock: with nothing in motion, states with the same board have identical futures.
 *
 * Most of the board: Dirt is walkable, so digging never opens a path the Miner did not already
 * have — it only removes a boulder's support. Dirt and open space are therefore indistinguishable
 * except directly under something that can fall, and since boulders only ever move down their own
 * column, that means cells with a boulder somewhere above them in the same column. Every other
 * cell collapses to one symbol.
 *
 * Without this, each dug tile doubles the state space and the search drowns in routes that differ
 * only by which corridor the Miner scratched on the way.
 */
function stateKey(state: GameState): string {
  const board = state.board;
  // The topmost boulder in each column. Only cells below one can ever be asked to hold it up.
  const topBoulderRowByColumn = board[0].map((_, colIndex) => board.findIndex((row) => row[colIndex] === "r"));

  const canonical = board
    .map((row, rowIndex) =>
      row
        .map((tile, colIndex) => {
          if (tile !== "." && tile !== " ") {
            return tile;
          }

          const topBoulderRow = topBoulderRowByColumn[colIndex];

          return topBoulderRow !== -1 && rowIndex > topBoulderRow ? tile : "_";
        })
        .join(""),
    )
    .join("/");

  return `${canonical}|${state.playerPosition.row},${state.playerPosition.col}|${state.collectedGemCount}`;
}

export function solveLevel(level: ParsedLevel, options: SolveOptions = {}): SolveResult {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;

  const start = settle(createInitialGameState(level), 0);
  const queue: SearchNode[] = [{ state: start.state, nowMs: start.nowMs, route: [], disturbed: start.disturbed }];
  const seen = new Set([stateKey(start.state)]);
  let statesExplored = 0;

  for (const node of queue) {
    statesExplored += 1;
    if (statesExplored > maxStates) {
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

      if (settled.state.status === "won") {
        return { solved: true, route, statesExplored, exhausted: false, disturbsBoulders: disturbed };
      }

      // A lost branch is a real outcome, not a dead end to route around — it simply cannot be
      // extended, so it is dropped rather than queued.
      if (settled.state.status !== "active") {
        continue;
      }

      const key = stateKey(settled.state);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      queue.push({ state: settled.state, nowMs: settled.nowMs, route, disturbed });
    }
  }

  return { solved: false, route: [], statesExplored, exhausted: true, disturbsBoulders: false };
}
