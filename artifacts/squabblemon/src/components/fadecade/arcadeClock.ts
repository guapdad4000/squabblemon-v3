import { useEffect, useMemo, useRef, useState } from "react";

export type ArcadeClock = { offset: number; epoch: number };
type ClockStatus = { serverNow: number; resetsAt: string };

export function arcadeClockAt(serverNow: number, receivedAt = Date.now(), epoch = receivedAt): ArcadeClock {
  return { offset: serverNow - receivedAt, epoch };
}

export function arcadeNow(clock: ArcadeClock) {
  return Date.now() + clock.offset;
}

// A daily/weekly reset does not need to render the cabinet every 120/150 ms.
// Recheck on visibility changes as background tabs can throttle their timers.
export function scheduleArcadeReset(clock: ArcadeClock, resetsAt: string, reset: () => void) {
  const deadline = Date.parse(resetsAt);
  if (!Number.isFinite(deadline)) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  function check() {
    if (done) return;
    clearTimeout(timer);
    const remaining = deadline - arcadeNow(clock);
    if (remaining <= 0) {
      done = true;
      reset();
    } else {
      // Native timeouts overflow above ~24 days.
      timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    }
  }
  check();
  document.addEventListener("visibilitychange", check);
  return () => {
    done = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", check);
  };
}

export function useArcadeClock(status: ClockStatus | undefined, refetch: () => unknown) {
  const epoch = useRef(Date.now());
  const clock = useMemo(
    () => {
      const receivedAt = Date.now();
      return arcadeClockAt(status?.serverNow ?? receivedAt, receivedAt, epoch.current);
    },
    [status],
  );
  const refreshedReset = useRef<string | null>(null);
  useEffect(() => {
    if (!status || refreshedReset.current === status.resetsAt) return;
    return scheduleArcadeReset(clock, status.resetsAt, () => {
      refreshedReset.current = status.resetsAt;
      void refetch();
    });
  }, [clock, status, refetch]);
  return clock;
}

// Only active timing widgets subscribe. Keep the original polling resolution,
// including background deadline submission, and catch up immediately on resume.
export function useArcadeNow(clock: ArcadeClock, resolution: number, active = true) {
  const [sample, setSample] = useState(() => ({ clock, now: arcadeNow(clock) }));
  useEffect(() => {
    if (!active) return;
    const update = () => setSample({ clock, now: arcadeNow(clock) });
    update();
    // Responses and newly active widgets must stay on the cabinet's original
    // sampling grid. Restarting a full interval here can make an input open up
    // to one tick later than the old continuously mounted parent clock.
    let interval: ReturnType<typeof setInterval> | undefined;
    const remainder = ((Date.now() - clock.epoch) % resolution + resolution) % resolution;
    const first = setTimeout(() => {
      update();
      interval = setInterval(update, resolution);
    }, resolution - remainder);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [clock, resolution, active]);
  // A fresh response takes effect in this render, not after an effect/tick.
  return !active || sample.clock !== clock ? arcadeNow(clock) : sample.now;
}
