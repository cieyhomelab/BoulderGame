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
  /** Where the Skarbek is sealed into the rock, or `null` in a cave that has none. */
  treasurerStart: Coordinate | null;
  gemCount: number;
}

/**
 * The cave, authored against the live simulation. `.` is Dirt (solid, diggable, holds boulders),
 * `" "` is carved open space, `p` is the Miner's start, `t` the chamber a Skarbek is sealed in.
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
 * The twelfth cave, and the first with a Skarbek in it — the spirit of the Polish mining legends,
 * sealed in the rock and loosed the moment the first gem leaves his cave.
 *
 * The map is three corridors stacked between two shafts. The top one is plugged for good by the
 * boulder at (1,5), so the only way across from the column-1 shaft to the column-10 one is row 3,
 * and the quota gem sitting on it is the lid of the Skarbek's niche. That is the whole design: he
 * walks dug tunnels and nothing else, so at t=0, walled into a pocket nobody has opened, he cannot
 * move at all. The Miner taking his gem is what hands him a corridor to walk.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (1,5) rests on the wall at (2,5), (4,1) on the gem at (5,1).
 *   A gem is not open space, so it supports a boulder until it is collected.
 * - Neither boulder can ever roll: every flank of both has a wall half, at (2,4)/(2,6) for the
 *   first and (4,0)/(4,2) for the second, and a wall never becomes open space.
 * - Boulders sit in columns 5 and 1; the exit is at (6,10).
 * - Spikes at (5,5), mid-way along the row-5 lane, where the bottom of the map narrows.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (3,7) sits on
 *   the row-3 shortcut and (1,10) at the top of the column-10 climb, and neither needs column 1
 *   below row 3.
 * - The bonus gem at (5,1) is the (4,1) boulder's own support, at the dead end of the bottom-left
 *   leg: taking it starts that boulder's fall onto the tile the Miner is standing in, survivable
 *   only by stepping east to (5,2) inside the grace window (FR-009/FR-011).
 * - The Skarbek's niche at (4,7) is sealed at t=0 — wall east and west, Dirt below, and the gem at
 *   (3,7) for a lid. It is walled off from every route, so a Miner who never takes that gem never
 *   meets him: the shortcut is opt-in, and so is the danger.
 * - The gem is his lid, which is the cave's one lesson. Prising it off is what looses him, and the
 *   tile it leaves behind is the only way out of his niche, so the Miner who lingers where he took
 *   it is standing on the spot the Skarbek is walking to. One interval of grace, then he is there.
 * - The niche is never entered by mistake. It can only be reached through (3,7), and opening (3,7)
 *   is the same act that wakes him — so the Miner never shares a tile with a dormant Skarbek, and
 *   stepping into an awake one is a death the player chose.
 */
const CAVE_12: LevelDefinition = {
  id: "cave-12",
  name: "Level 12",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p...r....g#",
    "#.########.#",
    "#......g...#",
    "#r#####t##.#",
    "#g...h.....#",
    "#.........e#",
    "############",
  ],
};

/**
 * The thirteenth cave: the longest walk in the registry, and the first one the Miner has to make
 * twice. The exit at (6,1) is a stub off the column-1 shaft he descends on his ninth move, barred
 * and useless with an empty bag, and both quota gems are on the far side of the map — so the cave
 * is one out-and-back lap, not a lap.
 *
 * The middle of the map is a sealed column at 4-6 that splits it in two, crossed only along row 6.
 * The Skarbek is sealed on the right of it, under the row-3 corridor, and the gem that is his lid
 * is the second quota gem — so he wakes at the turning point, with the whole return trip left to
 * run down.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (2,5) rests on Dirt at (3,5). Neither flank can ever open —
 *   (2,4) and (2,6) are wall, and a wall never becomes open space.
 * - The boulder sits in column 5; the exit is at (6,1).
 * - Spikes at (6,2), the tile between the exit and the wall at (6,3). It is the only neighbour the
 *   exit has besides (5,1), so the Miner coming home down the row-5 lane sees his door one step
 *   below him and a step that kills him beside it.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (4,4) is a stub
 *   off (5,4) on the outbound leg, (3,8) sits on the row-3 corridor, and the honest route crosses
 *   the middle column along row 6, which the boulder never reads.
 * - The Skarbek's niche at (4,8) is sealed at t=0 — wall east, west and below, and the quota gem at
 *   (3,8) for a lid. Nothing else touches it, so he cannot move and the Miner cannot reach him
 *   until the gem is prised off, which is the same act that looses him.
 * - The bonus gem at (1,5) is roofed by the border, walled at (1,4) and (1,6), and plugged from
 *   below by the boulder — obtainable only by undermining it (FR-011). Digging (3,5) drops the
 *   boulder through it onto the wall floor at (5,5), and escape from (3,5) is east to (3,6) only,
 *   since (3,4) is wall. The vacated (2,5) is then the door.
 * - (4,5) is carved open on purpose: it is the shaft the undermined boulder falls into, and it is
 *   also a one-way seam between the two halves of the map. A Miner who digs (3,5) from below, from
 *   (4,5), is thrown east into (3,6) and cannot come back — the boulder has taken the shaft.
 */
const CAVE_13: LevelDefinition = {
  id: "cave-13",
  name: "Level 13",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p..#g#...g#",
    "###.#r#.####",
    "#...#...g..#",
    "#.##g ##t#.#",
    "#....####..#",
    "#eh#.......#",
    "############",
  ],
};

/**
 * The fourteenth cave: a spiral. The wall at (1,2) shuts the top corridor one step from the start,
 * so the Miner's only move is down, and from there the map winds inward — column 1, row 6,
 * column 10, back west along row 1, then through the single door at (2,7) into the chamber the
 * exit sits in. Every leg is one tile wide and none of them forks.
 *
 * The Skarbek is sealed at the dead end of the top corridor, at the far point of the spiral. His
 * lid is the first gem the cave offers, so he is loosed at the moment the Miner turns for home and
 * follows him down the whole inward run.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (2,5) rests on the gem at (3,5). A gem is not open space, so
 *   it supports a boulder until it is collected. Neither flank can ever open — (2,4) and (2,6) are
 *   wall.
 * - The boulder sits in column 5; the exit is at (4,3), reached from (4,4) alone.
 * - Spikes at (5,2), a stub off the row-6 corridor directly under the wall at (4,2). The exit is
 *   two tiles diagonally beyond them, which is the whole point: the step up looks like the short
 *   way in and there is no way in from that side at all.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: (1,3) is the dead
 *   end of the top corridor and (4,8) a stub off the inner chamber, and neither the spiral nor
 *   either stub enters row 3.
 * - The Skarbek's niche at (2,3) is sealed at t=0 — wall east, west and below, and the quota gem at
 *   (1,3) for a lid. It is the last tile of the outward spiral, so he wakes with the Miner standing
 *   on his ceiling and the entire inward run still to go.
 * - The bonus gem at (3,5) is the boulder's own support, in a pocket off the inner chamber that the
 *   honest route never needs. Taking it starts the boulder's fall onto the tile the Miner is
 *   standing in, survivable only by stepping aside to (3,4) or (3,6) inside the grace window
 *   (FR-009/FR-011).
 * - The pocket at (3,4)-(3,6) is what keeps that trick from sealing the cave. With the inner
 *   chamber already dug, the fallen boulder settles at (4,5) and splits row 4 — and the Miner
 *   caught east of it walks home over the pocket instead, through the (3,5) the boulder has
 *   vacated.
 */
const CAVE_14: LevelDefinition = {
  id: "cave-14",
  name: "Level 14",
  requiredGemCount: 2,
  rows: [
    "############",
    "#p#g.......#",
    "#.#t#r#.##.#",
    "#.##.g..##.#",
    "#.#e....g#.#",
    "#.h#######.#",
    "#..........#",
    "############",
  ],
};

/**
 * The fifteenth cave, and the longest route in the registry: a four-lane comb (columns 1, 3, 5, 7,
 * separated by teeth at columns 2, 4, 6) forces one unbroken snake — down column 1, right through
 * the row-6 gap, up column 3, right through the row-1 gap, down column 5, right through the row-6
 * gap, up column 7 — before the far gem even comes into view. Every tooth is solid but for its one
 * gap, alternating top and bottom, so there is no shortcut across it: reaching column 7 costs the
 * whole snake, and coming home costs it again. The exit at (1,2) is the Miner's next-door neighbour,
 * barred until the quota is met, exactly `cave-11`'s trick, but here the lap it prices is this one.
 *
 * The far quota gem, (1,10), is the Skarbek's lid, reached only after the whole snake — so he wakes
 * at the farthest possible point and the entire snake is still there to run home through, the
 * longest chase in the registry. A boulder beside the column-7 climb hides a bonus the same way
 * `cave-01`'s does: walled on every side but the one the boulder itself blocks.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: (4,9) rests on Dirt at (5,9). Neither flank can ever open —
 *   (4,8) is Dirt and (4,10) is a gem, never open space, so `rollDirection` never qualifies either
 *   side.
 * - The boulder sits in column 9; the exit is in column 2.
 * - Spikes at (3,8), a one-step lure off the column-7 climb: it looks like a peek into the bonus
 *   pocket one row early and is instead the whole trick.
 * - The two-gem quota plus the exit is reachable without ever touching a boulder: the snake itself
 *   carries the Miner through (5,5) on the column-5 leg, and (1,10) is three steps east of the
 *   column-7 exit along row 1 — neither needs columns 8 or 9, which is what the boulder's support
 *   and flank cost the heuristic.
 * - The bonus gem at (4,10) is walled north by (3,10), south by (5,10), east by the border, and west
 *   by the boulder at (4,9) — the only door. Undermining it from (5,9), approached from (5,8) off
 *   the column-7 climb, drops it one tile down; escape is west to (5,8) alone. The vacated (4,9)
 *   then lets the Miner in from (4,8).
 * - The Skarbek's niche at (2,10) is sealed at t=0 — wall south at (3,10), border east, Dirt west at
 *   (2,9) not yet dug, and the quota gem at (1,10) for a lid. Prising it off looses him standing on
 *   his ceiling with the whole snake still to cross going home.
 *
 * The e2e suite asserts these coordinates directly — changing a row here breaks tests by design.
 */
const CAVE_15: LevelDefinition = {
  id: "cave-15",
  name: "Level 15",
  requiredGemCount: 2,
  rows: [
    "############",
    "#pe...#...g#",
    "#.#.#.#.#.t#",
    "#.#.#.#.h.##",
    "#.#.#.#..rg#",
    "#.#.#g#...##",
    "#...#...#..#",
    "############",
  ],
};

/**
 * The sixteenth cave: the nail field, and the first cave in the registry that asks for three gems.
 * Where `cave-15` prices one long snake, this one prices a dead end — the quota cannot be filled
 * without walking into a gallery that has no other way out.
 *
 * Row 3 is the nail field: spikes from wall to wall but for the single gap at (3,6). The whole
 * middle of the map is lethal floor, the gap is the cave's only crossing, and both descents that
 * look like the way down are spiked — (2,1) under the start, which is the column-1 shaft every
 * earlier cave has trained the player to take, and (2,8) in the top-right nook.
 *
 * Below the field, row 4 is the one corridor and row 6 is a sump: a ten-tile gallery hanging off
 * (5,1), because row 5 is solid everywhere else. The far gem sits at the blind end of it, so the
 * sump has to be walked in and walked back out, and the exit is at the opposite corner from where
 * that walk ends. That is where the route's length comes from — 44 moves, second only to `cave-15`.
 *
 * Invariants (the same contract the earlier caves hold):
 * - No boulder is unsupported at t=0: the cave's one boulder, (1,9), rests on Dirt at (2,9). It
 *   cannot roll either — a roll needs open space beside it and under that, and its west flank is
 *   Dirt at (1,8)/(2,8) while its east flank is the bonus gem and the wall at (2,10).
 * - The boulder sits in column 9; the exit is at (4,10). It can never reach that column: east is
 *   the flank that never opens, so its only motion is west into the nook and then down column 9
 *   onto the spike at (3,9). The exit cannot be sealed.
 * - Spikes: the row-3 field, nine tiles at (3,1)-(3,5) and (3,7)-(3,10). (3,6) must stay open space
 *   in rows 2, 3 and 4 together or the cave is cut in half and unwinnable.
 * - The three-gem quota plus the exit is reachable without ever touching a boulder: (4,3) on the
 *   row-4 leg, (6,2) just inside the sump, (6,10) at its blind end, and the exit at (4,10) along
 *   row 4. None of them needs row 1 east of (1,7), which is what the boulder's support and west
 *   flank cost the heuristic.
 * - The exit is entered from (4,9) alone: (3,10) is a spike and (5,10) is wall. Coming home from
 *   the sump therefore means the full length of row 4, twice — out west to (4,1) to get into the
 *   sump at all, and back east to the far corner once the quota is full.
 * - The bonus gem at (1,10) is roofed by the border, walled east by the border and below by (2,10)
 *   — the boulder at (1,9) is its only door (FR-011). The nook has exactly one solution, and the
 *   board forces the order: (2,9) is reachable only through (2,8), and (2,8) only from (1,8), so by
 *   the time the Miner could dig the support they have already opened the whole west flank. Walking
 *   (1,8) and then digging down into (2,8) is what does it — the boulder rolls into the vacated
 *   (1,8) and falls onto the Miner standing in (2,8). Escape is east into (2,9), since (2,7) is
 *   wall and (3,8) is a spike, and that same tile is how the vacated (1,9) is entered.
 * - The boulder settles at (2,8), on the spike at (3,8), in the tile the Miner just left, and it
 *   stays put: its east flank is then the Miner's own tile over a spike, which `rollDirection`
 *   never reads as open. Row 1 west of the nook is open space by then, so the Miner is not trapped.
 * - (2,7) is wall and (3,8)/(3,9) are spikes on purpose. They leave the nook exactly one escape
 *   tile, which is what makes the drop a grace-window dodge rather than a coin flip, and they stop
 *   the nook from becoming a second crossing that would make the gap at (3,6) pointless.
 */
const CAVE_16: LevelDefinition = {
  id: "cave-16",
  name: "Level 16",
  requiredGemCount: 3,
  rows: [
    "############",
    "#p.......rg#",
    "#.####.#..##",
    "#hhhhh.hhhh#",
    "#..g......e#",
    "#.##########",
    "#.g.......g#",
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
  CAVE_12,
  CAVE_13,
  CAVE_14,
  CAVE_15,
  CAVE_16,
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
 * Parses a level's rows. The `p` and `t` markers are resolved away here — the Miner has by
 * definition already dug the tile they stand in, and the Skarbek's chamber is a hollow in the
 * rock — so both cells become open space and both markers survive only as render-time overlays.
 *
 * That the Skarbek's cell is open matters to more than the picture: the cave's other rules read
 * the parsed template, so a boulder over his chamber is correctly unsupported at t=0 and the
 * audit says so.
 */
export function parseLevel(definition: LevelDefinition): ParsedLevel {
  let playerStart: Coordinate = { row: 0, col: 0 };
  let treasurerStart: Coordinate | null = null;
  let gemCount = 0;

  const template = definition.rows.map((row, rowIndex) =>
    (row.split("") as Tile[]).map((tile, colIndex) => {
      if (tile === "g") {
        gemCount += 1;
      }

      if (tile === "t") {
        treasurerStart = { row: rowIndex, col: colIndex };
        return " ";
      }

      if (tile !== "p") {
        return tile;
      }

      playerStart = { row: rowIndex, col: colIndex };
      return " ";
    }),
  );

  return { definition, template, playerStart, treasurerStart, gemCount };
}
