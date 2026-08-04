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
 * The second cave. Wider and more open than `cave-01`, with the exit on the far side of the map
 * from the Miner so the quota is a round trip rather than a straight line.
 *
 * Invariants (the same contract `cave-01` holds):
 * - No boulder is unsupported at t=0: (1,4) rests on Dirt at (2,4), (1,9) on the gem at (2,9).
 *   A gem is not open space, so it supports a boulder until it is collected.
 * - Boulders sit in columns 4 and 9; the exit is in column 1. A boulder can roll sideways since
 *   the gravity change, so distance alone is no seal — the solver's winning route, which never
 *   disturbs a boulder, is what guarantees the exit stays open.
 * - Spikes at (5,2) and (5,7).
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (2,2) up-left of
 *   the start, (5,10) through the row-3 corridor, then out along row 6 to the exit.
 * - The bonus gem at (2,9) is the boulder's own support — collecting it starts that boulder's fall
 *   onto the tile the Miner is standing in. It is survivable only by stepping aside (not down,
 *   which the boulder follows) within the grace window.
 */
const CAVE_02: LevelDefinition = {
  id: "cave-02",
  name: "Level 02",
  requiredGemCount: 2,
  rows: [
    "############",
    "#...r....r.#",
    "#.g..##..g.#",
    "#..p.......#",
    "#.#...##...#",
    "#.h....h.#g#",
    "#e.........#",
    "############",
  ],
};

/**
 * The third cave: a labyrinth. Where `cave-01` and `cave-02` are open rooms, this one is corridors —
 * rows 2 and 4 are near-solid barriers with a single passage each, so the quota route is one forced
 * snake (row 1 rightwards, down col 7, row 3 leftwards, down col 1, row 6 rightwards) rather than a
 * choice of lines.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsettled at t=0: (1,9) rests on the boulder at (2,9), which rests on Dirt at
 *   (3,9). That pair is the whole point of the cave — see the chain below. The wall at (2,8) seals
 *   the pair's left flank, so the descent beside them at column 7 can never start a roll; their
 *   right flanks end at the border and the (2,10)/(1,10) walls-and-gem pocket.
 * - Both boulders sit in column 9; the exit is at (6,8), and the shaft the chain drops them down
 *   is walled on both sides, so the stack lands wedged at (4,9)/(5,9) with no flank to roll out of.
 * - Spikes at (5,6), a lethal dead end wedged between the row-5 detour and the gem stub. It looks
 *   like the short way from (5,5) to (6,6); it is not.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (3,1) sits on the
 *   row-3 leg, (5,7) is a stub off (6,7), and neither the route nor the stub enters column 9.
 * - The bonus gem at (1,10) is walled by the border on two sides, by (2,10) below, and by the
 *   boulder at (1,9) — obtainable only by deliberately undermining that boulder (FR-011).
 * - The chain (FR-009): digging (3,9) from (3,8) drops the (2,9) boulder down the sealed shaft
 *   (4,9)/(5,9) onto the wall floor at (6,9), and (1,9) follows it to (4,9). Escape from (3,9) is
 *   sideways to (3,8) only — the shaft below follows the same column.
 * - Rows 5 and 6 touch only at columns 1, 3, 5 and 7, and (6,4) is wall, so the bottom leg has no
 *   shortcut: the detour up through (5,3)-(5,5) is forced.
 *
 * The e2e suite asserts these coordinates directly — changing a row here breaks tests by design.
 */
const CAVE_03: LevelDefinition = {
  id: "cave-03",
  name: "Level 03",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p.......rg#",
    "#######.#r##",
    "#g........##",
    "#.####### ##",
    "#.#...hg# ##",
    "#...#...e###",
    "############",
  ],
};

/**
 * The fourth cave: short and compact — the quota is a ~10-move loop around the start, easier than
 * `cave-01`. The right side holds the cave's one set piece: a two-boulder chain guarding a
 * walled-in bonus gem.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (1,8) rests on the boulder at (2,8), which rests on Dirt at
 *   (3,8).
 * - Both boulders sit in column 8; the exit is at (6,2). A boulder can roll sideways since the
 *   gravity change, so distance alone is no seal — the solver's winning route, which never
 *   disturbs a boulder, is what guarantees the exit stays open.
 * - Spikes at (5,6), a dead end against the wall at (5,7).
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (1,4) is two
 *   steps up-right of the start, (4,3) on the way down, and the route never enters column 8.
 * - The bonus gem at (1,9) is walled on every side but (1,8), which holds the top boulder — it is
 *   obtainable only by deliberately undermining the stack (FR-011).
 * - The chain (FR-009): digging (3,8) from (3,7) drops the (2,8) boulder onto the wall floor at
 *   (4,8), and (1,8) follows it down one tile. Escape from (3,8) is sideways to (3,7) only. The
 *   settled stack then leaves (1,8) open, and the bonus gem is taken along row 1.
 */
const CAVE_04: LevelDefinition = {
  id: "cave-04",
  name: "Level 04",
  requiredGemCount: 2,
  rows: [
    "############",
    "#...g...rg##",
    "#.p.....r###",
    "#..........#",
    "#..g..#.#..#",
    "#.....h#...#",
    "#.e........#",
    "############",
  ],
};

/**
 * The fifth cave: three horizontal layers. The top corridor is studded with boulders resting on
 * the dirt of row 2 — the fast lane runs directly beneath them, and stepping into a support tile
 * is what digs it away, so the boulder falls into the lane behind (or onto) the Miner. Row 3 is
 * the slow, safe lane. The trip is a loop: right along the top for the first gem, down the far
 * side, and back along the bottom.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (1,4) rests on Dirt at (2,4), (1,8) on Dirt at (2,8).
 * - Boulders sit in columns 4 and 8; the exit is at (6,9). A boulder can roll sideways since the
 *   gravity change, so distance alone is no seal — the solver's winning route, which never
 *   disturbs a boulder, is what guarantees the exit stays open.
 * - Spikes at (5,10), the corner past the exit turn-off.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: row 3 bypasses
 *   both support tiles, (1,10) is reached up column 10, (5,7) down the column-9 gap in row 4.
 * - The bonus gem at (6,1) is no puzzle, just remote: the full bottom-left trek past the column-1
 *   gap in row 4, far off the winning route.
 */
const CAVE_05: LevelDefinition = {
  id: "cave-05",
  name: "Level 05",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p..r...r.g#",
    "#..........#",
    "#..........#",
    "#.#######.##",
    "#......g..h#",
    "#g.......e.#",
    "############",
  ],
};

/**
 * The sixth cave: a comb labyrinth. Vertical teeth at columns 3, 5-6, 8-9 alternate their gaps
 * between row 1 and row 6, so the route is one snake — down column 4, along the bottom, up
 * column 7, out along the top to the exit at (3,10). Unlike `cave-03`, the boulders here are pure
 * scenery: a stack locked into the col-8/9 tooth beside the exit, sealed so it can never fall nor
 * roll.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsettled at t=0: (3,9) rests on wall at (4,9) with walls at (3,8) beside it,
 *   and (2,9) rests on that boulder with wall at (2,8). Neither support is diggable, and every
 *   flank keeps a permanently closed half — (3,8)/(2,8) are wall, and the right flanks end on the
 *   exit at (3,10) and its wall roof, which never become open space — so the stack cannot move.
 * - Boulders sit in column 9; the exit is at (3,10), one column over, and the Miner digging the
 *   approach at (2,10) only ever opens half of a flank whose other half is the exit itself.
 * - Spikes at (6,2), the floor of the start-side pocket.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (2,4) and (1,8)
 *   both sit on the snake itself, so the winning route costs no detour.
 * - The bonus gem at (6,1) is no puzzle, just remote: the bottom of the cols-1-2 pocket under the
 *   start, sealed from the bottom corridor by the wall at (6,3), beside the spikes.
 */
const CAVE_06: LevelDefinition = {
  id: "cave-06",
  name: "Level 06",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p...##.g..#",
    "#..#g##.#r.#",
    "#..#.##.#re#",
    "#..#.##.####",
    "#.##.##.####",
    "#gh#....####",
    "############",
  ],
};

/**
 * The seventh cave: a round trip at `cave-02`'s weight. The Miner starts top-right, the exit is
 * the opposite corner, and the middle of the map is a solid block pierced by two shafts: the
 * column-1 shaft, open, and the column-5 shortcut, plugged by a boulder at its mouth. The honest
 * route runs the full left-down-right loop; the shortcut can be forced open, but the boulder
 * chases the Miner down the shaft.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (2,5) rests on Dirt at (3,5).
 * - The boulder sits in column 5; the exit is at (6,1). A boulder can roll sideways since the
 *   gravity change, so distance alone is no seal — the solver's winning route, which never
 *   disturbs a boulder, is what guarantees the exit stays open.
 * - Spikes at (6,4), a pocket under the row-5 corridor.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (1,1) at the end
 *   of the top corridor, (5,5) along the bottom, descending the boulder-free column-1 shaft.
 * - The bonus gem at (6,10) is no puzzle, just remote: a corner nook entered from (5,10), walled
 *   off from the exit side by (6,9).
 */
const CAVE_07: LevelDefinition = {
  id: "cave-07",
  name: "Level 07",
  requiredGemCount: 2,
  rows: [
    "############",
    "#g........p#",
    "#.###r######",
    "#.###.######",
    "#.###.######",
    "#....g.....#",
    "#e.#h..#.#g#",
    "############",
  ],
};

/**
 * The eighth cave, and the first of the hard trio. A round trip: row 3 is solid but for columns 1
 * and 10, so the start and the exit sit on opposite ends of one long loop — down column 1, across
 * the middle chamber, up column 10 for the far gem, and all the way back. The sealed top-left
 * chamber is the set piece: a dead-end lure with two boulders on its ceiling, holding the bonus.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (1,3) rests on Dirt at (2,3), (1,5) on the gem at (2,5).
 *   A gem is not open space, so it supports a boulder until it is collected.
 * - Boulders sit in columns 3 and 5; the exit is at (6,4). A boulder can roll sideways since the
 *   gravity change, so distance alone is no seal — the solver's winning route, which never
 *   disturbs a boulder, is what guarantees the exit stays open.
 * - Spikes at (4,5), mid-chamber, off the row-5 and row-6 through-lanes.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (5,1) sits on the
 *   column-1 descent and (1,10) at the top of the column-10 climb, neither inside the lure.
 * - The bonus gem at (2,5) is the (1,5) boulder's own support, at the far end of the lure. Getting
 *   it means crossing (2,3) first — the (1,3) boulder's support — so the run is two drops deep:
 *   step on through the grace window, take the gem, then retreat to (2,4) with a boulder now on
 *   either side and climb out along row 1, which the first drop has opened.
 * - The lure is sealed at (1,6)/(2,6), so it is never a shortcut: it costs the whole trip and
 *   returns nothing but the bonus.
 */
const CAVE_08: LevelDefinition = {
  id: "cave-08",
  name: "Level 08",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p.r.r#...g#",
    "#....g#....#",
    "#.########.#",
    "#....h.....#",
    "#g.........#",
    "#...e......#",
    "############",
  ],
};

/**
 * The ninth cave: a comb labyrinth, longer than `cave-06` and with a boulder that is a door rather
 * than scenery. Teeth at columns 3, 5 and 7 alternate their gaps between row 1 and row 6, so the
 * route is one long snake — down the start pocket, up column 4, down column 6, then out into the
 * right-hand chamber where the exit and the set piece sit.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (1,9) rests on Dirt at (2,9).
 * - The boulder sits in column 9; the exit is at (6,10). A boulder can roll sideways since the
 *   gravity change, so distance alone is no seal — the solver's winning route, which never
 *   disturbs a boulder, is what guarantees the exit stays open.
 * - Spikes at (4,2), a side tile of the start pocket: the column-1 descent passes them, the
 *   column-2 one walks into them.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (1,4) sits at the
 *   top of the column-4 tooth on the snake itself, (3,10) is a two-step stub off the column-10
 *   climb, and neither needs column 9.
 * - The bonus gem at (1,10) is walled by the border above and right, by (2,10) below, and by the
 *   boulder at (1,9) — obtainable only by deliberately undermining it (FR-011). Digging (2,9) from
 *   (2,8) sends that boulder down the open column-9 shaft to the cave floor at (6,9); escape from
 *   (2,9) is sideways to (2,8) only, and the vacated (1,9) is then the door into the gem.
 * - The shaft is what keeps the set piece survivable, and it must stay open space to the bottom.
 *   A boulder resting at (2,9) instead would sit right beside the escape tile, and the moment the
 *   Miner opened (3,8) on the way out the whole flank would be clear and it would roll onto them.
 *   Landing on row 6 there is no flank at all: the diagonal below is outside the cave.
 * - The landed boulder splits row 6 at column 9, which the exit survives: (6,10) is also reached
 *   from (5,10) down the column-10 climb.
 */
const CAVE_09: LevelDefinition = {
  id: "cave-09",
  name: "Level 09",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p.#g..#.rg#",
    "#..#.#.#..##",
    "#..#.#.#. g#",
    "#.h#.#.#. .#",
    "#..#.#.#. .#",
    "#....#... e#",
    "############",
  ],
};

/**
 * The tenth cave, and the last one: a full lap of the map with a two-boulder chain guarding the
 * bonus. The top corridor is walled from column 3 to column 6, so the start has exactly one way
 * out — down column 1 — and the exit sits at the far end of the lap, at (1,10). The column-3 shaft
 * and the column-8 pocket are the two detours; the chain is in the column-7 shaft between them.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (3,7) rests on Dirt at (4,7), and (2,7) rests on that
 *   boulder. Both flanks of both are wall, except (2,6), whose diagonal (3,6) is wall — so neither
 *   can roll.
 * - Boulders sit in column 7; the exit is at (1,10). A boulder can roll sideways since the gravity
 *   change, so distance alone is no seal — the solver's winning route, which never disturbs a
 *   boulder, is what guarantees the exit stays open.
 * - Spikes at (5,10), the foot of the column-10 wall: the safe climb to the top corridor is
 *   column 9, one over.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (2,3) at the top
 *   of the sealed column-3 shaft, (1,7) along the top corridor past the exit, and the route never
 *   enters (4,7).
 * - The bonus gem at (2,6) is walled by (1,6), (2,5) and (3,6), and by the boulder at (2,7) — only
 *   the chain opens it (FR-009/FR-011). Digging (4,7) from (4,8) drops (3,7) onto the wall floor at
 *   (5,7), and (2,7) follows it down one tile; escape from (4,7) is sideways to (4,8) only. The
 *   vacated (2,7) is then the door, entered from (1,7) — a second lap of the map away.
 * - (5,8) is wall on purpose, and the stance at (4,8) is entered from (4,9) rather than from below.
 *   With an open (5,8) the settled boulder's whole right flank would clear the moment the Miner dug
 *   their way up, and it would roll off (4,7) onto the one tile the escape uses.
 */
const CAVE_10: LevelDefinition = {
  id: "cave-10",
  name: "Level 10",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p.####g..e#",
    "#.#g##gr#..#",
    "#.#.###r#..#",
    "#.#.###....#",
    "#.#.#####.h#",
    "#..........#",
    "############",
  ],
};

/**
 * The eleventh cave, built around the barred exit. The exit at (1,2) is the Miner's next-door
 * neighbour and the first move east is refused: with an empty bag the bars do not open, so the
 * whole cave is the price of the one step that would otherwise have ended it. The only way out of
 * the start pocket is down column 1, and the quota sits at the far end of the map.
 *
 * Invariants (the same contract the earlier caves hold):
 * - The exit is entered from (1,1) alone: (0,2), (1,3) and (2,2) are wall. There is no way to reach
 *   it except by coming back up the column-1 shaft, which is what makes the round trip mandatory.
 * - No boulder is unsupported at t=0: (3,5) rests on Dirt at (4,5), (3,8) on Dirt at (4,8). Neither
 *   can roll — every flank is Dirt rather than open space.
 * - Boulders sit in columns 5 and 8; the exit is in column 2.
 * - Spikes at (5,5), directly under the (3,5) boulder's support and directly over the row-6
 *   corridor: the Miner walks past them on every lap, and stepping up into them is a choice.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (5,10) and (4,10)
 *   up the column-10 shaft, out and back along row 6, and the route never enters row 3 or row 4.
 * - Row 3 is the short way home — column 10 down to column 1 in nine tiles instead of the long lap
 *   through row 6 — and both plugs in it are boulders. Neither is needed to win; both can be
 *   undermined by a Miner who wants the shorter return, at the price of a boulder falling on the
 *   tile they are standing in.
 * - The bonus gem at (2,8) is walled by (1,8), (2,7) and (2,9), and plugged from below by the (3,8)
 *   boulder — obtainable only by digging its support at (4,8) from (4,7) and stepping back west
 *   inside the grace window (FR-009/FR-011). (4,9) is wall, so west is the only escape.
 * - (5,8) is wall on purpose: the undermined boulder settles at (4,8) and can never fall further.
 *   With an open (5,8) it would drop through the column-8 pocket into the row-6 corridor once that
 *   corridor had been dug, sealing the only safe way home.
 */
const CAVE_11: LevelDefinition = {
  id: "cave-11",
  name: "Level 11",
  requiredGemCount: 2,
  rows: [
    "############",
    "#pe#########",
    "#.######g###",
    "#....r..r..#",
    "#.##.....#g#",
    "#.###h#.##g#",
    "#..........#",
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
export const LEVELS: readonly LevelDefinition[] = [
  CAVE_01,
  CAVE_02,
  CAVE_03,
  CAVE_04,
  CAVE_05,
  CAVE_06,
  CAVE_07,
  CAVE_08,
  CAVE_09,
  CAVE_10,
  CAVE_11,
];

/**
 * The level that follows `current` in play order, or `null` on the last one. Identity is the `id`,
 * not the object, so a re-parsed level still resolves its successor.
 */
export function nextLevelAfter(current: LevelDefinition): LevelDefinition | null {
  const index = LEVELS.findIndex((level) => level.id === current.id);

  return index === -1 ? null : (LEVELS[index + 1] ?? null);
}

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
