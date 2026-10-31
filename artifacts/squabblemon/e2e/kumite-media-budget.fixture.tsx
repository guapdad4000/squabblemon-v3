// DEV-only identical-workload media audit. It never calls a game API or grants rewards.
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  buildBreakthroughRoster,
  BREAKTHROUGH_STARTER_DECKS,
} from "@workspace/squabblemon-engine/breakthroughCatalog";
import BreakthroughArena from "../src/components/breakthrough/BreakthroughArena";
import { getCardImage } from "../src/data";
if (!import.meta.env.DEV)
  throw new Error("The media budget audit is development-only.");
const query = new URLSearchParams(location.search);
function Audit() {
  const roster = useMemo(
    () => buildBreakthroughRoster((card) => getCardImage(card.catalogId)),
    [],
  );
  const crew =
    BREAKTHROUGH_STARTER_DECKS.find((deck) => deck.id === "combo") ??
    BREAKTHROUGH_STARTER_DECKS[0];
  const opps =
    BREAKTHROUGH_STARTER_DECKS.find((deck) => deck.id === "voltage") ??
    BREAKTHROUGH_STARTER_DECKS[1];
  const [report, setReport] = useState<unknown>(null);
  useEffect(() => {
    const began = performance.now(),
      frames: number[] = [],
      longTasks: number[] = [];
    let previous = began,
      frame = 0,
      hidden = document.hidden;
    const tick = (now: number) => {
      frames.push(now - previous);
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden) hidden = true;
    };
    document.addEventListener("visibilitychange", visibility);
    let observer: PerformanceObserver | undefined;
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      observer.observe({ type: "longtask", buffered: false });
    }
    frame = requestAnimationFrame(tick);
    const timer = setTimeout(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      const sorted = [...frames].sort((a, b) => a - b),
        percentile = (p: number) =>
          sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ??
          0;
      const resources = performance
        .getEntriesByType("resource")
        .filter(
          (entry): entry is PerformanceResourceTiming =>
            entry instanceof PerformanceResourceTiming,
        )
        .filter(
          (entry) =>
            /\.(webp|png|gif|jpe?g|mp4|webm)(?:\?|$)/i.test(entry.name) &&
            entry.initiatorType !== "script",
        )
        .map((entry) => ({
          path: new URL(entry.name).pathname,
          initiator: entry.initiatorType,
          bytes: entry.decodedBodySize,
          transfer: entry.transferSize,
          duration: entry.duration,
        }));
      setReport({
        sample: "combo-vs-voltage-seed-73031-idle-cpu-10s",
        elapsed: performance.now() - began,
        view: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        hiddenDuringSample: hidden,
        reduced: query.get("motion") === "reduced",
        environment:
          "local Vite development, existing browser cache, no CPU/network throttle",
        frames: {
          count: frames.length,
          p50: percentile(0.5),
          p95: percentile(0.95),
          p99: percentile(0.99),
          over50ms: frames.filter((n) => n > 50).length,
        },
        longTasks: {
          count: longTasks.length,
          total: longTasks.reduce((a, b) => a + b, 0),
        },
        resources,
      });
    }, 10000);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <>
      <BreakthroughArena
        roster={roster}
        playerDeck={crew.catalogCardIds}
        opponentDeck={opps.catalogCardIds}
        identity={{
          name: "MEDIA AUDIT",
          level: 18,
          rank: "Park Royalty",
          avatarKey: "kyle",
          heroCardId: crew.hero,
        }}
        initialSeed={73031}
        preferredReducedMotion={query.get("motion") === "reduced"}
        onChangeDeck={() =>
          location.assign("./breakthrough-production.fixture.html")
        }
        onExit={() => location.assign("./kumite-matchmaking.fixture.html")}
      />
      <output data-media-budget={report ? "ready" : "sampling"}>
        {JSON.stringify(report)}
      </output>
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
import.meta.hot?.dispose(() => root.unmount());
root.render(<Audit />);
