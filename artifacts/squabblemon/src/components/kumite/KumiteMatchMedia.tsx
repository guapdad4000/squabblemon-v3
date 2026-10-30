import { useEffect, useRef } from "react";
import { getAssetUrl } from "../../lib/assets";

const media = {
  monochrome: { file: "monochrome-brushstroke-split", width: 736, height: 416 },
  color: { file: "brushstroke-fire-split", width: 736, height: 400 },
  streak: { file: "white-crack-streak", width: 752, height: 416 },
  golden: { file: "golden-courtyard", width: 448, height: 672 },
  crimson: { file: "crimson-courtyard", width: 448, height: 672 },
  burst: { file: "ink-cross-slash-burst", width: 736, height: 416 },
  victory: {
    file: "win-w",
    width: 256,
    height: 256,
    moving: "assets/results/win-w.webp",
    poster: "assets/results/win-w-still.webp",
  },
} as const;
export type KumiteMatchMediaKind = keyof typeof media;

type Props = {
  kind: KumiteMatchMediaKind;
  active?: boolean;
  reducedMotion?: boolean;
  onComplete?(): void;
};

const burstDurationMs = 2920;
const burstLoadTimeoutMs = 10_000;

/** Each asset owns its failures, requests and finite presentation. A changed
 * kind gets a fresh DOM node, so late events cannot poison replacement art. */
export function KumiteMatchMedia(props: Props) {
  if (!Object.hasOwn(media, props.kind)) return null;
  return <MatchMediaPlayback key={props.kind} {...props} />;
}

/** Decorative playback only. No media event admits a player to a match. */
function MatchMediaPlayback({
  kind,
  active = true,
  reducedMotion = false,
  onComplete,
}: Props) {
  const element = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const failed = useRef(false);
  const stillFailed = useRef(false);
  const retired = useRef(false);
  const admitted = useRef(false);
  const started = useRef(false);
  const completed = useRef(false);
  const completion = useRef(onComplete);
  useEffect(() => {
    completion.current = onComplete;
  }, [onComplete]);
  const asset = media[kind];
  const { file, width, height } = asset;
  const still = getAssetUrl(
    "poster" in asset
      ? asset.poster
      : `assets/kumite/matchmaking/${file}-still-v1.webp`,
  );
  const isVideo =
    kind === "monochrome" ||
    kind === "color" ||
    kind === "golden" ||
    kind === "crimson";
  const moving = getAssetUrl(
    "moving" in asset
      ? asset.moving
      : `assets/kumite/matchmaking/${file}-v1.${isVideo ? "mp4" : "webp"}`,
  );
  const oneShot = kind === "burst";

  useEffect(() => {
    const current = element.current;
    if (!current) return;
    const node = current;
    let disposed = false;
    let playGeneration = 0;
    let pendingPlay: number | undefined;
    let stop: (() => void) | undefined;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
    const clearTimers = () => {
      clearTimeout(loadTimer);
      clearTimeout(lifetimeTimer);
      loadTimer = lifetimeTimer = undefined;
    };
    const release = () => {
      stop?.();
      stop = undefined;
    };
    const complete = () => {
      if (disposed || retired.current) return;
      retired.current = true;
      clearTimers();
      release();
      setPlaying(false);
      if (!completed.current) {
        completed.current = true;
        completion.current?.();
      }
    };
    const motionReduced = () =>
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "true" ||
      document.documentElement.dataset.reducedMotion === "true";
    const matchesSource = (source: string, decoded = false) => {
      if (node.getAttribute("src") !== source) return false;
      if (!node.currentSrc) return !decoded;
      return (
        new URL(node.currentSrc, document.baseURI).href ===
        new URL(source, document.baseURI).href
      );
    };
    const playFailed = (attempt: number) => {
      if (
        disposed ||
        attempt !== playGeneration ||
        node.dataset.mediaAnimated !== "true"
      )
        return;
      pendingPlay = undefined;
      failed.current = true;
      setPlaying(false);
      release();
    };

    function setPlaying(allowed: boolean) {
      if (disposed) return;
      const play =
        allowed &&
        active &&
        !motionReduced() &&
        !failed.current &&
        !retired.current;
      // Admission, even before load, belongs to this encounter. Interruptions
      // settle it; an initially hidden encounter has not yet been admitted.
      if (
        oneShot &&
        !play &&
        !retired.current &&
        (admitted.current || motionReduced())
      ) {
        complete();
        return;
      }
      node.dataset.mediaAnimated = String(play);
      node.dataset.mediaRetired = String(retired.current);
      if (!play) {
        node.dataset.mediaPlaying = "false";
        clearTimers();
      }
      if (isVideo) {
        const video = node as HTMLVideoElement;
        if (play) {
          node.hidden = false;
          if (video.getAttribute("src") !== moving) {
            node.dataset.mediaPlaying = "false";
            video.setAttribute("src", moving);
          }
          if (video.paused && pendingPlay === undefined) {
            const attempt = ++playGeneration;
            pendingPlay = attempt;
            try {
              void video
                .play()
                .then(() => {
                  if (!disposed && attempt === playGeneration)
                    pendingPlay = undefined;
                })
                .catch(() => playFailed(attempt));
            } catch {
              playFailed(attempt);
            }
          }
        } else {
          playGeneration++;
          pendingPlay = undefined;
          video.pause();
          if (video.hasAttribute("src")) {
            video.removeAttribute("src");
            video.load();
          }
        }
      } else {
        // A broken poster stays invisible without removing the geometry that
        // visibility observation needs to admit a healthy animated source.
        node.hidden = !play && stillFailed.current && failed.current;
        node.style.visibility =
          stillFailed.current && (!play || !started.current) ? "hidden" : "";
        const src = play ? moving : still;
        if (node.getAttribute("src") !== src) {
          node.dataset.mediaPlaying = "false";
          node.setAttribute("src", src);
          if (play) {
            admitted.current = true;
            if (oneShot) {
              loadTimer = setTimeout(() => {
                failed.current = true;
                complete();
              }, burstLoadTimeoutMs);
            }
          }
        }
      }
    }
    const loaded = (event: Event) => {
      if (
        disposed ||
        event.target !== node ||
        node.dataset.mediaAnimated !== "true" ||
        !matchesSource(moving, true) ||
        (!isVideo &&
          (!(node as HTMLImageElement).complete ||
            !(node as HTMLImageElement).naturalWidth))
      )
        return;
      node.hidden = false;
      node.style.visibility = "";
      node.dataset.mediaPlaying = "true";
      if (!started.current && oneShot) {
        clearTimeout(loadTimer);
        loadTimer = undefined;
        // CSS supplies the visible fade; this independently guarantees finite
        // presentation if CSS or animationend is unavailable or cancelled.
        lifetimeTimer = setTimeout(complete, burstDurationMs);
      }
      started.current = true;
    };
    const errored = (event: Event) => {
      if (disposed || event.target !== node) return;
      if (node.dataset.mediaAnimated === "true") {
        if (!matchesSource(moving)) return;
        failed.current = true;
        if (oneShot) complete();
        else {
          setPlaying(false);
          release();
        }
      } else if (!isVideo && matchesSource(still)) {
        stillFailed.current = true;
        node.style.visibility = "hidden";
        node.hidden = failed.current;
        if (oneShot) complete();
        if (failed.current) release();
      }
      // A queued video error after pause/remove-src belongs to the unloaded
      // request. It must not hide the valid poster or poison the next play.
    };
    const retire = (event: AnimationEvent) => {
      if (
        oneShot &&
        started.current &&
        node.dataset.mediaPlaying === "true" &&
        event.target === node &&
        event.animationName === "km-found-burst-life"
      )
        complete();
    };
    const loadEvent = isVideo ? "loadeddata" : "load";
    node.addEventListener(loadEvent, loaded);
    node.addEventListener("error", errored);
    node.addEventListener("animationend", retire);
    setPlaying(false);
    if (active && !reducedMotion && !retired.current && !failed.current) {
      void import("../../lib/battleMediaPlayback")
        .then(({ observePlayback }) => {
          if (disposed || retired.current || failed.current) return;
          stop = observePlayback(node, setPlaying);
          // observePlayback can synchronously skip a reduced-motion burst.
          if (disposed || retired.current || failed.current) release();
        })
        .catch(() => {
          if (!disposed && oneShot) complete();
        });
    }
    return () => {
      disposed = true;
      playGeneration++;
      pendingPlay = undefined;
      clearTimers();
      release();
      node.dataset.mediaAnimated = node.dataset.mediaPlaying = "false";
      if (isVideo) {
        const video = node as HTMLVideoElement;
        video.pause();
        video.removeAttribute("src");
        video.load();
      } else {
        node.removeAttribute("src");
      }
      node.removeEventListener(loadEvent, loaded);
      node.removeEventListener("error", errored);
      node.removeEventListener("animationend", retire);
    };
  }, [active, reducedMotion, oneShot, moving, still, isVideo]);

  const common = {
    className: `km-match-media km-match-media-${kind}`,
    "data-match-media": kind,
    "data-media-animated": "false",
    "data-media-playing": "false",
    "data-media-retired": "false",
    width,
    height,
    "aria-hidden": true as const,
    draggable: false,
  };
  return isVideo ? (
    <video
      {...common}
      ref={(node) => {
        element.current = node;
      }}
      poster={still}
      preload="none"
      muted
      loop
      playsInline
      disablePictureInPicture
      tabIndex={-1}
    />
  ) : (
    <img
      {...common}
      ref={(node) => {
        element.current = node;
      }}
      src={still}
      alt=""
      decoding="async"
    />
  );
}
