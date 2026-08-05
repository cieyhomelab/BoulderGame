import { GAME_TIMING } from "@/lib/game-clock";
import { tileAt, type Board, type Coordinate } from "@/lib/boulder-simulation";

/**
 * The Treasurer — Skarbek of the Polish mining legends, the spirit sealed into the rock who is
 * loosed the moment a miner takes the first gem out of his cave.
 *
 * Pure and time-injected for the same reason `stepSimulation` is: a walk that read the clock or
 * `Math.random()` itself could not be replayed, and every browser assertion about the chase would
 * be a coin flip. Randomness here comes from a seed carried in the state, so a given seed and a
 * given clock always produce the same walk — random to a player, reproducible to a test.
 *
 * He walks open space only. That is not a separate rule about where he is allowed to go: open
 * space is precisely what the Miner has dug, so the Skarbek can only ever travel the tunnels his
 * intruder cut for him. Sealed in a chamber nobody has broken into, he does not move at all.
 */

export interface TreasurerState {
  position: Coordinate;
  /** The tile he stepped out of, so the walk does not immediately double back on itself. */
  previousPosition: Coordinate | null;
  /** Deterministic PRNG state, advanced once per drawn step. */
  seed: number;
  /** He is sealed in the rock until the first gem leaves the cave. */
  released: boolean;
  /** When the next step is owed. Meaningless while dormant. */
  nextStepAtMs: number;
}

/**
 * Fixed rather than derived from the clock or `Math.random()`: the walk must be identical across
 * runs of the same cave, or the e2e suite could only ever assert that *something* moved.
 */
const INITIAL_TREASURER_SEED = 0x2545f491;

/**
 * A drain pass cannot legitimately need more iterations than this; the cap turns a logic error
 * into a dropped frame rather than a hung tab. Mirrors `MAX_DRAIN_ITERATIONS`.
 */
const MAX_DRAIN_ITERATIONS = 256;

const WALK_DELTAS: readonly Coordinate[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function createTreasurerState(start: Coordinate): TreasurerState {
  return {
    position: start,
    previousPosition: null,
    seed: INITIAL_TREASURER_SEED,
    released: false,
    nextStepAtMs: 0,
  };
}

/**
 * Looses the Skarbek. The first step is owed one full interval later rather than immediately, so
 * taking a gem beside him is a warning rather than an ambush.
 */
export function releaseTreasurer(treasurer: TreasurerState, nowMs: number): TreasurerState {
  if (treasurer.released) {
    return treasurer;
  }

  return { ...treasurer, released: true, nextStepAtMs: nowMs + GAME_TIMING.treasurerStepIntervalMs };
}

/** A linear congruential step. `imul` rather than `*`, so the multiply wraps at 32 bits instead
 * of losing the low digits to a float. */
function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

/** An index drawn from the seed's high bits — an LCG's low bits are too regular to draw from. */
function drawIndex(seed: number, length: number): number {
  return Math.min(Math.floor((seed / 0x1_0000_0000) * length), length - 1);
}

/**
 * The tunnels open to him from a tile: dug space and nothing else. Dirt, gems, boulders, spikes
 * and the exit all read as rock to the Skarbek, and outside the cave reads as `undefined` rather
 * than open space, so the border alone keeps him in.
 */
function openNeighbours(board: Board, position: Coordinate): Coordinate[] {
  return WALK_DELTAS.map((delta) => ({ row: position.row + delta.row, col: position.col + delta.col })).filter(
    (candidate) => tileAt(board, candidate.row, candidate.col) === " ",
  );
}

function isSamePosition(a: Coordinate, b: Coordinate | null): boolean {
  return b !== null && a.row === b.row && a.col === b.col;
}

/**
 * Walks the Skarbek forward to `nowMs`, one tile per interval, and stops the moment he reaches the
 * Miner. Truncating the drain there is what keeps a large clock jump legible: without it he could
 * pass through the Miner and settle two tiles further on, and the board would show a death
 * happening somewhere the Skarbek is not.
 *
 * Returns the input reference when nothing changed, so an idle tick cannot force a re-render.
 */
export function stepTreasurer(
  board: Board,
  treasurer: TreasurerState,
  playerPosition: Coordinate,
  nowMs: number,
): TreasurerState {
  if (!treasurer.released) {
    return treasurer;
  }

  let current = treasurer;

  for (let iteration = 0; iteration < MAX_DRAIN_ITERATIONS; iteration += 1) {
    if (nowMs < current.nextStepAtMs || isSamePosition(current.position, playerPosition)) {
      break;
    }

    const candidates = openNeighbours(board, current.position);
    // Turning back is a last resort, not a forbidden move: in a dead-end stub the tile he came
    // from is the only tunnel there is, and a Skarbek who refused it would be stuck for good.
    const options = candidates.filter((candidate) => !isSamePosition(candidate, current.previousPosition));
    const walkable = options.length > 0 ? options : candidates;

    if (walkable.length === 0) {
      // Still sealed in: nothing adjacent has been dug yet. Rescheduled from now rather than left
      // owing, so a long wait cannot accrue a debt of steps he would take all at once the moment
      // the Miner breaks through. The board cannot change inside a drain, so there is no point
      // looking again this pass.
      return { ...current, nextStepAtMs: nowMs + GAME_TIMING.treasurerStepIntervalMs };
    }

    const seed = nextSeed(current.seed);
    current = {
      ...current,
      position: walkable[drawIndex(seed, walkable.length)],
      previousPosition: current.position,
      seed,
      // Advance from the due time, not from `nowMs`, so one large clock jump covers the same
      // number of tiles as the same interval delivered as many small frames.
      nextStepAtMs: current.nextStepAtMs + GAME_TIMING.treasurerStepIntervalMs,
    };
  }

  return current;
}
