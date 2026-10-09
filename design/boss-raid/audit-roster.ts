import {
  createBossRaid,
  applyBossAction,
  BOSS_NPCS,
  BossRuleError,
} from "../../lib/squabblemon-engine/src/bossRaid.ts";
import {
  cards,
  decks,
  engineIdsToCatalogIds,
} from "../../lib/squabblemon-engine/src/data.ts";
import { createCardInstance } from "../../lib/squabblemon-engine/src/gameEngine.ts";
import { writeFileSync } from "node:fs";
let checked = 0,
  rejected = 0;
const errors = [];
for (const id of Object.keys(cards))
  for (const npc of Object.keys(BOSS_NPCS)) {
    const r = createBossRaid(
      "audit",
      "2026-10-08",
      engineIdsToCatalogIds(decks[0].cards),
      "Roster audit",
    );
    r.match.round = 4;
    r.match.playerMotion = 20;
    r.match.boards = [
      [
        {
          ...createCardInstance(npc, "cpu", "raid", 0),
          lane: 0,
          playedRound: 1,
        },
        {
          ...createCardInstance("cornball", "player", "raid", 1),
          lane: 0,
          playedRound: 1,
        },
      ],
      [],
      [],
    ];
    r.match.playerHand = [createCardInstance(id, "player", "raid", 2)];
    try {
      const next = applyBossAction(r, {
        type: "play",
        instanceId: r.match.playerHand[0].instanceId,
        lane: 0,
      });
      applyBossAction(next, { type: "blast" });
      checked++;
    } catch (e) {
      if (e instanceof BossRuleError) rejected++;
      else errors.push({ id, npc, error: String(e) });
    }
  }
writeFileSync(
  new URL("./roster-audit.json", import.meta.url),
  JSON.stringify({ checked, rejected, errors }, null, 2),
);
console.log(JSON.stringify({ checked, rejected, errors }));
