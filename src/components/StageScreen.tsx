'use client';

import { useMemo } from "react";
import { PdfSlideViewer } from "@/components/PdfSlideViewer";
import { useRoundSync } from "@/hooks/useRoundSync";
import {
  ROUND_DURATION_MS,
  type PlayerRole,
  useRoundStore,
} from "@/state/roundStore";

const formatMs = (value: number) => {
  const clamped = Math.max(0, Math.floor(value));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const toPercentRemaining = (value: number) =>
  Math.max(0, Math.min(100, (value / ROUND_DURATION_MS) * 100));

const playerLabels: Record<PlayerRole, string> = {
  challenger: "Challenger",
  challengee: "Challengee",
};

export const StageScreen = () => {
  useRoundSync("stage");

  const topic = useRoundStore((state) => state.topic);
  const players = useRoundStore((state) => state.players);
  const activePlayer = useRoundStore((state) => state.activePlayer);
  const currentPageIndex = useRoundStore((state) => state.currentPageIndex);
  const totalPages = useRoundStore((state) => state.totalPages);
  const winner = useRoundStore((state) => state.winner);
  const phase = useRoundStore((state) => state.phase);

  const currentPageLabel = useMemo(() => {
    if (totalPages === 0) {
      return "Preparing deck…";
    }
    return `Question ${currentPageIndex + 1} of ${totalPages}`;
  }, [currentPageIndex, totalPages]);

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-black px-10 py-12 text-white">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-indigo-300">
          The Floor
        </p>
        <h1 className="text-4xl font-semibold text-white">
          {topic?.name ?? "Loading Round"}
        </h1>
        <p className="text-base text-indigo-200">{currentPageLabel}</p>
      </header>

      <section className="grid w-full gap-6 md:grid-cols-2">
        {(
          Object.entries(players) as Array<
            [PlayerRole, (typeof players)[PlayerRole]]
          >
        ).map(([role, player]) => {
          const isActive = activePlayer === role && phase === "running";
          const barPercent = toPercentRemaining(player.remainingMs);
          const hasLost = phase === "complete" && winner !== role;
          return (
            <div
              key={role}
              className={`rounded-3xl border border-white/10 bg-white/10 p-6 shadow-lg transition ${
                isActive ? "border-indigo-300 shadow-indigo-500/30" : ""
              } ${hasLost ? "opacity-60" : ""}`}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">
                {playerLabels[role]}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-white">
                  {player.name || "—"}
                </h2>
                <span
                  className={`rounded-xl px-5 py-2 text-3xl font-mono ${
                    isActive ? "bg-indigo-500 text-white" : "bg-white/20"
                  }`}
                >
                  {formatMs(player.remainingMs)}
                </span>
              </div>
              <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    barPercent > 33
                      ? "bg-green-400"
                      : barPercent > 15
                      ? "bg-amber-400"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>

      <main className="flex-1">
        <div className="mx-auto flex h-full max-w-5xl items-center justify-center rounded-3xl bg-white/90 p-6 shadow-2xl">
          <PdfSlideViewer
            filePath={topic?.filePath ?? null}
            pageIndex={currentPageIndex}
          />
        </div>
        {phase === "complete" && winner && (
          <div className="mt-4 text-center text-xl font-semibold text-emerald-300">
            {players[winner].name} wins the round!
          </div>
        )}
      </main>
    </div>
  );
};
