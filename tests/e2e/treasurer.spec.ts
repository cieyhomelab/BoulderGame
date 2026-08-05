import { expect, test, type Page } from "@playwright/test";

import { tileAt } from "../../src/lib/boulder-simulation";
import { GAME_TIMING } from "../../src/lib/game-clock";
import { GAME_GUARDRAIL_TEST_IDS } from "../../src/lib/game-guardrails";
import { applySimulation, createInitialGameState, type GameState } from "../../src/lib/game-rules";
import { LEVELS, parseLevel, type LevelDefinition } from "../../src/lib/levels";
import { releaseTreasurer } from "../../src/lib/treasurer";

import {
  activateNextLevel,
  advanceGameClock,
  expectGameHydrated,
  expectLevelName,
  expectLevelStatus,
  expectOutcomeMessage,
  expectPlayerAt,
  expectTreasurerAt,
  expectTreasurerDormant,
  pressKeys,
  winningKeysFor,
} from "./guardrail-assertions";

/**
 * The Skarbek: sealed in the rock, loosed by the first gem, and thereafter walking dug tunnels at
 * his own cadence until he reaches the Miner.
 *
 * Split in two on purpose. The rule that he can only ever stand in a tunnel someone dug is a
 * property of the simulation, and the honest way to test a property is to run it hundreds of times
 * against a board built for it — no page, like `level-invariants`. What the browser is then asked
 * is the narrower question only it can answer: that the cave the player actually loads wires that
 * simulation to the clock, the board and the loss it reports.
 */

const MANUAL_CLOCK_ROUTE = "/?clock=manual";

/**
 * The registered cave with a Skarbek in it, found by its marker rather than named — the spec then
 * follows the registry the way `level-invariants` does instead of pinning an id that a reorder
 * would quietly invalidate. Resolved through a function so the result is a definition rather than
 * a maybe-definition: with `noUncheckedIndexedAccess` off, an index lookup would type as found
 * either way, and a guard on it would be dead code the compiler cannot see through.
 */
function findTreasurerCave(): LevelDefinition {
  const cave = LEVELS.find((level) => level.rows.some((row) => row.includes("t")));

  if (!cave) {
    throw new Error("No cave in `LEVELS` has a Skarbek in it, so there is nothing here to test.");
  }

  return cave;
}

const TREASURER_CAVE = findTreasurerCave();
const TREASURER_CAVE_INDEX = LEVELS.indexOf(TREASURER_CAVE);

/**
 * A board built for the walk and nothing else: one large connected cavern for him to roam, and the
 * Miner bricked into a one-tile pocket at (1,1) where he can neither move nor be reached. Caging
 * the Miner is what lets the walk run for hundreds of steps — in a real cave it would end the
 * moment the spirit found him, and a rule about where he may go cannot be tested in five steps.
 */
const WALK_FIXTURE: LevelDefinition = {
  id: "treasurer-walk-fixture",
  name: "Treasurer walk fixture",
  requiredGemCount: 0,
  rows: [
    "############",
    "#p#        #",
    "###        #",
    "#          #",
    "#   t      #",
    "#          #",
    "#         e#",
    "############",
  ],
};

/** Every tile the Skarbek stood on over `steps` intervals, in order. */
function walkTrail(level: LevelDefinition, steps: number): string[] {
  const parsed = parseLevel(level);
  const initial = createInitialGameState(parsed);
  const treasurer = initial.treasurer;

  if (!treasurer) {
    throw new Error(`${level.id} has no Skarbek to walk.`);
  }

  // Loosed by hand rather than by taking a gem: the fixture's Miner is walled in and could never
  // reach one, which is exactly the property that keeps him safe for the length of the walk.
  let state: GameState = { ...initial, treasurer: releaseTreasurer(treasurer, 0) };
  const trail: string[] = [];

  for (let step = 1; step <= steps; step += 1) {
    state = applySimulation(state, step * GAME_TIMING.treasurerStepIntervalMs);
    const position = state.treasurer?.position;

    if (!position) {
      throw new Error("the Skarbek vanished mid-walk");
    }

    expect(tileAt(state.board, position.row, position.col)).toBe(" ");
    trail.push(`${position.row}:${position.col}`);
  }

  expect(state.status).toBe("active");

  return trail;
}

test("he walks dug tunnels and nothing else, for as long as you let him", () => {
  const trail = walkTrail(WALK_FIXTURE, 400);

  // The tile check inside the walk proves he never stands in rock. This proves he never crossed
  // any: the Miner's pocket is open space too, and only a wall separates it from the cavern.
  expect(trail).not.toContain("1:1");
  // A walk that never left one tile would satisfy everything above and mean nothing.
  expect(new Set(trail).size).toBeGreaterThan(10);
});

test("the same cave walks the same way twice, so a chase can be replayed", () => {
  expect(walkTrail(WALK_FIXTURE, 120)).toEqual(walkTrail(WALK_FIXTURE, 120));
});

test("sealed in a pocket nobody has opened, he cannot move at all", () => {
  const parsed = parseLevel(TREASURER_CAVE);
  const initial = createInitialGameState(parsed);

  // A hundred intervals with no gem taken and no tunnel cut: the cave has not given him a step.
  const state = applySimulation(initial, 100 * GAME_TIMING.treasurerStepIntervalMs);

  expect(state.treasurer?.released).toBe(false);
  expect(state.treasurer?.position).toEqual(parsed.treasurerStart);
});

/**
 * `GameEntry` always opens on the first cave, so the only honest way to the Skarbek's one is to
 * clear the caves before it — on searched routes, at a frozen clock, exactly as the progression
 * suite walks the registry.
 */
async function openTreasurerCave(page: Page): Promise<void> {
  await page.goto(MANUAL_CLOCK_ROUTE);
  await expectGameHydrated(page);

  for (const definition of LEVELS.slice(0, TREASURER_CAVE_INDEX)) {
    await pressKeys(page, winningKeysFor(definition));
    await expectLevelStatus(page, "won");
    await activateNextLevel(page);
  }

  await expectLevelName(page, TREASURER_CAVE.name);
  await expectLevelStatus(page, "active");
}

/** Start (1,1) down the shaft, then east along row 3 to the gem at (3,7) — his lid. */
const ROUTE_TO_HIS_GEM = [
  "ArrowDown",
  "ArrowDown",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
  "ArrowRight",
];

test("he is on the board from the first frame, asleep under the gem that holds him", async ({ page }) => {
  await openTreasurerCave(page);

  await expectTreasurerAt(page, 4, 7);
  await expectTreasurerDormant(page, true);

  await advanceGameClock(page, 10 * GAME_TIMING.treasurerStepIntervalMs);

  // Time alone is not what looses him, and a sealed niche is not what holds him back — either one
  // on its own would have moved him by now.
  await expectTreasurerAt(page, 4, 7);
  await expectTreasurerDormant(page, true);
});

test("taking his gem wakes him, and standing where you took it is fatal", async ({ page }) => {
  await openTreasurerCave(page);

  await pressKeys(page, ROUTE_TO_HIS_GEM);
  await expectPlayerAt(page, 3, 7);
  await expectTreasurerDormant(page, false);
  // Awake but owed a full interval: the wake-up is a warning, not the blow.
  await expectTreasurerAt(page, 4, 7);
  await expectLevelStatus(page, "active");

  await advanceGameClock(page, GAME_TIMING.treasurerStepIntervalMs);

  // The gem's tile is the only way out of his niche, and the Miner is still standing in it.
  await expectLevelStatus(page, "lost");
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.lossCause)).toHaveText("treasurer");
  await expectOutcomeMessage(page, /Treasurer caught you/i);
  await expectTreasurerAt(page, 3, 7);
  // The Miner is gone, the way they are gone under a boulder — the tile shows what took them.
  await expect(page.getByTestId(GAME_GUARDRAIL_TEST_IDS.player)).toHaveCount(0);
});

test("one step east of the gem is enough, and he takes the tunnel instead", async ({ page }) => {
  await openTreasurerCave(page);

  await pressKeys(page, [...ROUTE_TO_HIS_GEM, "ArrowRight"]);
  await expectPlayerAt(page, 3, 8);

  await advanceGameClock(page, GAME_TIMING.treasurerStepIntervalMs);

  await expectTreasurerAt(page, 3, 7);
  await expectLevelStatus(page, "active");
});
