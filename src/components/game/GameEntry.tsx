import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

import { motionKey, type Coordinate } from "@/lib/boulder-simulation";
import { resolveGameClock, type GameClock } from "@/lib/game-clock";
import {
  MOVE_DELTAS,
  applySimulation,
  createInitialGameState,
  isExitOpen,
  isSameCoordinate,
  resolveMove,
  type GameState,
} from "@/lib/game-rules";
import { playBoulderThud, playGemChime, playLevelWin, playMinerCrush, playSpikesHit } from "@/lib/game-audio";
import { GAME_GUARDRAIL_TEST_IDS, incrementGameAttemptCount } from "@/lib/game-guardrails";
import { GEM_SCORE_VALUE, readHighScore, recordHighScore } from "@/lib/game-score";
import { LEVELS, nextLevelAfter, parseLevel } from "@/lib/levels";
import { cn } from "@/lib/utils";

import { TileArt, TileDefs } from "./TileArt";

/** Key bindings onto the cave's four moves. The rules own the directions; this owns the keyboard. */
const MOVE_KEYS: Partial<Record<string, Coordinate>> = {
  ArrowUp: MOVE_DELTAS.up,
  w: MOVE_DELTAS.up,
  W: MOVE_DELTAS.up,
  ArrowDown: MOVE_DELTAS.down,
  s: MOVE_DELTAS.down,
  S: MOVE_DELTAS.down,
  ArrowLeft: MOVE_DELTAS.left,
  a: MOVE_DELTAS.left,
  A: MOVE_DELTAS.left,
  ArrowRight: MOVE_DELTAS.right,
  d: MOVE_DELTAS.right,
  D: MOVE_DELTAS.right,
};

export default function GameEntry() {
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(parseLevel(LEVELS[0])));
  /** Points from caves already cleared this run. The active cave's gems are added on top, so
   * replaying a cave rewinds only that cave's points. */
  const [bankedScore, setBankedScore] = useState(0);
  /** Seeded from storage on the first render, which this island only ever does in the browser, then
   * raised as the run climbs. State rather than a derived maximum: a replay rewinds the score, and
   * the record must not rewind with it. */
  const [highScore, setHighScore] = useState(() => readHighScore());
  const countedAttemptRef = useRef(false);
  const replayButtonRef = useRef<HTMLButtonElement | null>(null);
  const gameClockRef = useRef<GameClock | null>(null);
  const soundStateRef = useRef<Pick<GameState, "boulderLandingCount" | "collectedGemCount" | "status">>({
    boulderLandingCount: 0,
    collectedGemCount: 0,
    status: "active",
  });

  const totalScore = bankedScore + gameState.collectedGemCount * GEM_SCORE_VALUE;
  // Beating the record shows immediately, without waiting for a reload to read it back. Adjusting
  // state during render rather than in an effect keeps the HUD from painting the stale record first.
  if (totalScore > highScore) {
    setHighScore(totalScore);
  }

  useEffect(() => {
    if (countedAttemptRef.current) {
      return;
    }

    countedAttemptRef.current = true;
    setAttemptCount(incrementGameAttemptCount());
  }, []);

  // Persisted as the run climbs rather than at a win, so a later loss cannot erase the record.
  useEffect(() => {
    recordHighScore(totalScore);
  }, [totalScore]);

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

  useEffect(() => {
    const previous = soundStateRef.current;

    const justLost = gameState.status === "lost" && previous.status !== "lost";
    // The crushing boulder settles in the same update, so the crush slam replaces the plain thud.
    const justCrushed = justLost && gameState.lossCause === "crushed";

    // Strictly greater: a replay or level advance resets the counters to zero, which must stay
    // silent rather than read as an event.
    if (gameState.boulderLandingCount > previous.boulderLandingCount && !justCrushed) {
      playBoulderThud();
    }
    if (gameState.collectedGemCount > previous.collectedGemCount) {
      playGemChime();
    }
    if (gameState.status === "won" && previous.status !== "won") {
      playLevelWin();
    }
    if (justCrushed) {
      playMinerCrush();
    } else if (justLost && gameState.lossCause === "spikes") {
      playSpikesHit();
    }

    soundStateRef.current = {
      boulderLandingCount: gameState.boulderLandingCount,
      collectedGemCount: gameState.collectedGemCount,
      status: gameState.status,
    };
  }, [gameState.boulderLandingCount, gameState.collectedGemCount, gameState.status, gameState.lossCause]);

  function handleReplayClick(): void {
    // Clearing the last cave ends the run, so a replay there starts the game over from the first
    // cave with a fresh score. A loss still replays the cave that was lost, wherever it sits.
    if (hasClearedFinalLevel) {
      setBankedScore(0);
      setGameState(createInitialGameState(parseLevel(LEVELS[0])));
    } else {
      setGameState((currentState) => createInitialGameState(currentState.level));
    }

    setAttemptCount(incrementGameAttemptCount());
  }

  function handleNextLevelClick(): void {
    const next = nextLevelAfter(gameState.level.definition);
    if (!next) {
      return;
    }

    // Clearing a cave banks its gems: the next cave starts from a fresh board but not a fresh score.
    setBankedScore((currentBankedScore) => currentBankedScore + gameState.collectedGemCount * GEM_SCORE_VALUE);
    setGameState(createInitialGameState(parseLevel(next)));
    // Advancing is a fresh run of the game, so it counts the same as a replay.
    setAttemptCount(incrementGameAttemptCount());
  }

  const level = gameState.level;
  const requiredGemCount = level.definition.requiredGemCount;
  const optionalGemCount = level.gemCount - requiredGemCount;
  // The rules' own answer, not a second copy of the threshold: the bars are drawn exactly when
  // `resolveMove` would refuse the step.
  const isExitLocked = !isExitOpen(level, gameState.collectedGemCount);
  const isTerminalState = gameState.status !== "active";
  // Offered on a win only: a lost level is replayed, not skipped.
  const hasNextLevel = gameState.status === "won" && nextLevelAfter(level.definition) !== null;
  const hasClearedFinalLevel = gameState.status === "won" && nextLevelAfter(level.definition) === null;
  const outcomeMessage =
    gameState.status === "won"
      ? hasNextLevel
        ? "Level complete. A deeper cave is open."
        : "Every cave cleared. Play again from the first?"
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
              aria-label="BoulderGame cave of diggable dirt, with the miner, gems, boulders, spikes and an exit that stays barred until the gem quota is met."
              className="grid grid-cols-12 gap-1 border-4 border-[#6b5540] bg-[#070a06] p-2"
              data-testid={GAME_GUARDRAIL_TEST_IDS.board}
              role="img"
            >
              {gameState.board.flatMap((boardRow, row) =>
                boardRow.map((cellTile, col) => {
                  // A lost Miner is gone: the tile that killed them — the spikes stepped on or the
                  // boulder that landed — shows in their place.
                  const hasPlayer =
                    gameState.status !== "lost" && isSameCoordinate({ row, col }, gameState.playerPosition);
                  const isUnstableBoulder =
                    cellTile === "r" && gameState.boulderMotions.get(motionKey(row, col))?.phase === "grace";

                  return (
                    <div
                      aria-hidden="true"
                      className="aspect-square min-h-0 overflow-hidden rounded-[2px]"
                      data-col={col}
                      // Only the exit carries it: the sealed look is otherwise invisible to a
                      // test, since the difference lives entirely inside the tile's SVG.
                      data-exit-locked={cellTile === "e" ? String(isExitLocked) : undefined}
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
                      <TileArt tile={hasPlayer ? "p" : cellTile} unstable={isUnstableBoulder} locked={isExitLocked} />
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
                  {totalScore}
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
            {/* Off-screen but still rendered: the input-latency guardrail reads this marker, and the
                panel it used to fill now shows the record instead. */}
            <p className="sr-only" data-testid={GAME_GUARDRAIL_TEST_IDS.inputResponseMarker}>
              {gameState.moveCount}:{gameState.playerPosition.row},{gameState.playerPosition.col}
            </p>
            <div className="border-4 border-[#374f42] bg-[#18231d] p-3">
              <p className="text-xs tracking-[0.12em] text-[#9fb58f] uppercase">High score</p>
              <p className="text-xl font-black text-[#f3b63f]" data-testid={GAME_GUARDRAIL_TEST_IDS.highScore}>
                {highScore}
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
                    className="mb-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 border-4 border-[#f3b63f] bg-[#2a2113] px-3 py-2 font-mono text-sm font-black text-[#f3b63f] uppercase shadow-[4px_4px_0_#070806] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#070806] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#79eada]"
                    data-testid={GAME_GUARDRAIL_TEST_IDS.nextLevelButton}
                    onClick={handleNextLevelClick}
                    type="button"
                  >
                    <ArrowRight aria-hidden="true" className="size-4" />
                    Next cave
                  </button>
                )}
                <button
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 border-4 border-[#79eada] bg-[#142621] px-3 py-2 font-mono text-sm font-black text-[#79eada] uppercase shadow-[4px_4px_0_#070806] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#070806] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3b63f]"
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
              {level.gemCount - gameState.collectedGemCount} gems remaining. Score {totalScore}. High score {highScore}.
              Quota {collectedRequiredGems} of {requiredGemCount}. Bonus {collectedBonusGems} of {optionalGemCount}.{" "}
              {unstableBoulderDescription} Status {gameState.status}.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
