import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createBossCampaign, type BossStatus } from "@workspace/squabblemon-engine/bossRaid";
import { dojoReminderNotice } from "./dojoReminder";

const ready: Pick<BossStatus, "day" | "attemptsRemaining" | "campaign"> = {
  day: "2026-10-29", attemptsRemaining: 2, campaign: createBossCampaign(),
};

test("Dojo reminder preserves ready entries and hides completed or spent campaigns", () => {
  assert.deepEqual(dojoReminderNotice(ready), {
    id: "dojo:daily:2026-10-29", dismissalKey: "dojo:daily:2026-10-29:2",
    section: "challenges", title: "DOJO BOSS RAID · 2 DAILY ENTRIES READY",
    href: "/game/challenges?game=punch-on-patrol&raid=kumite",
  });
  assert.equal(dojoReminderNotice({ ...ready, attemptsRemaining: 1 })?.title, "DOJO BOSS RAID · 1 DAILY ENTRY READY");
  assert.equal(dojoReminderNotice({ ...ready, campaign: { ...ready.campaign, completed: true } }), null);
  assert.equal(dojoReminderNotice({ ...ready, attemptsRemaining: 0 }), null);
});

test("Dojo reminder ignores HTML, partial objects, invalid campaigns and malformed entry counts without throwing", () => {
  const malformed: unknown[] = [
    undefined, null, "<!doctype html><html>SPA fallback</html>", [], {},
    { day: ready.day, attemptsRemaining: 2 }, { ...ready, campaign: null },
    { ...ready, campaign: {} }, { ...ready, campaign: [] }, { ...ready, campaign: { completed: "false" } },
    { ...ready, day: undefined }, { ...ready, day: " " },
    ...[NaN, Infinity, -Infinity, -1, 1.5, "2", null].map(attemptsRemaining => ({ ...ready, attemptsRemaining })),
  ];
  for (const input of malformed) {
    assert.doesNotThrow(() => dojoReminderNotice(input));
    assert.equal(dojoReminderNotice(input), null);
  }
});
