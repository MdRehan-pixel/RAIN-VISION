import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplayStep } from "@/lib/historical";

export type ReplayState = "IDLE" | "PLAYING" | "PAUSED" | "COMPLETE";
const STEP_INTERVAL_MS = 550;

/** Deterministic step-through player for historical replay timesteps (no randomness, no live data). */
export function useReplayPlayer(steps: ReplayStep[], resetKey: string | null) {
  const [stepIndex, setStepIndex] = useState(-1);
  const [state, setState] = useState<ReplayState>("IDLE");
  const timer = useRef<number | null>(null);
  const total = steps.length;

  const stop = useCallback(() => { if (timer.current !== null) { window.clearInterval(timer.current); timer.current = null; } }, []);
  const reset = useCallback(() => { stop(); setStepIndex(-1); setState("IDLE"); }, [stop]);
  const play = useCallback(() => {
    if (!total) return;
    stop();
    setState("PLAYING");
    setStepIndex((index) => (index < 0 ? 0 : index));
    timer.current = window.setInterval(() => {
      setStepIndex((index) => {
        if (index >= total - 1) { stop(); setState("COMPLETE"); return index; }
        return index + 1;
      });
    }, STEP_INTERVAL_MS);
  }, [stop, total]);
  const pause = useCallback(() => { stop(); setState("PAUSED"); }, [stop]);
  const next = useCallback(() => {
    stop();
    setStepIndex((index) => { const value = Math.min(index + 1, total - 1); setState(value >= total - 1 ? "COMPLETE" : "PAUSED"); return value; });
  }, [stop, total]);
  const run = useCallback(() => { reset(); window.setTimeout(play, 0); }, [play, reset]);

  useEffect(() => stop, [stop]);
  useEffect(() => { reset(); }, [reset, resetKey]);

  return { stepIndex, state, play, pause, next, reset, run, current: stepIndex >= 0 ? steps[stepIndex] : undefined, shown: stepIndex >= 0 ? steps.slice(0, stepIndex + 1) : [] };
}
