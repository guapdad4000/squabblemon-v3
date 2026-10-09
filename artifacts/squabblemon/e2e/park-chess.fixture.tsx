import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from "@workspace/api-client-react";
import { createParkChessRun, getParkChessView, playParkChessMove, resignParkChessRun, type ParkChessRun } from "@workspace/squabblemon-engine/parkChess";
import { PARK_CHESS_LESSONS } from "@workspace/squabblemon-engine/parkChessLessons";
import ParkChessGame, { type ParkChessStatus } from "../src/components/fadecade/ParkChessGame";
import { ParkChessCabinet } from "../src/components/fadecade/ParkChessCabinet";
import "../src/index.css";

// Engine execution belongs only to this test server simulation. The production
// component submits server commands and never chooses or verifies a bot move.
const params = new URLSearchParams(location.search);
const storageKey = "park-chess-fixture";
if (params.has("reset")) {
  localStorage.removeItem(storageKey);
  params.delete("reset");
  history.replaceState(null, "", `${location.pathname}${params.size ? "?" + params : ""}`);
}
const saved = localStorage.getItem(storageKey);
let { run, campaign, banked, applied } = saved ? JSON.parse(saved) : {
  run: null as ParkChessRun | null,
  campaign: { wins: 0, losses: 0, draws: 0, games: 0, tier: Number(params.get("tier") ?? 1) },
  banked: 0,
  applied: [] as string[],
};
const requests: { path: string; body: Record<string, unknown> }[] = [];
const aborted: string[] = [];
let bootstrapRefreshes = 0;
let interrupt = params.get("retry");
const specialPositions: Record<string, string> = {
  promotion: "7k/P7/8/8/8/8/8/7K w - - 0 1",
  capture: "7k/8/8/3p4/4P3/8/8/7K w - - 0 1",
  check: "4r2k/8/8/8/8/8/8/4K3 w - - 0 1",
  mate: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1",
};
if (!run && params.get("scene")) {
  run = createParkChessRun(crypto.randomUUID(), campaign.tier);
  const fen = specialPositions[params.get("scene")!];
  if (fen) run = { ...run, startFen: fen, fen };
}
function persist() { localStorage.setItem(storageKey, JSON.stringify({ run, campaign, banked, applied })); }
function status(): ParkChessStatus {
  return { run: run ? getParkChessView(run) : null, campaign, earned: { packTickets: run?.phase === "won" ? 1 : 0, softCurrency: 0, styleShards: 0 }, serverNow: Date.now() };
}
persist();
const bootstrap = { profile: { id: "park-chess-fixture", displayName: "PARK TESTER", settings: { reducedMotion: params.has("reduced") }, wallet: { packTickets: 20 } } } as PlayerBootstrap;
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const path = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const respond = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code, headers: { "content-type": "application/json" } });
  if (path.includes("/api/player/bootstrap")) {
    bootstrapRefreshes++;
    return respond({ ...bootstrap, profile: { ...bootstrap.profile, wallet: { ...bootstrap.profile.wallet, packTickets: 20 + banked } } });
  }
  if (!path.includes("/api/player/park-chess")) return nativeFetch(input, init);
  if (init?.method !== "POST" && params.has("restore-error")) return respond({ error: "Match restore unavailable." }, 503);
  if (init?.method !== "POST" && params.has("restore-delay")) await new Promise<void>((resolve, reject) => {
    const signal = init?.signal;
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, Number(params.get("restore-delay")));
    function onAbort() { clearTimeout(timer); aborted.push(path); reject(new DOMException("Request cancelled", "AbortError")); }
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    requests.push({ path, body });
    const identity = body.actionId ?? body.requestId;
    if (!applied.includes(identity)) {
      if (path.endsWith("/start")) {
        if (!run || run.phase !== "active") run = createParkChessRun(body.requestId, campaign.tier);
      } else {
        if (!run || body.revision !== run.revision) return respond({ error: "Your match changed. Sync to resume." }, 409);
        try {
          run = path.endsWith("/resign") ? resignParkChessRun(run) : playParkChessMove(run, body.move);
          if (run.phase !== "active") {
            campaign.games++;
            if (run.phase === "won") { campaign.wins++; campaign.tier = Math.min(5, campaign.tier + 1); banked++; }
            else if (run.phase === "draw") campaign.draws++;
            else campaign.losses++;
          }
        } catch (error) { return respond({ error: (error as Error).message }, 409); }
      }
      applied.push(identity);
      persist();
      if (interrupt && path.endsWith("/" + interrupt)) { interrupt = null; throw new TypeError("Connection interrupted after save."); }
    }
    if (params.has("delay")) await new Promise<void>((resolve, reject) => {
      const signal = init.signal;
      const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, Number(params.get("delay")));
      function onAbort() { clearTimeout(timer); aborted.push(path); reject(new DOMException("Request cancelled", "AbortError")); }
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
  return respond(status());
};
Object.defineProperty(window, "__parkChess", { get: () => ({ ...status(), requests, aborted, banked, bootstrapRefreshes }) });
Object.defineProperty(window, "__parkChessLessons", { value: PARK_CHESS_LESSONS });
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Fixture() {
  const profile = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: async () => (await fetch("/api/player/bootstrap")).json(), initialData: bootstrap, staleTime: Infinity });
  return params.has("cabinet") ? <ParkChessCabinet onOpen={() => { location.href = "/e2e/park-chess.fixture.html"; }} /> : <ParkChessGame bootstrap={profile.data} />;
}
const root = createRoot(document.getElementById("root")!);
Object.defineProperty(window, "__parkChessUnmount", { value: () => root.unmount() });
root.render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
