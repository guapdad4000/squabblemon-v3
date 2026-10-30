import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import {
  createBossCampaign,
  settleBossCampaign,
  createBossRaid,
  applyBossAction,
  bossRewards,
  bossReset,
  bossForm,
  type BossTier,
  type BossRaid,
  type BossStatus,
} from "@workspace/squabblemon-engine/bossRaid";
import {
  decks,
  engineIdsToCatalogIds,
} from "@workspace/squabblemon-engine/data";
import { createCardInstance } from "@workspace/squabblemon-engine/gameEngine";
import BossRaidGame from "../src/components/fadecade/BossRaidGame";
import { BossRaidCabinet } from "../src/components/fadecade/BossRaidCabinet";
import "../src/index.css";
import { getActiveMusicOverride } from "../src/musicStore";
const crew = {
  ...decks.find((d) => d.id === "block")!,
  cards: engineIdsToCatalogIds(decks.find((d) => d.id === "block")!.cards),
};
const params = new URLSearchParams(location.search),
  mode = params.get("raid") === "kumite" ? "kumite" : "precinct",
  day = "2026-10-08",
  now = new Date(day + "T12:00:00Z"),
  saved = params.has("reset")
    ? (localStorage.removeItem("boss-raid-fixture"), localStorage.removeItem("boss-campaign-fixture-v2"), null)
    : localStorage.getItem("boss-raid-fixture");
let run: BossRaid | null = saved ? JSON.parse(saved) : null,
  lastActionId: string | undefined,
  failAfterSave = params.has("retry");
if (run && (run.rulesVersion !== 2 || run.blasts.some(b => !b.boardsBeforePolice))) run = null;
let campaign = createBossCampaign();
const tier = Number(params.get("tier") ?? 1) as BossTier;
if (tier >= 1 && tier <= 5) {
  campaign.tier = tier;
  campaign.hp = Math.min(bossForm(tier).hp, Number(params.get("hp") ?? bossForm(tier).hp));
}
const savedCampaign = localStorage.getItem("boss-campaign-fixture-v2");
if (savedCampaign) campaign = JSON.parse(savedCampaign);
function greedy(r: BossRaid) {
  for (const card of [...r.match.playerHand].sort((a, b) => a.cost - b.cost))
    for (const lane of [0, 1, 2] as const) {
      try {
        return applyBossAction(r, {
          type: "play",
          instanceId: card.instanceId,
          lane,
        });
      } catch {}
    }
  return null;
}
if (params.has("demo") && !run) {
  campaign.hp -= 240;
  campaign.totalDamage = 240;
  campaign.tierAttacks = 3;
  campaign.attacks = 3;
  run = createBossRaid(crypto.randomUUID(), day, crew.cards, crew.name, {
    tier: campaign.tier,
    hp: campaign.hp,
  }, mode);
  for (let round = 1; round <= 3; round++) {
    let next;
    while ((next = greedy(run))) run = next;
    if (round < 3) {
      const old = run;
      run = applyBossAction(run, { type: "blast" });
      campaign = settleBossCampaign(campaign, old, run).campaign;
    }
  }
}
if (params.has("choices")) {
  run = createBossRaid(crypto.randomUUID(), day, crew.cards, crew.name, { tier:campaign.tier,hp:campaign.hp },mode);
  run.match.playerHand = ["homelessguy","the-dice-game","the-concert","cornball"].map((id,index)=>createCardInstance(id,"player","choices",index));
  run.match.playerMotion=12; run.match.cpuMotion=12;
  run.match.boards[0]=[{...createCardInstance("raid-feds","cpu","choice-tax",0),lane:0,playedRound:1}];
  run.match.boards[1]=[{...createCardInstance("cornball","player","concert-ally",0),lane:1,playedRound:1},{...createCardInstance("cornball","cpu","concert-enemy",0),lane:1,playedRound:1,powerModifier:6}];
}
function status(): BossStatus {
  return {
    day,
    resetsAt: bossReset(now),
    serverNow: now.getTime(),
    attemptsRemaining: run ? 0 : 1,
    run,
    earned: run
      ? bossRewards(run)
      : { softCurrency: 0, packTickets: 0, styleShards: 0 },
    bestScore: run?.score ?? 0,
    campaign,
    history: run ? [{ day, score: run.score, defeated: run.hp === 0 }] : [],
  };
}
const fetchNative = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (!url.includes("/api/player/boss-raid")) return fetchNative(input, init);
  const response = (body: unknown, code = 200) =>
    new Response(JSON.stringify(body), {
      status: code,
      headers: { "content-type": "application/json" },
    });
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    if (new URL(url, location.href).pathname.endsWith("/start")) {
      if (!run) {
        run = createBossRaid(body.requestId, day, body.cardIds, crew.name, {
          tier: campaign.tier,
          hp: campaign.hp,
        }, mode);
        campaign.attacks++;
        campaign.tierAttacks++;
      }
    } else if (body.actionId !== lastActionId) {
      if (!run || body.revision !== run.revision)
        return response({ error: "Your raid changed. Sync to resume." }, 409);
      try {
        const old = run;
        run = applyBossAction(run, body.action);
        campaign = settleBossCampaign(campaign, old, run).campaign;
        lastActionId = body.actionId;
      } catch (e) {
        return response({ error: (e as Error).message }, 409);
      }
    }
    localStorage.setItem("boss-raid-fixture", JSON.stringify(run));
    localStorage.setItem("boss-campaign-fixture-v2", JSON.stringify(campaign));
    if (failAfterSave && body.action?.type === "blast") {
      failAfterSave = false;
      throw new TypeError("Connection interrupted after save.");
    }
  }
  return response(status());
};
Object.defineProperty(window, "__raidMusic", { get: getActiveMusicOverride });
Object.defineProperty(window, "__raidStatus", { get: status });
Object.defineProperty(window, "__raid", { get: () => run });
Object.defineProperty(window, "__raidLegal", {
  get: () =>
    run && run.phase === "active"
      ? run.match.playerHand.flatMap((c) =>
          ([0, 1, 2] as const).flatMap((lane) => {
            try {
              applyBossAction(run!, {
                type: "play",
                instanceId: c.instanceId,
                lane,
              });
              return [{ instanceId: c.instanceId, lane }];
            } catch {
              return [];
            }
          }),
        )
      : [],
});
const bootstrap = {
  profile: {
    id: "boss-fixture",
    ownedCardIds: crew.cards,
    settings: { reducedMotion: params.has("reduced"), turnTimerEnabled: false },
  },
} as PlayerBootstrap;
const fixtureRoot = createRoot(document.getElementById("root")!);
Object.defineProperty(window, "__raidUnmount", { value: () => fixtureRoot.unmount() });
fixtureRoot.render(
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {params.has("cabinet") ? (
      <BossRaidCabinet
        onOpen={() => {
          location.href = "/e2e/boss-raid.fixture.html";
        }}
      />
    ) : (
      <BossRaidGame
        bootstrap={bootstrap}
        crews={[crew]}
        onExit={() => {
          document.body.dataset.exited = "true";
        }}
      />
    )}
  </QueryClientProvider>,
);
