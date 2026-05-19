import { useEffect, useState } from 'react';

/**
 * Visual-only countdown derived from server phaseEndsAt.
 * Does NOT drive gameplay transitions.
 */
export function useQuizWavePhaseTimer(phaseEndsAt: number | undefined, enabled = true): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!enabled || !phaseEndsAt) {
      setSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000));
      setSeconds(remaining);
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phaseEndsAt, enabled]);

  return seconds;
}

/** Elapsed ms within current phase (for sub-step UI like distribution before reveal). */
export function usePhaseElapsed(phaseStartedAt: number | undefined, enabled = true): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled || !phaseStartedAt) {
      setElapsed(0);
      return;
    }

    const tick = () => setElapsed(Math.max(0, Date.now() - phaseStartedAt));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phaseStartedAt, enabled]);

  return elapsed;
}
