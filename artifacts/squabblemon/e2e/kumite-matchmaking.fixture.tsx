import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  KumiteOpponentSearch,
  type KumiteSearchIdentity,
  type KumiteSearchState,
} from "../src/components/kumite/KumiteOpponentSearch";
import { getAssetUrl } from "../src/lib/assets";
import { createDeferredComponent } from "../src/lib/deferredComponent";
import { createKumitePreviewEntry } from "./kumite-entry-handoff";
const battlePreview = createDeferredComponent(
  "KumiteMatchmakingBattle.fixture",
  "default",
  () => import("./KumiteMatchmakingBattle.fixture"),
);
if (!import.meta.env.DEV)
  throw new Error("Matchmaking audition is local-only.");
const player: KumiteSearchIdentity = {
  name: "GUAP.DAD",
  level: 18,
  crewName: "PERSONAL SECURITY",
  rank: "Park Royalty",
  art: getAssetUrl("assets/kumite/fighters/bushedo-brown.webp"),
};
const opponent: KumiteSearchIdentity = {
  name: "SHO’NUFF",
  level: 21,
  crewName: "THE SHOGUN",
  rank: "Ascended Hands",
  art: getAssetUrl("assets/kumite/fighters/shonuff.webp"),
};
const initial = new URLSearchParams(location.search).get("state");
function Audition() {
  const [state, setState] = useState<KumiteSearchState>(
    initial === "matched"
      ? { phase: "matched", elapsedSeconds: 12, opponent }
      : { phase: "searching", elapsedSeconds: 0 },
  );
  const [reduced, setReduced] = useState(
    new URLSearchParams(location.search).get("motion") === "reduced",
  );
  const [tools, setTools] = useState(false);
  const [BattlePreview, setBattlePreview] =
    useState<ReturnType<typeof battlePreview.peek>>();
  const [entry] = useState(() =>
    createKumitePreviewEntry({
      load: battlePreview.load,
      visible: () => !document.hidden,
      mount: (view) => {
        setTools(false);
        setBattlePreview(() => view);
      },
      fail: () =>
        setState({
          phase: "error",
          elapsedSeconds: elapsed.current,
          message: "Arena could not load. Retry your search.",
        }),
    }),
  );
  const entryComplete = useCallback(
    () => entry.presentationComplete(),
    [entry],
  );
  useEffect(() => {
    document.addEventListener("visibilitychange", entry.visibilityChanged);
    return () => {
      entry.cancel();
      document.removeEventListener("visibilitychange", entry.visibilityChanged);
    };
  }, [entry]);
  const elapsed = useRef(initial === "matched" ? 12 : 0);
  const startedAt = useRef(Date.now());
  useEffect(() => {
    if (state.phase !== "searching") return;
    startedAt.current = Date.now() - elapsed.current * 1000;
    const timer = setInterval(() => {
      if (document.hidden) return;
      elapsed.current = Math.floor((Date.now() - startedAt.current) / 1000);
      setState({ phase: "searching", elapsedSeconds: elapsed.current });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.phase]);
  function search() {
    entry.cancel();
    setBattlePreview(undefined);
    elapsed.current = 0;
    startedAt.current = Date.now();
    setState({ phase: "searching", elapsedSeconds: 0 });
  }
  if (BattlePreview)
    return (
      <BattlePreview
        reducedMotion={reduced}
        onExit={() => {
          window.location.assign(
            "./breakthrough-production.fixture.html?profile=full-catalog-qa&crew=music-tour",
          );
        }}
      />
    );
  return (
    <>
      <KumiteOpponentSearch
        player={player}
        state={state}
        reducedMotion={reduced}
        onEntryComplete={entryComplete}
        onCancel={() => {
          entry.cancel();
          if (state.phase === "cancelled") {
            window.location.assign(
              "./breakthrough-production.fixture.html?profile=full-catalog-qa&crew=music-tour",
            );
          } else setState({ phase: "cancelled" });
        }}
        onRetry={search}
      />
      <style>{`
        .km-audition-controls button { min-height:44px; flex-shrink:0; padding:8px 11px; color:#fff; border:1px solid currentColor; background:#101010; cursor:pointer; font:10px Arial,sans-serif; }
        .km-audition-controls button:disabled { opacity:.45; cursor:default; }
        .km-audition-controls button:focus-visible { outline:3px dashed currentColor; outline-offset:3px; }
      `}</style>
      <div
        className="km-audition-controls"
        style={{
          position: "fixed",
          zIndex: 100,
          bottom: 80,
          right: 18,
          display: "flex",
          alignItems: "flex-end",
          gap: 7,
          font: "10px Arial,sans-serif",
          color: "#fff",
        }}
      >
        <button
          style={{
            color: "inherit",
            border: "1px solid currentColor",
            background: "#101010",
            padding: "9px 11px",
            minHeight: 44,
            cursor: "pointer",
          }}
          onClick={() => setTools(!tools)}
          aria-expanded={tools}
        >
          AUDITION {tools ? "−" : "+"}
        </button>
        {tools && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              maxHeight: "calc(100dvh - 110px)",
              overflowY: "auto",
            }}
          >
            <button onClick={search}>Search</button>
            <button
              onClick={() => {
                entry.cancel();
                setState({
                  phase: "matched",
                  elapsedSeconds: elapsed.current,
                  opponent,
                });
              }}
            >
              Opponent found
            </button>
            <button
              disabled={state.phase === "connecting"}
              onClick={() => {
                entry.enter();
                setState({
                  phase: "connecting",
                  elapsedSeconds: elapsed.current,
                  opponent,
                });
              }}
            >
              Enter arena
            </button>
            <button
              onClick={() => {
                entry.cancel();
                setState({
                  phase: "reconnecting",
                  elapsedSeconds: elapsed.current,
                });
              }}
            >
              Reconnect
            </button>
            <button
              onClick={() => {
                entry.cancel();
                setState({
                  phase: "error",
                  elapsedSeconds: elapsed.current,
                  message: "Connection interrupted. Retry your search.",
                });
              }}
            >
              Connection error
            </button>
            <a
              href="./kumite-results.fixture.html?outcome=win"
              style={{ color: "#fff", padding: 8 }}
            >
              Results ↗
            </a>
            <button onClick={() => setReduced(!reduced)} aria-pressed={reduced}>
              Reduced motion
            </button>
          </div>
        )}
      </div>
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
// Vite re-evaluates this standalone fixture outside the app bootstrap.
import.meta.hot?.dispose(() => root.unmount());
root.render(
  <React.StrictMode>
    <Audition />
  </React.StrictMode>,
);
