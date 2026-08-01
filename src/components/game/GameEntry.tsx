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

const TILE_STYLES: Record<Tile, string> = {
  ".": "bg-[#2f3b2d] shadow-[inset_0_0_0_1px_rgba(196,217,142,0.08)]",
  "#": "bg-[#5c4a36] shadow-[inset_0_-4px_0_rgba(0,0,0,0.35),inset_0_3px_0_rgba(245,231,200,0.08)]",
  g: "bg-[#183840] shadow-[inset_0_0_0_2px_rgba(121,234,218,0.22),0_0_12px_rgba(121,234,218,0.22)]",
  p: "bg-[#f3b63f] shadow-[inset_0_-5px_0_rgba(63,49,36,0.35),0_0_16px_rgba(243,182,63,0.35)]",
  r: "bg-[#76716a] shadow-[inset_0_-5px_0_rgba(0,0,0,0.32),inset_0_3px_0_rgba(255,255,255,0.12)]",
  e: "bg-[#6d3ab7] shadow-[inset_0_0_0_2px_rgba(245,231,200,0.18),0_0_16px_rgba(170,102,255,0.35)]",
};

function flattenLevel(): Tile[] {
  return LEVEL_ROWS.flatMap((row) => row.split("") as Tile[]);
}

const LEVEL_TILES = flattenLevel();

export default function GameEntry() {
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const countedAttemptRef = useRef(false);

  useEffect(() => {
    if (countedAttemptRef.current) {
      return;
    }

    countedAttemptRef.current = true;
    setAttemptCount(incrementGameAttemptCount());
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
              aria-label="Static BoulderGame level preview with a player, gems, rocks, and an open exit."
              className="grid grid-cols-12 gap-1 border-4 border-[#5c4a36] bg-[#0b0e0a] p-2"
              role="img"
            >
              {LEVEL_TILES.map((tile, index) => (
                <div
                  aria-hidden="true"
                  className={cn("aspect-square min-h-0 rounded-[2px]", TILE_STYLES[tile])}
                  key={`${tile}-${index}`}
                />
              ))}
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
                <p className="text-2xl font-black text-[#79eada]">03</p>
              </div>
              <div className="border-4 border-[#3f3124] bg-[#231d16] p-3">
                <p className="text-xs tracking-[0.12em] text-[#c9b58a] uppercase">Exit</p>
                <p className="text-2xl font-black text-[#c56cff]">OPEN</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
