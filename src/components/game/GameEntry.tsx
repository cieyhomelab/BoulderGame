import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

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
import { LEVELS, nextLevelAfter, parseLevel, type ParsedLevel } from "@/lib/levels";
import { cn } from "@/lib/utils";

import { TileArt, TileDefs, type Tile } from "./TileArt";

type LevelStatus = "active" | "lost" | "won";
/** Why the level was lost. The status set stays `active | lost | won`; being crushed is a new
 * cause of the existing losing status, not a new status value. */
type LossCause = "spikes" | "crushed";
type Coordinate = SimulationCoordinate;

interface GameState {
  /** The level being played. Held in state rather than module scope so the keyboard handler's
   * functional update reads the active level instead of a stale closure over the first one. */
  level: ParsedLevel;
  board: Board;
  boulderMotions: BoulderMotions;
  playerPosition: Coordinate;
  moveCount: number;
  collectedGemCount: number;
  status: LevelStatus;
  lossCause: LossCause | null;
}

interface MoveResult {
  state: GameState;
  accepted: boolean;
}

const GEM_SCORE_VALUE = 100;
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

  // A boulder that moved into the Miner's tile crushes them. Compared against the position in the
  // state the step was applied to, so a boulder dropping into a tile the Miner just left is safe.
  const crushed = result.landedOn.some((coordinate) => isSameCoordinate(coordinate, currentState.playerPosition));

  return {
    ...currentState,
    board: result.board,
    boulderMotions: result.boulderMotions,
    status: crushed ? "lost" : currentState.status,
    lossCause: crushed ? "crushed" : currentState.lossCause,
  };
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
    nextTile === "h"
      ? "lost"
      : nextTile === "e" && collectedGemCount >= currentState.level.definition.requiredGemCount
        ? "won"
        : "active";

  const movedState: GameState = {
    ...currentState,
    board,
    playerPosition: nextPosition,
    moveCount: currentState.moveCount + 1,
    collectedGemCount,
    status,
    lossCause: status === "lost" ? "spikes" : currentState.lossCause,
  };

  // The cave re-evaluates support after every board change, so digging registers instability in
  // the same update that produced the hole rather than a frame later.
  return { accepted: true, state: applySimulation(movedState, nowMs) };
}

function createInitialGameState(level: ParsedLevel): GameState {
  return {
    level,
    // Row-level copy: a shallow copy of the outer array alone would let a dug corridor leak
    // from one attempt into the next.
    board: level.template.map((row) => [...row]),
    boulderMotions: NO_BOULDER_MOTIONS,
    playerPosition: level.playerStart,
    moveCount: 0,
    collectedGemCount: 0,
    status: "active",
    lossCause: null,
  };
}

export default function GameEntry() {
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(parseLevel(LEVELS[0])));
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
    setGameState((currentState) => createInitialGameState(currentState.level));
    setAttemptCount(incrementGameAttemptCount());
  }

  function handleNextLevelClick(): void {
    setGameState((currentState) => {
      const next = nextLevelAfter(currentState.level.definition);

      return next ? createInitialGameState(parseLevel(next)) : currentState;
    });
    // Advancing is a fresh run of the game, so it counts the same as a replay.
    setAttemptCount(incrementGameAttemptCount());
  }

  const level = gameState.level;
  const requiredGemCount = level.definition.requiredGemCount;
  const optionalGemCount = level.gemCount - requiredGemCount;
  const isTerminalState = gameState.status !== "active";
  // Offered on a win only: a lost level is replayed, not skipped.
  const hasNextLevel = gameState.status === "won" && nextLevelAfter(level.definition) !== null;
  const outcomeMessage =
    gameState.status === "won"
      ? hasNextLevel
        ? "Level complete. A deeper cave is open."
        : "Level complete. Play again?"
      : gameState.status === "lost"
        ? gameState.lossCause === "crushed"
          ? "Failed — crushed by a falling boulder. Play again?"
          : "Cave-in. Play again?"
        : null;
  const collectedRequiredGems = Math.min(gameState.collectedGemCount, requiredGemCount);
  const collectedBonusGems = Math.max(gameState.collectedGemCount - requiredGemCount, 0);
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
            <p className="text-xs tracking-[0.16em] text-[#9fb58f] uppercase">{level.definition.name}</p>
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
                  {String(level.gemCount - gameState.collectedGemCount).padStart(2, "0")}
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
                  {String(collectedRequiredGems).padStart(2, "0")}/{String(requiredGemCount).padStart(2, "0")}
                </p>
              </div>
              <div className="border-4 border-[#3f3124] bg-[#231d16] p-3">
                <p className="text-xs tracking-[0.12em] text-[#c9b58a] uppercase">Bonus</p>
                <p className="text-2xl font-black text-[#f3b63f]" data-testid={GAME_GUARDRAIL_TEST_IDS.bonusGems}>
                  {collectedBonusGems}/{optionalGemCount}
                </p>
              </div>
            </div>
            <p className="sr-only" data-testid={GAME_GUARDRAIL_TEST_IDS.collectedGems}>
              {gameState.collectedGemCount}
            </p>
            <p className="sr-only" data-testid={GAME_GUARDRAIL_TEST_IDS.lossCause}>
              {gameState.lossCause ?? "none"}
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
                {hasNextLevel && (
                  <button
                    className="mb-2 inline-flex w-full items-center justify-center gap-2 border-4 border-[#f3b63f] bg-[#2a2113] px-3 py-2 font-mono text-sm font-black text-[#f3b63f] uppercase shadow-[4px_4px_0_#070806] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#070806] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#79eada]"
                    data-testid={GAME_GUARDRAIL_TEST_IDS.nextLevelButton}
                    onClick={handleNextLevelClick}
                    type="button"
                  >
                    <ArrowRight aria-hidden="true" className="size-4" />
                    Next cave
                  </button>
                )}
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
              {level.gemCount - gameState.collectedGemCount} gems remaining. Score{" "}
              {gameState.collectedGemCount * GEM_SCORE_VALUE}. Quota {collectedRequiredGems} of {requiredGemCount}.
              Bonus {collectedBonusGems} of {optionalGemCount}. {unstableBoulderDescription} Status {gameState.status}.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
