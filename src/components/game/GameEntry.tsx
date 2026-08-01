import { useEffect, useRef, useState } from "react";

import { GAME_GUARDRAIL_TEST_IDS, incrementGameAttemptCount } from "@/lib/game-guardrails";
import { cn } from "@/lib/utils";

const LEVEL_ROWS = [
  "############",
  "#..g....r..#",
  "#.###..##..#",
  "#..p....g..#",
  "#.....##...#",
  "#..r...g.e.#",
  "#..........#",
  "############",
] as const;

type Tile = "." | "#" | "g" | "p" | "r" | "e";
interface Coordinate {
  row: number;
  col: number;
}

interface BoardCell {
  tile: Tile;
  row: number;
  col: number;
}

interface GameState {
  playerPosition: Coordinate;
  moveCount: number;
  collectedGemKeys: string[];
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

const TILE_STYLES: Record<Tile, string> = {
  ".": "bg-[#2f3b2d] shadow-[inset_0_0_0_1px_rgba(196,217,142,0.08)]",
  "#": "bg-[#5c4a36] shadow-[inset_0_-4px_0_rgba(0,0,0,0.35),inset_0_3px_0_rgba(245,231,200,0.08)]",
  g: "bg-[#183840] shadow-[inset_0_0_0_2px_rgba(121,234,218,0.22),0_0_12px_rgba(121,234,218,0.22)]",
  p: "bg-[#f3b63f] shadow-[inset_0_-5px_0_rgba(63,49,36,0.35),0_0_16px_rgba(243,182,63,0.35)]",
  r: "bg-[#76716a] shadow-[inset_0_-5px_0_rgba(0,0,0,0.32),inset_0_3px_0_rgba(255,255,255,0.12)]",
  e: "bg-[#6d3ab7] shadow-[inset_0_0_0_2px_rgba(245,231,200,0.18),0_0_16px_rgba(170,102,255,0.35)]",
};

function parseLevelRows(): BoardCell[][] {
  return LEVEL_ROWS.map((row, rowIndex) =>
    (row.split("") as Tile[]).map((tile, colIndex) => ({
      tile,
      row: rowIndex,
      col: colIndex,
    })),
  );
}

function flattenBoard(board: BoardCell[][]): BoardCell[] {
  return board.flat();
}

function findPlayerStart(board: BoardCell[][]): Coordinate {
  for (const row of board) {
    const playerCell = row.find((cell) => cell.tile === "p");
    if (playerCell) {
      return { row: playerCell.row, col: playerCell.col };
    }
  }

  return { row: 0, col: 0 };
}

function countGems(board: BoardCell[][]): number {
  return flattenBoard(board).filter((cell) => cell.tile === "g").length;
}

function getTileAt(position: Coordinate): Tile | null {
  return LEVEL_BOARD[position.row]?.[position.col]?.tile ?? null;
}

function isSameCoordinate(a: Coordinate, b: Coordinate): boolean {
  return a.row === b.row && a.col === b.col;
}

function isWalkable(tile: Tile | null): boolean {
  return tile === "." || tile === "g" || tile === "e" || tile === "p";
}

function getPositionKey(position: Coordinate): string {
  return `${position.row}:${position.col}`;
}

function resolveMove(currentState: GameState, delta: Coordinate): MoveResult {
  const nextPosition = {
    row: currentState.playerPosition.row + delta.row,
    col: currentState.playerPosition.col + delta.col,
  };

  const nextTile = getTileAt(nextPosition);
  if (!isWalkable(nextTile)) {
    return { state: currentState, accepted: false };
  }

  const nextPositionKey = getPositionKey(nextPosition);
  const collectedGemKeys =
    nextTile === "g" && !currentState.collectedGemKeys.includes(nextPositionKey)
      ? [...currentState.collectedGemKeys, nextPositionKey]
      : currentState.collectedGemKeys;

  return {
    accepted: true,
    state: {
      playerPosition: nextPosition,
      moveCount: currentState.moveCount + 1,
      collectedGemKeys,
    },
  };
}

const LEVEL_BOARD = parseLevelRows();
const LEVEL_CELLS = flattenBoard(LEVEL_BOARD);
const PLAYER_START = findPlayerStart(LEVEL_BOARD);
const INITIAL_GEM_COUNT = countGems(LEVEL_BOARD);

export default function GameEntry() {
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    playerPosition: PLAYER_START,
    moveCount: 0,
    collectedGemKeys: [],
  });
  const countedAttemptRef = useRef(false);

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
      setGameState((currentState) => {
        const moveResult = resolveMove(currentState, delta);
        return moveResult.state;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
          <div className="border-4 border-[#3f3124] bg-[#171a15] p-3 shadow-[10px_10px_0_#070806] sm:p-5">
            <div
              aria-label="BoulderGame level board with player start, gems, rocks, and an open exit."
              className="grid grid-cols-12 gap-1 border-4 border-[#5c4a36] bg-[#0b0e0a] p-2"
              data-testid={GAME_GUARDRAIL_TEST_IDS.board}
              role="img"
            >
              {LEVEL_CELLS.map((cell) => {
                const hasPlayer = isSameCoordinate(cell, gameState.playerPosition);
                const isCollectedGem = cell.tile === "g" && gameState.collectedGemKeys.includes(getPositionKey(cell));
                const tile = hasPlayer ? "p" : cell.tile === "p" || isCollectedGem ? "." : cell.tile;

                return (
                  <div
                    aria-hidden="true"
                    className={cn("aspect-square min-h-0 rounded-[2px]", TILE_STYLES[tile])}
                    data-col={cell.col}
                    data-row={cell.row}
                    data-testid={hasPlayer ? GAME_GUARDRAIL_TEST_IDS.player : undefined}
                    key={`${cell.row}-${cell.col}`}
                  />
                );
              })}
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
                  {String(INITIAL_GEM_COUNT - gameState.collectedGemKeys.length).padStart(2, "0")}
                </p>
              </div>
              <div className="border-4 border-[#3f3124] bg-[#231d16] p-3">
                <p className="text-xs tracking-[0.12em] text-[#c9b58a] uppercase">Score</p>
                <p className="text-2xl font-black text-[#c56cff]" data-testid={GAME_GUARDRAIL_TEST_IDS.score}>
                  {gameState.collectedGemKeys.length * GEM_SCORE_VALUE}
                </p>
              </div>
            </div>
            <p className="sr-only" data-testid={GAME_GUARDRAIL_TEST_IDS.collectedGems}>
              {gameState.collectedGemKeys.length}
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
            <p className="sr-only" aria-live="polite">
              Player at row {gameState.playerPosition.row}, column {gameState.playerPosition.col}.{" "}
              {INITIAL_GEM_COUNT - gameState.collectedGemKeys.length} gems remaining. Score{" "}
              {gameState.collectedGemKeys.length * GEM_SCORE_VALUE}.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
