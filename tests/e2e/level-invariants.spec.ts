import { expect, test } from "@playwright/test";

import { isSupported, tileAt, type Board } from "../../src/lib/boulder-simulation";
import { LEVELS, parseLevel, type LevelDefinition } from "../../src/lib/levels";

/**
 * Design rules every cave must satisfy. These run against the level data itself rather than the
 * browser, so a new cave that is unwinnable, seals its own exit, or drops a boulder before the
 * player has moved fails here instead of in a route-specific spec that nobody thought to write.
 *
 * `test.describe` over the registry means adding a level to `LEVELS` adds its coverage for free.
 */
const WALKABLE = new Set([".", " ", "g", "e", "h"]);

function tilesMatching(definition: LevelDefinition, tile: string): { row: number; col: number }[] {
  return definition.rows.flatMap((row, rowIndex) =>
    row.split("").flatMap((cell, colIndex) => (cell === tile ? [{ row: rowIndex, col: colIndex }] : [])),
  );
}

/**
 * Tiles the Miner can reach without ever disturbing a boulder. A boulder blocks, and so does the
 * tile directly beneath one: stepping into it is what digs the support away.
 */
function reachableWithoutDisturbingBoulders(board: Board, start: { row: number; col: number }): Set<string> {
  const boulders = board.flatMap((row, rowIndex) =>
    row.flatMap((tile, colIndex) => (tile === "r" ? [{ row: rowIndex, col: colIndex }] : [])),
  );
  const supports = new Set(boulders.map(({ row, col }) => `${row + 1}:${col}`));

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
      // Spikes are lethal, so a route may end on them but never continue through them.
      if (tile !== "h") {
        queue.push({ row: nextRow, col: nextCol });
      }
    }
  }

  return seen;
}

for (const definition of LEVELS) {
  test.describe(`${definition.id} level design`, () => {
    const level = parseLevel(definition);

    test("is 8 rows by 12 columns and sealed by wall on every edge", () => {
      expect(definition.rows).toHaveLength(8);
      for (const row of definition.rows) {
        expect(row).toHaveLength(12);
      }

      const edges = [
        definition.rows[0],
        definition.rows[definition.rows.length - 1],
        ...definition.rows.map((row) => row[0] + row[row.length - 1]),
      ].join("");
      expect(edges).toMatch(/^#+$/);
    });

    test("has exactly one start, one exit, and spikes", () => {
      expect(tilesMatching(definition, "p")).toHaveLength(1);
      expect(tilesMatching(definition, "e")).toHaveLength(1);
      expect(tilesMatching(definition, "h").length).toBeGreaterThan(0);
    });

    test("carries at least the gems its quota demands", () => {
      expect(level.gemCount).toBeGreaterThanOrEqual(definition.requiredGemCount);
    });

    test("rests every boulder at t=0, so nothing falls before the player acts", () => {
      const unsupported = level.template.flatMap((row, rowIndex) =>
        row.flatMap((tile, colIndex) =>
          tile === "r" && !isSupported(level.template, rowIndex, colIndex) ? [`(${rowIndex},${colIndex})`] : [],
        ),
      );

      expect(unsupported).toEqual([]);
    });

    test("keeps every boulder out of the exit column, which no boulder can ever leave", () => {
      const exit = tilesMatching(definition, "e")[0];
      const bouldersOverExit = tilesMatching(definition, "r").filter((boulder) => boulder.col === exit.col);

      expect(bouldersOverExit).toEqual([]);
    });

    test("is winnable without ever touching a boulder", () => {
      const reachable = reachableWithoutDisturbingBoulders(level.template, level.playerStart);
      const exit = tilesMatching(definition, "e")[0];
      const safeGems = tilesMatching(definition, "g").filter((gem) => reachable.has(`${gem.row}:${gem.col}`));

      expect(safeGems.length).toBeGreaterThanOrEqual(definition.requiredGemCount);
      expect(reachable.has(`${exit.row}:${exit.col}`)).toBe(true);
    });
  });
}
