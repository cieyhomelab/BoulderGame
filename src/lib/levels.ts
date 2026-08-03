import type { Board, Coordinate } from "@/lib/boulder-simulation";

import type { Tile } from "@/components/game/TileArt";

export interface LevelDefinition {
  id: string;
  /** Shown in the header. The pre-hydration fallback in `index.astro` mirrors the first level's. */
  name: string;
  rows: readonly string[];
  /** Gems the Miner must hold before the exit opens. The rest of the level's gems are bonus. */
  requiredGemCount: number;
}

export interface ParsedLevel {
  definition: LevelDefinition;
  template: Board;
  playerStart: Coordinate;
  gemCount: number;
}

/**
 * The cave, authored against the live simulation. `.` is Dirt (solid, diggable, holds boulders),
 * `" "` is carved open space, `p` is the Miner's start.
 *
 * Invariants any future edit must preserve:
 * - No boulder is unsupported at t=0 — nothing may fall before the player acts.
 * - No boulder sits in or above the exit's column, so the exit cannot be sealed.
 * - Spikes remain present.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder.
 * - The bonus gem at (1,9) is walled on every side but (1,8), which holds a boulder — it is
 *   obtainable only by deliberately undermining it (FR-011).
 * - The shaft at (3,8)/(4,8) gives the (1,8) boulder a three-tile fall, so the 120 ms cadence is
 *   observable; the stack at (1,4)/(2,4) produces the FR-009 chain reaction.
 *
 * The e2e suite asserts these coordinates directly — changing a row here breaks tests by design.
 */
const CAVE_01: LevelDefinition = {
  id: "cave-01",
  name: "Level 01",
  requiredGemCount: 2,
  rows: [
    "############",
    "#...r...rg##",
    "#...r....#.#",
    "# p..... #.#",
    "#.#...#. #.#",
    "#.#g.h#g...#",
    "#.........e#",
    "############",
  ],
};

/**
 * Play order. Levels advance by index, so the array order is the progression.
 *
 * Every level is 8 rows by 12 columns: the board's column count is a fixed `grid-cols-12` Tailwind
 * class in `GameEntry`, and Tailwind 4 cannot generate that class from runtime data. A level of a
 * different width needs an inline `gridTemplateColumns` there first.
 */
export const LEVELS: readonly LevelDefinition[] = [CAVE_01];

/**
 * Parses a level's rows. The `p` start marker is resolved away here — the Miner has by definition
 * already dug the tile they stand in, so the cell becomes open space and `p` survives only as a
 * render-time overlay.
 */
export function parseLevel(definition: LevelDefinition): ParsedLevel {
  let playerStart: Coordinate = { row: 0, col: 0 };
  let gemCount = 0;

  const template = definition.rows.map((row, rowIndex) =>
    (row.split("") as Tile[]).map((tile, colIndex) => {
      if (tile === "g") {
        gemCount += 1;
      }

      if (tile !== "p") {
        return tile;
      }

      playerStart = { row: rowIndex, col: colIndex };
      return " ";
    }),
  );

  return { definition, template, playerStart, gemCount };
}
