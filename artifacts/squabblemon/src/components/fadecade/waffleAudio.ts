export type WaffleSound = "hop" | "battle" | "move" | "win" | "end";

const notes: Record<WaffleSound, readonly number[]> = {
  hop: [440, 660, 880],
  win: [523, 659, 784, 1046],
  battle: [196, 147, 98],
  end: [330, 247, 165],
  move: [220, 110],
};

function browserContext() {
  const Context = window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Context ? new Context() : null;
}

// Each cabinet owns one context, but each sound keeps its own gain and notes:
// overlapping hop/phase sounds remain independent, at the original volume.
export function createWaffleAudio(createContext: () => AudioContext | null = browserContext) {
  type Session = { context: AudioContext; voices: Set<() => void>; detached: boolean };
  let session: Session | null = null;
  function closeWhenFinished(previous: Session) {
    if (previous.detached && !previous.voices.size && previous.context.state !== "closed") {
      try { void previous.context.close().catch(() => {}); } catch {}
    }
  }
  function unlock() {
    try {
      if (!session || session.context.state === "closed") {
        const context = createContext();
        session = context ? { context, voices: new Set(), detached: false } : null;
      }
      const audio = session?.context;
      // Safari can interrupt a context as well as suspend it.
      if (audio && audio.state !== "running") void audio.resume().catch(() => {});
    } catch {
      /* Silent play remains fully functional. */
    }
  }
  function play(kind: WaffleSound, enabled: boolean) {
    if (!enabled) return;
    unlock();
    if (!session) return;
    const owner = session;
    const context = owner.context;
    let gain: GainNode | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const oscillators = new Set<OscillatorNode>();
    let released = false;
    function release() {
      if (released) return;
      released = true;
      clearTimeout(timer);
      for (const oscillator of oscillators) {
        oscillator.onended = null;
        try { oscillator.stop(); } catch {}
        oscillator.disconnect();
      }
      oscillators.clear();
      gain?.disconnect();
      owner.voices.delete(release);
      closeWhenFinished(owner);
    }
    try {
      gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.value = 0.025;
      owner.voices.add(release);
      notes[kind].forEach((note, i) => {
        const oscillator = context.createOscillator();
        oscillators.add(oscillator);
        oscillator.type = "square";
        oscillator.frequency.value = note;
        oscillator.connect(gain!);
        oscillator.onended = () => {
          oscillator.onended = null;
          oscillator.disconnect();
          oscillators.delete(oscillator);
          if (!oscillators.size) release();
        };
        oscillator.start(context.currentTime + i * 0.075);
        oscillator.stop(context.currentTime + i * 0.075 + 0.065);
      });
      // Suspended contexts do not emit ended events. Retire queued notes at the
      // same wall-clock cutoff as before instead of playing stale sounds later.
      timer = setTimeout(release, notes[kind].length * 75 + 100);
    } catch {
      release();
    }
  }
  function dispose() {
    const previous = session;
    session = null;
    if (previous) {
      // Leaving the cabinet used to let the last notes finish. Keep that tail,
      // bounded by each voice's existing cutoff, without reusing its context
      // after unmount/StrictMode cleanup.
      previous.detached = true;
      closeWhenFinished(previous);
    }
  }
  return { unlock, play, dispose };
}
