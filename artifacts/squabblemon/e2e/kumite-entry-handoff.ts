/** Local audition handoff only. Loading a module must not start the practice
 * clock, and cancelled/hidden entry must never mount an arena from a late import. */
export function createKumitePreviewEntry<T>(options: {
  load(): Promise<T>;
  visible(): boolean;
  mount(value: T): void;
  fail(error: unknown): void;
}) {
  let generation = 0;
  let pending = false;
  let ready = false;
  let loaded: T | undefined;
  let hasLoaded = false;
  const flush = () => {
    if (!pending || !ready || !hasLoaded || !options.visible()) return;
    pending = false;
    options.mount(loaded as T);
  };
  return {
    enter() {
      // Repeated entry intent must not erase an already completed burst while
      // the module is still loading or the document is hidden. Cancel explicitly
      // before beginning a different encounter.
      if (pending) return;
      const attempt = ++generation;
      pending = true;
      ready = false;
      hasLoaded = false;
      loaded = undefined;
      void Promise.resolve()
        .then(options.load)
        .then(
          (value) => {
            if (attempt !== generation || !pending) return;
            loaded = value;
            hasLoaded = true;
            flush();
          },
          (error) => {
            if (attempt !== generation || !pending) return;
            pending = false;
            options.fail(error);
          },
        );
    },
    presentationComplete() {
      if (!pending) return;
      ready = true;
      flush();
    },
    visibilityChanged: flush,
    cancel() {
      generation++;
      pending = false;
      ready = false;
      hasLoaded = false;
      loaded = undefined;
    },
  };
}
