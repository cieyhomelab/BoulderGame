import { isSettled, tileAt, type Board, type Coordinate } from "@/lib/boulder-simulation";
import { parseLevel, type LevelDefinition } from "@/lib/levels";
import { solveLevel } from "@/lib/level-solver";

/**
 * The design rules every cave must satisfy, in one place so the CLI and the test suite cannot
 * drift apart. `level-invariants.spec.ts` asserts these; `scripts/level-check.mjs` prints them.
 *
 * A failing check names what is wrong and where, because the audience is someone in the middle of
 * authoring a cave who needs to know which row to edit.
 */

const WALKABLE = new Set([".", " ", "g", "e", "h"]);

export interface LevelCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface LevelAudit {
  id: string;
  name: string;
  ok: boolean;
  checks: LevelCheck[];
}

function tilesMatching(definition: LevelDefinition, tile: string): Coordinate[] {
  return definition.rows.flatMap((row, rowIndex) =>
    row.split("").flatMap((cell, colIndex) => (cell === tile ? [{ row: rowIndex, col: colIndex }] : [])),
  );
}

function formatCoordinates(coordinates: Coordinate[]): string {
  return coordinates.map(({ row, col }) => `(${row},${col})`).join(" ");
}

/** Tiles that can become open space during a walk that never moves a boulder: already open, or
 * diggable by the Miner passing through. */
const OPENABLE = new Set([".", "g", " "]);

/**
 * Tiles the Miner can reach without ever disturbing a boulder. A boulder blocks, and so does the
 * tile directly beneath one: stepping into it is what digs the support away. A boulder also rolls
 * once a whole flank (side cell plus the diagonal below it) is open, so when both halves of a
 * flank could open during the walk, its diggable halves are off-limits too — walking through an
 * already-open half is safe, since it changes nothing.
 */
function reachableWithoutDisturbingBoulders(board: Board, start: Coordinate): Set<string> {
  const boulders = board.flatMap((row, rowIndex) =>
    row.flatMap((tile, colIndex) => (tile === "r" ? [{ row: rowIndex, col: colIndex }] : [])),
  );
  const supports = new Set(boulders.map(({ row, col }) => `${row + 1}:${col}`));

  for (const { row, col } of boulders) {
    for (const side of [-1, 1]) {
      const flank = [
        { row, col: col + side },
        { row: row + 1, col: col + side },
      ];
      const wholeFlankCanOpen = flank.every((cell) => {
        const tile = tileAt(board, cell.row, cell.col);
        return tile !== undefined && OPENABLE.has(tile);
      });

      if (wholeFlankCanOpen) {
        for (const cell of flank) {
          const tile = tileAt(board, cell.row, cell.col);
          if (tile === "." || tile === "g") {
            supports.add(`${cell.row}:${cell.col}`);
          }
        }
      }
    }
  }

  const seen = new Set([`${start.row}:${start.col}`]);
  const queue = [start];

  // The array iterator reads by index on each step, so tiles appended below are visited in turn —
  // this is the breadth-first walk, not a snapshot of the starting queue.
  for (const { row, col } of queue) {
    for (const [deltaRow, deltaCol] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nextRow = row + deltaRow;
      const nextCol = col + deltaCol;
      const key = `${nextRow}:${nextCol}`;
      // `tileAt` rather than `board[r][c]`: outside the cave must read as undefined, and
      // `noUncheckedIndexedAccess` is off in this project.
      const tile = tileAt(board, nextRow, nextCol);

      if (seen.has(key) || supports.has(key) || tile === undefined || !WALKABLE.has(tile)) {
        continue;
      }

      seen.add(key);
      // Spikes are lethal and the exit ends the level, so a route may end on either but never
      // continue through them. The exit is also barred below the quota, which this walk does not
      // track — treating it as a terminus keeps the heuristic from claiming a path the rules
      // would refuse.
      if (tile !== "h" && tile !== "e") {
        queue.push({ row: nextRow, col: nextCol });
      }
    }
  }

  return seen;
}

export function auditLevel(definition: LevelDefinition): LevelAudit {
  const level = parseLevel(definition);
  const rows = definition.rows;
  const players = tilesMatching(definition, "p");
  const exits = tilesMatching(definition, "e");
  const gems = tilesMatching(definition, "g");
  const boulders = tilesMatching(definition, "r");
  const hazards = tilesMatching(definition, "h");

  const checks: LevelCheck[] = [];

  const wrongWidth = rows.filter((row) => row.length !== 12);
  checks.push({
    name: "8 rows by 12 columns",
    ok: rows.length === 8 && wrongWidth.length === 0,
    detail: `${rows.length} rows, widths ${[...new Set(rows.map((row) => row.length))].join("/")}`,
  });

  const edges = [rows[0], rows[rows.length - 1], ...rows.map((row) => row[0] + row[row.length - 1])].join("");
  checks.push({
    name: "sealed by wall on every edge",
    ok: /^#+$/.test(edges),
    detail: /^#+$/.test(edges) ? "closed" : "a border tile is not a wall",
  });

  checks.push({
    name: "exactly one start and one exit",
    ok: players.length === 1 && exits.length === 1,
    detail: `${players.length} start, ${exits.length} exit`,
  });

  checks.push({
    name: "spikes present",
    ok: hazards.length > 0,
    detail: `${hazards.length} at ${formatCoordinates(hazards)}`,
  });

  checks.push({
    name: "gems cover the quota",
    ok: level.gemCount >= definition.requiredGemCount,
    detail: `${level.gemCount} gems, quota ${definition.requiredGemCount}, ${Math.max(level.gemCount - definition.requiredGemCount, 0)} bonus`,
  });

  // Settled, not just supported: a boulder with an open flank at t=0 rolls before the player has
  // made a move, which is exactly what this check exists to forbid.
  const unsettled = level.template.flatMap((row, rowIndex) =>
    row.flatMap((tile, colIndex) =>
      tile === "r" && !isSettled(level.template, rowIndex, colIndex) ? [{ row: rowIndex, col: colIndex }] : [],
    ),
  );
  checks.push({
    name: "every boulder rests at t=0",
    ok: unsettled.length === 0,
    detail:
      unsettled.length === 0
        ? `${boulders.length} boulders resting`
        : `falling or rolling: ${formatCoordinates(unsettled)}`,
  });

  // A boulder starting in the exit column is the obvious way to seal the exit from above. Rolling
  // means a boulder can wander into the column later too — that residual risk is the solver's to
  // catch, not this heuristic's.
  // `.at(0)` rather than `[0]`: a cave with no exit is a failure this audit must report, and with
  // `noUncheckedIndexedAccess` off only `.at` admits that the index can miss.
  const exit = exits.at(0);
  const bouldersOverExit = exit ? boulders.filter((boulder) => boulder.col === exit.col) : [];
  checks.push({
    name: "no boulder in the exit column",
    ok: bouldersOverExit.length === 0,
    detail: exit ? `exit at (${exit.row},${exit.col})` : "no exit to check",
  });

  const reachable = reachableWithoutDisturbingBoulders(level.template, level.playerStart);
  const safeGems = gems.filter((gem) => reachable.has(`${gem.row}:${gem.col}`));
  const exitReachable = exit ? reachable.has(`${exit.row}:${exit.col}`) : false;
  checks.push({
    name: "quota and exit reachable without touching a boulder",
    ok: safeGems.length >= definition.requiredGemCount && exitReachable,
    detail: `${safeGems.length} safe gems, exit ${exitReachable ? "reachable" : "unreachable"}`,
  });

  // The proof, as opposed to the heuristics above: search the real rules for a winning route.
  const solution = solveLevel(level);
  checks.push({
    name: "winnable",
    ok: solution.solved,
    detail: solution.solved
      ? `${solution.route.length} moves, ${solution.statesExplored} states${solution.disturbsBoulders ? "" : ", clock-independent"}`
      : solution.exhausted
        ? "no winning route exists"
        : `no route found within ${solution.statesExplored} states (budget)`,
  });

  return {
    id: definition.id,
    name: definition.name,
    ok: checks.every((check) => check.ok),
    checks,
  };
}
