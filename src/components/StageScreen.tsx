'use client';

import { useEffect, useMemo, useState } from "react";
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
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
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
  const totalPages = useRoundStore((state) => state.totalPages);
  const winner = useRoundStore((state) => state.winner);
  const phase = useRoundStore((state) => state.phase);
  const resumeAt = useRoundStore((state) => state.resumeAt);
  const answerKey = useRoundStore((state) => state.answerKey);
  const currentPageIndex = useRoundStore((state) => state.currentPageIndex);

  const [timestamp, setTimestamp] = useState(() => Date.now());

  const currentPageLabel = useMemo(() => {
    if (totalPages === 0) {
      return "Preparing deck…";
    }
    return `Question ${currentPageIndex + 1} of ${totalPages}`;
  }, [currentPageIndex, totalPages]);

  useEffect(() => {
    if (phase !== "passDelay" || !resumeAt) {
      return undefined;
    }
    const frameId = window.requestAnimationFrame(() => {
      setTimestamp(Date.now());
    });
    const intervalId = window.setInterval(() => {
      setTimestamp(Date.now());
    }, 50);
    return () => {
      window.clearInterval(intervalId);
      window.cancelAnimationFrame(frameId);
    };
  }, [phase, resumeAt]);

  const passCountdown =
    phase === "passDelay" && resumeAt
      ? Math.max(0, resumeAt - timestamp)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-black px-5 py-6 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-1 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-indigo-300">
            The Floor
          </p>
          <h1 className="text-2xl font-semibold text-white">
            {topic?.name ?? "Loading Round"}
          </h1>
          <p className="text-xs text-indigo-200">{currentPageLabel}</p>
        </header>

        <section className="grid w-full gap-4 md:grid-cols-2">
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
                className={`rounded-3xl border border-white/10 bg-white/10 p-4 shadow-lg transition ${
                  isActive ? "border-indigo-300 shadow-indigo-500/30" : ""
                } ${hasLost ? "opacity-60" : ""}`}
              >
                <p className="text-[10px] uppercase tracking-[0.35em] text-indigo-200">
                  {playerLabels[role]}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    {player.name || "—"}
                  </h2>
                  <span
                    className={`rounded-xl px-3 py-1 text-xl font-mono tabular-nums ${
                      isActive ? "bg-indigo-500 text-white" : "bg-white/20"
                    }`}
                  >
                    {formatMs(player.remainingMs)}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
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
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-indigo-200">
                  <span>
                    Switches used: {player.switchesUsed} / 3
                  </span>
                  {phase === "passDelay" && activePlayer === role && resumeAt ? (
                    <span className="font-semibold uppercase tracking-wide text-rose-200">
                      Penalty {(passCountdown / 1000).toFixed(1)}s
                    </span>
                  ) : isActive ? (
                    <span className="font-semibold uppercase tracking-wide text-indigo-100">
                      Active
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <main className="flex-1">
          <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center rounded-3xl bg-white/90 p-4 shadow-2xl">
            <PdfSlideViewer
              filePath={topic?.filePath ?? null}
              pageIndex={currentPageIndex}
            />
          </div>
          {phase === "complete" && winner && (
            <div className="mt-2 text-center text-base font-semibold text-emerald-300">
              {players[winner].name} wins the round!
            </div>
          )}
          {phase === "passDelay" && resumeAt && (
            <div className="mt-2 text-center text-base font-semibold text-rose-200">
              {answerKey[currentPageIndex] ?? "—"}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
