import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import {
  NO_BOULDER_MOTIONS,
  motionKey,
  stepSimulation,
  tileAt,
  withTile,
  type Board,
  type BoulderMotions,
  type Coordinate as SimulationCoordinate,
} from "@/lib/boulder-simulation";
import { resolveGameClock, type GameClock } from "@/lib/game-clock";
import { GAME_GUARDRAIL_TEST_IDS, incrementGameAttemptCount } from "@/lib/game-guardrails";
import { cn } from "@/lib/utils";

import { TileArt, TileDefs, type Tile } from "./TileArt";

const LEVEL_ROWS = [
  "############",
  "#..g....r..#",
  "#.#....##..#",
  "#.hp....g..#",
  "#.....##...#",
  "#..r...ghe.#",
  "#..........#",
  "############",
] as const;

type LevelStatus = "active" | "lost" | "won";
type Coordinate = SimulationCoordinate;

interface GameState {
  board: Board;
  boulderMotions: BoulderMotions;
  playerPosition: Coordinate;
  moveCount: number;
  collectedGemCount: number;
  status: LevelStatus;
}

interface MoveResult {
  state: GameState;
  accepted: boolean;
}

const GEM_SCORE_VALUE = 100;
const REQUIRED_GEM_COUNT = 2;
const MOVE_KEYS: Partial<Record<string, Coordinate>> = {
  ArrowUp: { row: -1, col: 0 },
  w: { row: -1, col: 0 },
  W: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  s: { row: 1, col: 0 },
  S: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  a: { row: 0, col: -1 },
  A: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
  d: { row: 0, col: 1 },
  D: { row: 0, col: 1 },
};

interface ParsedLevel {
  template: Board;
  playerStart: Coordinate;
  gemCount: number;
}

/**
 * Parses the level rows once. The `p` start marker is resolved away here — the Miner has by
 * definition already dug the tile they stand in, so the cell becomes open space and `p` survives
 * only as a render-time overlay.
 */
function parseLevel(): ParsedLevel {
  let playerStart: Coordinate = { row: 0, col: 0 };
  let gemCount = 0;

  const template = LEVEL_ROWS.map((row, rowIndex) =>
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

  return { template, playerStart, gemCount };
}

function isSameCoordinate(a: Coordinate, b: Coordinate): boolean {
  return a.row === b.row && a.col === b.col;
}

function isWalkable(tile: Tile | undefined): boolean {
  return tile === "." || tile === " " || tile === "g" || tile === "e" || tile === "h";
}

function isDiggable(tile: Tile | undefined): boolean {
  return tile === "." || tile === "g";
}

/**
 * Runs the cave's gravity rule against the current state. Returns the same state object when the
 * step changed nothing, so the animation-frame subscription cannot re-render an idle board.
 */
function applySimulation(currentState: GameState, nowMs: number): GameState {
  if (currentState.status !== "active") {
    return currentState;
  }

  const result = stepSimulation({ board: currentState.board, boulderMotions: currentState.boulderMotions }, nowMs);

  if (result.board === currentState.board && result.boulderMotions === currentState.boulderMotions) {
    return currentState;
  }

  return { ...currentState, board: result.board, boulderMotions: result.boulderMotions };
}

function resolveMove(currentState: GameState, delta: Coordinate, nowMs: number): MoveResult {
  if (currentState.status !== "active") {
    return { state: currentState, accepted: false };
  }

  const nextPosition = {
    row: currentState.playerPosition.row + delta.row,
    col: currentState.playerPosition.col + delta.col,
  };

  // Read the target before digging it — after the dig it is open space and the gem/spike
  // branches below would be lost.
  const nextTile = tileAt(currentState.board, nextPosition.row, nextPosition.col);
  if (!isWalkable(nextTile)) {
    return { state: currentState, accepted: false };
  }

  const collectedGemCount = currentState.collectedGemCount + (nextTile === "g" ? 1 : 0);
  const board = isDiggable(nextTile)
    ? withTile(currentState.board, nextPosition.row, nextPosition.col, " ")
    : currentState.board;
  const status =
    nextTile === "h" ? "lost" : nextTile === "e" && collectedGemCount >= REQUIRED_GEM_COUNT ? "won" : "active";

  const movedState: GameState = {
    ...currentState,
    board,
    playerPosition: nextPosition,
    moveCount: currentState.moveCount + 1,
    collectedGemCount,
    status,
  };

  // The cave re-evaluates support after every board change, so digging registers instability in
  // the same update that produced the hole rather than a frame later.
  return { accepted: true, state: applySimulation(movedState, nowMs) };
}

const LEVEL = parseLevel();
const INITIAL_GEM_COUNT = LEVEL.gemCount;
const OPTIONAL_GEM_COUNT = INITIAL_GEM_COUNT - REQUIRED_GEM_COUNT;

function createInitialGameState(): GameState {
  return {
    // Row-level copy: a shallow copy of the outer array alone would let a dug corridor leak
    // from one attempt into the next.
    board: LEVEL.template.map((row) => [...row]),
    boulderMotions: NO_BOULDER_MOTIONS,
    playerPosition: LEVEL.playerStart,
    moveCount: 0,
    collectedGemCount: 0,
    status: "active",
  };
}

export default function GameEntry() {
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
  const countedAttemptRef = useRef(false);
  const replayButtonRef = useRef<HTMLButtonElement | null>(null);
  const gameClockRef = useRef<GameClock | null>(null);

  useEffect(() => {
    if (countedAttemptRef.current) {
      return;
    }

    countedAttemptRef.current = true;
    setAttemptCount(incrementGameAttemptCount());
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const delta = MOVE_KEYS[event.key];
      if (!delta) {
        return;
      }

      event.preventDefault();
      // Read the clock at keypress time — a value captured when the effect ran would be stale.
      const nowMs = gameClockRef.current?.now() ?? 0;
      setGameState((currentState) => {
        const moveResult = resolveMove(currentState, delta, nowMs);
        return moveResult.state;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const clock = (gameClockRef.current ??= resolveGameClock());

    return clock.subscribe((nowMs) => {
      setGameState((currentState) => applySimulation(currentState, nowMs));
    });
  }, []);

  useEffect(() => {
    if (gameState.status === "active") {
      return;
    }

    replayButtonRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    replayButtonRef.current?.focus({ preventScroll: true });
  }, [gameState.status]);

  function handleReplayClick(): void {
    setGameState(createInitialGameState());
    setAttemptCount(incrementGameAttemptCount());
  }

  const isTerminalState = gameState.status !== "active";
  const outcomeMessage =
    gameState.status === "won"
      ? "Level complete. Play again?"
      : gameState.status === "lost"
        ? "Cave-in. Play again?"
        : null;
  const collectedRequiredGems = Math.min(gameState.collectedGemCount, REQUIRED_GEM_COUNT);
  const collectedBonusGems = Math.max(gameState.collectedGemCount - REQUIRED_GEM_COUNT, 0);
  // A count, not an event: the live region announces once when the cave becomes unsettled and
  // once when it settles, rather than firing on every wobble frame.
  const unstableBoulderCount = gameState.boulderMotions.size;
  const unstableBoulderDescription =
    unstableBoulderCount === 0
      ? "The cave is stable."
      : `${unstableBoulderCount} boulder${unstableBoulderCount === 1 ? "" : "s"} losing support.`;

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#10140f] text-[#f5e7c8]"
      data-testid={GAME_GUARDRAIL_TEST_IDS.entrySurface}
    >
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#374f42] pb-4">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-[#79eada] uppercase">Cave broadcast</p>
            <h1 className="font-mono text-4xl leading-none font-black tracking-normal text-[#f5e7c8] sm:text-6xl">
              BoulderGame
            </h1>
          </div>
          <div
            className="border-4 border-[#3f3124] bg-[#191d17] px-4 py-3 text-right font-mono shadow-[6px_6px_0_#070806]"
            data-testid={GAME_GUARDRAIL_TEST_IDS.readyMarker}
          >
            <p className="text-xs tracking-[0.16em] text-[#9fb58f] uppercase">Level 01</p>
            <p className="text-2xl font-black text-[#f3b63f]">READY</p>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-5 py-5 lg:grid-cols-[1fr_18rem]">
          <div className="relative border-4 border-[#2f2519] bg-[#171a15] p-3 shadow-[10px_10px_0_#070806] sm:p-5">
            <TileDefs />
            <div
              aria-label="BoulderGame cave of diggable dirt, with the miner, gems, boulders, spikes and an open exit."
              className="grid grid-cols-12 gap-1 border-4 border-[#6b5540] bg-[#070a06] p-2"
              data-testid={GAME_GUARDRAIL_TEST_IDS.board}
              role="img"
            >
              {gameState.board.flatMap((boardRow, row) =>
                boardRow.map((cellTile, col) => {
                  const hasPlayer = isSameCoordinate({ row, col }, gameState.playerPosition);
                  const isUnstableBoulder =
                    cellTile === "r" && gameState.boulderMotions.get(motionKey(row, col))?.phase === "grace";

                  return (
                    <div
                      aria-hidden="true"
                      className="aspect-square min-h-0 overflow-hidden rounded-[2px]"
                      data-col={col}
                      data-row={row}
                      data-testid={
                        hasPlayer
                          ? GAME_GUARDRAIL_TEST_IDS.player
                          : cellTile === "h"
                            ? GAME_GUARDRAIL_TEST_IDS.hazard
                            : cellTile === "e"
                              ? GAME_GUARDRAIL_TEST_IDS.exit
                              : cellTile === "r"
                                ? isUnstableBoulder
                                  ? GAME_GUARDRAIL_TEST_IDS.unstableBoulder
                                  : GAME_GUARDRAIL_TEST_IDS.boulder
                                : cellTile === "."
                                  ? GAME_GUARDRAIL_TEST_IDS.dirt
                                  : cellTile === " "
                                    ? GAME_GUARDRAIL_TEST_IDS.openSpace
                                    : undefined
                      }
                      key={`${row}-${col}`}
                    >
                      <TileArt tile={hasPlayer ? "p" : cellTile} unstable={isUnstableBoulder} />
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <aside className="grid gap-3 font-mono">
            <div className="border-4 border-[#374f42] bg-[#18231d] p-4 shadow-[6px_6px_0_#070806]">
              <p className="text-xs tracking-[0.16em] text-[#9fb58f] uppercase">Attempt</p>
              <p className="text-5xl font-black text-[#79eada]" data-testid={GAME_GUARDRAIL_TEST_IDS.attemptCounter}>
                {attemptCount ?? "-"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-4 border-[#3f3124] bg-[#231d16] p-3">
                <p className="text-xs tracking-[0.12em] text-[#c9b58a] uppercase">Gems</p>
                <p className="text-2xl font-black text-[#79eada]" data-testid={GAME_GUARDRAIL_TEST_IDS.gemsRemaining}>
                  {String(INITIAL_GEM_COUNT - gameState.collectedGemCount).padStart(2, "0")}
                </p>
              </div>
              <div className="border-4 border-[#3f3124] bg-[#231d16] p-3">
                <p className="text-xs tracking-[0.12em] text-[#c9b58a] uppercase">Score</p>
                <p className="text-2xl font-black text-[#c56cff]" data-testid={GAME_GUARDRAIL_TEST_IDS.score}>
                  {gameState.collectedGemCount * GEM_SCORE_VALUE}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-4 border-[#374f42] bg-[#18231d] p-3">
                <p className="text-xs tracking-[0.12em] text-[#9fb58f] uppercase">Quota</p>
                <p className="text-2xl font-black text-[#79eada]" data-testid={GAME_GUARDRAIL_TEST_IDS.gemQuota}>
                  {String(collectedRequiredGems).padStart(2, "0")}/{String(REQUIRED_GEM_COUNT).padStart(2, "0")}
                </p>
              </div>
              <div className="border-4 border-[#3f3124] bg-[#231d16] p-3">
                <p className="text-xs tracking-[0.12em] text-[#c9b58a] uppercase">Bonus</p>
                <p className="text-2xl font-black text-[#f3b63f]" data-testid={GAME_GUARDRAIL_TEST_IDS.bonusGems}>
                  {collectedBonusGems}/{OPTIONAL_GEM_COUNT}
                </p>
              </div>
            </div>
            <p className="sr-only" data-testid={GAME_GUARDRAIL_TEST_IDS.collectedGems}>
              {gameState.collectedGemCount}
            </p>
            <div className="border-4 border-[#374f42] bg-[#18231d] p-3">
              <p className="text-xs tracking-[0.12em] text-[#9fb58f] uppercase">Input</p>
              <p
                className="text-xl font-black text-[#f3b63f]"
                data-testid={GAME_GUARDRAIL_TEST_IDS.inputResponseMarker}
              >
                {gameState.moveCount}:{gameState.playerPosition.row},{gameState.playerPosition.col}
              </p>
            </div>
            <div
              className={cn(
                "border-4 border-[#3f3124] bg-[#231d16] p-3",
                gameState.status === "lost" && "border-[#b94431] bg-[#2a1713]",
                gameState.status === "won" && "border-[#79eada] bg-[#142621]",
              )}
            >
              <p className="text-xs tracking-[0.12em] text-[#c9b58a] uppercase">Status</p>
              <p
                className={cn(
                  "text-2xl font-black text-[#f3b63f]",
                  gameState.status === "lost" && "text-[#ff705b]",
                  gameState.status === "won" && "text-[#79eada]",
                )}
                data-testid={GAME_GUARDRAIL_TEST_IDS.levelStatus}
              >
                {gameState.status.toUpperCase()}
              </p>
            </div>
            {isTerminalState && (
              <div
                className="fixed right-4 bottom-24 left-4 z-30 border-4 border-[#3f3124] bg-[#191d17] p-3 shadow-[6px_6px_0_#070806] lg:static"
                data-testid={GAME_GUARDRAIL_TEST_IDS.outcomeMessage}
              >
                <p className="mb-3 text-sm leading-snug font-bold text-[#f5e7c8]">{outcomeMessage}</p>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 border-4 border-[#79eada] bg-[#142621] px-3 py-2 font-mono text-sm font-black text-[#79eada] uppercase shadow-[4px_4px_0_#070806] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#070806] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3b63f]"
                  data-testid={GAME_GUARDRAIL_TEST_IDS.replayButton}
                  onClick={handleReplayClick}
                  ref={replayButtonRef}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Play again
                </button>
              </div>
            )}
            <p className="sr-only" aria-live="polite">
              Player at row {gameState.playerPosition.row}, column {gameState.playerPosition.col}.{" "}
              {INITIAL_GEM_COUNT - gameState.collectedGemCount} gems remaining. Score{" "}
              {gameState.collectedGemCount * GEM_SCORE_VALUE}. Quota {collectedRequiredGems} of {REQUIRED_GEM_COUNT}.
              Bonus {collectedBonusGems} of {OPTIONAL_GEM_COUNT}. {unstableBoulderDescription} Status {gameState.status}
              .
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
