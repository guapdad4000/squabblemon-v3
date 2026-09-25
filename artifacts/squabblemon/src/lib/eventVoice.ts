import {
  FEEDBACK_CHANGE_EVENT,
  loadFeedbackPreferences,
  type FeedbackPreferences,
} from "../battleFeedback";

export const LEVEL_UP_VOICES = [
  "level-good-money",
  "level-hands",
  "level-pressure",
] as const;
export type EventVoice =
  (typeof LEVEL_UP_VOICES)[number] | "training-welcome" | "friendly-fade";
const PUBLIC_BASE = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

export function chooseLevelUpVoice(
  random = Math.random,
): (typeof LEVEL_UP_VOICES)[number] {
  return LEVEL_UP_VOICES[
    Math.min(
      LEVEL_UP_VOICES.length - 1,
      Math.floor(random() * LEVEL_UP_VOICES.length),
    )
  ];
}

let stopActive: (() => void) | undefined;

/** A single screen-owned cue, never a playlist. Leaving or muting discards it. */
export function playEventVoice(name: EventVoice): () => void {
  stopActive?.();
  if (
    typeof Audio === "undefined" ||
    typeof document === "undefined" ||
    document.hidden ||
    !loadFeedbackPreferences().audioEnabled
  )
    return () => {};
  const extension = document
    .createElement("audio")
    .canPlayType('audio/ogg; codecs="vorbis"')
    ? "ogg"
    : "m4a";
  const audio = new Audio(
    `${PUBLIC_BASE}audio/voice/dr-fade/events/${name}.${extension}`,
  );
  audio.volume = 0.95;
  audio.preload = "auto";
  let disposed = false;
  let pending = false;

  function stop() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener("pointerup", play);
    document.removeEventListener("keydown", play);
    document.removeEventListener("visibilitychange", visibilityChanged);
    window.removeEventListener(FEEDBACK_CHANGE_EVENT, preferencesChanged);
    audio.removeEventListener("ended", stop);
    audio.removeEventListener("error", stop);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (stopActive === stop) stopActive = undefined;
  }
  function play() {
    if (disposed || pending || !audio.paused) return;
    if (document.hidden || !loadFeedbackPreferences().audioEnabled) {
      stop();
      return;
    }
    pending = true;
    void audio
      .play()
      .then(() => {
        pending = false;
        if (disposed) audio.pause();
        // Once it starts, a later gesture must not restart the same line.
        document.removeEventListener("pointerup", play);
        document.removeEventListener("keydown", play);
      })
      .catch((error: unknown) => {
        pending = false;
        if (disposed) return;
        if (!(error instanceof Error) || error.name !== "NotAllowedError")
          stop();
        // Autoplay denial retries this same clip on the next gesture while its screen is open.
      });
  }
  function visibilityChanged() {
    if (document.hidden) stop();
  }
  function preferencesChanged(event: Event) {
    if (!(event as CustomEvent<FeedbackPreferences>).detail.audioEnabled)
      stop();
  }
  stopActive = stop;
  audio.addEventListener("ended", stop);
  audio.addEventListener("error", stop);
  document.addEventListener("pointerup", play);
  document.addEventListener("keydown", play);
  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener(FEEDBACK_CHANGE_EVENT, preferencesChanged);
  play();
  return stop;
}
