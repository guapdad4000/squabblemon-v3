import { useEffect } from "react";
import {
  chooseLevelUpVoice,
  playEventVoice,
  type EventVoice,
} from "./eventVoice";

export function useEventVoice(
  cue: EventVoice | "level-up" | null,
  eventKey?: string | number,
) {
  useEffect(() => {
    if (!cue) return;
    let stop: (() => void) | undefined;
    // Strict Mode's setup/cleanup probe must not play a second take.
    const timer = window.setTimeout(() => {
      stop = playEventVoice(cue === "level-up" ? chooseLevelUpVoice() : cue);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, [cue, eventKey]);
}
