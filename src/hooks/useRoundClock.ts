import { useEffect } from "react";
import { useRoundStore } from "../state/roundStore";

const TICK_INTERVAL_MS = 100;

export const useRoundClock = () => {
  const phase = useRoundStore((state) => state.phase);
  const tick = useRoundStore((state) => state.tick);

  useEffect(() => {
    if (phase !== "running" && phase !== "passDelay") {
      return;
    }

    tick(Date.now());
    const intervalId = window.setInterval(() => {
      tick(Date.now());
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [phase, tick]);
};
