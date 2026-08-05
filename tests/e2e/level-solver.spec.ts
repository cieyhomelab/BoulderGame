import { expect, test } from "@playwright/test";

import { createInitialGameState, resolveMove, MOVE_DELTAS } from "../../src/lib/game-rules";
import { LEVELS, parseLevel } from "../../src/lib/levels";
import { solveLevel } from "../../src/lib/level-solver";

/**
 * Proves every registered cave is winnable by searching it with the real rules, and proves the
 * search itself is honest by replaying what it returns.
 *
 * Like `level-invariants`, this opens no page — and like it, adding a cave to `LEVELS` adds its
 * coverage automatically.
 */
for (const definition of LEVELS) {
  test.describe(`${definition.id} solvability`, () => {
    const level = parseLevel(definition);

    test("has a winning route", () => {
      const result = solveLevel(level);

      expect(result.solved).toBe(true);
      expect(result.route.length).toBeGreaterThan(0);
    });

    test("the returned route actually wins when replayed through the rules", () => {
      const result = solveLevel(level);

      // Replaying independently of the search is the point: a solver that reports success from a
      // state its own bookkeeping corrupted would pass the test above and fail this one.
      //
      // Without the Skarbek, on the same terms the search itself used: a route proved against a
      // cave's geometry has to be replayed against that same geometry, or the replay would be
      // asking a question the route was never an answer to.
      let state = createInitialGameState(level, { includeTreasurer: false });
      for (const direction of result.route) {
        const moved = resolveMove(state, MOVE_DELTAS[direction], 0);
        expect(moved.accepted).toBe(true);
        state = moved.state;
      }

      expect(state.status).toBe("won");
      expect(state.collectedGemCount).toBeGreaterThanOrEqual(definition.requiredGemCount);
    });

    test("wins without disturbing a boulder, so the route is clock-independent", () => {
      const result = solveLevel(level);

      // Shortest-route play never needs to undermine anything in either cave. That matters beyond
      // aesthetics: a route that leaves nothing falling produces the same outcome at any press
      // speed, which is exactly what an e2e key sequence needs.
      expect(result.disturbsBoulders).toBe(false);
    });
  });
}

test("reports unsolvability rather than guessing when a cave cannot be won", () => {
  // A sealed chamber: the Miner is walled in, so no gem and no exit is reachable.
  const impossible = parseLevel({
    id: "sealed",
    name: "Sealed",
    requiredGemCount: 1,
    rows: [
      "############",
      "#.g........#",
      "#....#######",
      "#..p.#.....#",
      "#....#.....#",
      "######.....#",
      "#e.........#",
      "############",
    ],
  });

  const result = solveLevel(impossible);

  expect(result.solved).toBe(false);
  // Exhausted, not budget-capped: the answer is "no route exists", not "I gave up".
  expect(result.exhausted).toBe(true);
});
