import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import release from "../../../squabblemon/src/lib/streetLegendsRelease.json";
import { after, before, test } from "node:test";
import { db, patchDeliveryTargetsTable, patchDraftsTable, playerProfilesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { makePatchLetter, createPatchDraft, deliverLatePatchLetters, listPublicPatches, previewPatch, processOutstandingPatchBatches, processPatchDeliveryBatch, publishPatch, updatePatchDraft } from "./patches";
import { updateMail } from "./mail";
import { createApp } from "../app";

const runId = `patch-test-${Date.now()}`;
const userIds = Array.from({ length: 26 }, (_, index) => `${runId}-${index}`);
const fixtureId = "e2e-player";
let patchId: string | undefined;
let campaignId: string | undefined;

before(async () => {
  if (process.env.PATCHES_TEST_OWNED !== "1" || !process.env.DATABASE_URL) {
    throw new Error("Patch tests require the disposable native PostgreSQL test runner.");
  }
  await db.insert(playerProfilesTable).values([...userIds, fixtureId].map(clerkUserId => ({ clerkUserId })));
});

after(async () => {
  if (patchId) await db.delete(patchDraftsTable).where(eq(patchDraftsTable.id, patchId));
  await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, fixtureId));
  for (const clerkUserId of userIds) await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
});

test("published patch snapshots recipients and delivers resumable bounded, replay-safe mail", async () => {
  const draft = await createPatchDraft({
    version: "v2.46.0",
    title: "Balance update",
    date: "2026-10-05",
    overview: "A small balance update.",
    buffs: ["Boosted moves."],
    changes: ["Adjusted matchmaking."],
    softCurrency: 50,
    packTickets: 10,
  }, "clerk-admin-test");
  patchId = draft.id;
  await db.update(playerProfilesTable).set({
    softCurrency: 137,
    packTickets: 2,
  }).where(eq(playerProfilesTable.clerkUserId, userIds[2]));
  const edited = await updatePatchDraft(draft.id, {
    version: draft.version,
    title: draft.title,
    date: draft.date,
    overview: draft.overview,
    buffs: draft.buffs,
    changes: draft.changes,
    softCurrency: draft.softCurrency,
    packTickets: draft.packTickets,
  });
  assert.ok(edited);
  assert.ok(Date.parse(edited.updatedAt) > Date.parse(draft.updatedAt));

  const preview = await previewPatch(draft.id);
  assert.ok(preview);
  assert.equal(preview.audienceCount, userIds.length);
  assert.equal(preview.letter.gift.softCurrency, 50);
  assert.equal(preview.letter.gift.packTickets, 10);
  assert.equal(preview.letter.gift.styleShards, 0);
  assert.match(preview.letter.body, /October 5, 2026/);
  assert.ok(preview.letter.id.length <= 100);
  campaignId = preview.letter.id;

  assert.equal((await publishPatch(draft.id, draft.updatedAt, "clerk-admin-test")).kind, "conflict");
  const concurrent = await Promise.all([
    publishPatch(draft.id, edited.updatedAt, "clerk-admin-test"),
    publishPatch(draft.id, edited.updatedAt, "clerk-admin-test"),
  ]);
  const published = concurrent.find(result => result.kind === "published");
  assert.equal(concurrent.filter(result => result.kind === "published").length, 1);
  assert.equal(concurrent.filter(result => result.kind === "conflict").length, 1);
  assert.ok(published);
  if (published.kind !== "published") return;
  assert.equal(published.patch.intendedCount, userIds.length);
  assert.equal(published.patch.campaignId, campaignId);

  // New accounts after publication do not join the frozen target ledger.
  const lateId = `${runId}-late`;
  await db.insert(playerProfilesTable).values({ clerkUserId: lateId });
  try {
    assert.equal((await previewPatch(draft.id))?.audienceCount, userIds.length + 1);
    await db.update(playerProfilesTable).set({
      inbox: [{
        id: campaignId!,
        title: "Conflicting content",
        body: "This stable ID was used for something else.",
        sender: "System",
        sentAt: new Date().toISOString(),
        readAt: null,
        claimedAt: null,
        gift: { softCurrency: 0, packTickets: 0, styleShards: 0 },
      }],
    }).where(eq(playerProfilesTable.clerkUserId, userIds[0]));
    // Deleting a recipient must retain the immutable ledger entry, not cascade
    // away the target and leave intendedCount permanently unreachable.
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userIds[1]));
    assert.equal(await processPatchDeliveryBatch(draft.id), 25);
    let targets = await db.select().from(patchDeliveryTargetsTable).where(eq(patchDeliveryTargetsTable.patchId, draft.id));
    assert.equal(targets.length, userIds.length);
    assert.equal(targets.find(target => target.clerkUserId === userIds[0])?.status, "failed");
    assert.equal(targets.find(target => target.clerkUserId === userIds[1])?.status, "missing");
    assert.equal(targets.filter(target => target.status === "pending").length, 1);
    assert.equal((await listPublicPatches()).find(patch => patch.version === draft.version)?.mailStatus, "delivering");

    assert.equal(await processOutstandingPatchBatches(5), 2);
    assert.equal(await processOutstandingPatchBatches(5), 1);
    targets = await db.select().from(patchDeliveryTargetsTable).where(eq(patchDeliveryTargetsTable.patchId, draft.id));
    assert.equal(targets.find(target => target.clerkUserId === userIds[0])?.attempts, 3);
    assert.equal((await listPublicPatches()).find(patch => patch.version === draft.version)?.mailStatus, "partial");
    assert.equal(await processOutstandingPatchBatches(5), 0);

    await db.update(playerProfilesTable).set({ inbox: [] }).where(eq(playerProfilesTable.clerkUserId, userIds[0]));
    assert.equal(await processPatchDeliveryBatch(draft.id, true), 1);
    assert.equal(await processPatchDeliveryBatch(draft.id, true), 0);
    assert.equal((await listPublicPatches()).find(patch => patch.version === draft.version)?.mailStatus, "partial");
    targets = await db.select().from(patchDeliveryTargetsTable).where(eq(patchDeliveryTargetsTable.patchId, draft.id));
    assert.equal(targets.length, userIds.length);
    assert.equal(targets.filter(target => target.status === "delivered").length, userIds.length - 1);
    assert.equal(targets.filter(target => target.status === "missing").length, 1);
    assert.ok(!targets.some(target => target.clerkUserId === fixtureId || target.clerkUserId === lateId));

    const [beforeClaim] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userIds[2]));
    assert.equal(beforeClaim.softCurrency, 137);
    assert.equal(beforeClaim.packTickets, 2);
    const claims = await Promise.all([
      updateMail(userIds[2], campaignId!, true),
      updateMail(userIds[2], campaignId!, true),
    ]);
    assert.equal(claims.filter(result => result.credited).length, 1);
    const [claimedProfile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userIds[2]));
    assert.equal(claimedProfile.softCurrency, 187);
    assert.equal(claimedProfile.packTickets, 12);
    assert.equal(claimedProfile.inbox.filter(mail => mail.id === campaignId).length, 1);

    // Late joiners still get the letter once, outside the frozen snapshot counts.
    // A conflicting inbox entry with the campaign ID is never marked as delivered.
    const conflictId = `${runId}-late-conflict`;
    await db.insert(playerProfilesTable).values({ clerkUserId: conflictId, inbox: [{
      id: campaignId!, title: "Conflicting content", body: "Something else.", sender: "System",
      sentAt: new Date().toISOString(), readAt: null, claimedAt: null, gift: { softCurrency: 0, packTickets: 0, styleShards: 0 },
    }] });
    try {
      assert.equal(await deliverLatePatchLetters(conflictId), 0);
      assert.equal((await db.select().from(patchDeliveryTargetsTable)
        .where(and(eq(patchDeliveryTargetsTable.patchId, draft.id), eq(patchDeliveryTargetsTable.clerkUserId, conflictId)))).length, 0);
    } finally {
      await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, conflictId));
    }
    const [snapshotBefore] = await db.select().from(patchDraftsTable).where(eq(patchDraftsTable.id, draft.id));
    const lateRuns = await Promise.all([deliverLatePatchLetters(lateId), deliverLatePatchLetters(lateId)]);
    assert.equal(lateRuns.reduce((sum, value) => sum + value, 0), 1);
    assert.equal(await deliverLatePatchLetters(lateId), 0);
    assert.equal(await deliverLatePatchLetters(fixtureId), 0);
    assert.equal(await deliverLatePatchLetters(userIds[0]), 0, "snapshot members stay with admin retry");
    const [lateTarget] = await db.select().from(patchDeliveryTargetsTable)
      .where(and(eq(patchDeliveryTargetsTable.patchId, draft.id), eq(patchDeliveryTargetsTable.clerkUserId, lateId)));
    assert.equal(lateTarget?.status, "late");
    const [snapshotAfter] = await db.select().from(patchDraftsTable).where(eq(patchDraftsTable.id, draft.id));
    assert.deepEqual(
      [snapshotAfter.intendedCount, snapshotAfter.deliveredCount, snapshotAfter.failedCount],
      [snapshotBefore.intendedCount, snapshotBefore.deliveredCount, snapshotBefore.failedCount],
    );
    assert.equal((await listPublicPatches()).find(patch => patch.version === draft.version)?.mailStatus, "partial");
    const lateClaims = await Promise.all([updateMail(lateId, campaignId!, true), updateMail(lateId, campaignId!, true)]);
    assert.equal(lateClaims.filter(result => result.credited).length, 1);
    const [lateProfile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, lateId));
    assert.equal(lateProfile.inbox.filter(mail => mail.id === campaignId).length, 1);
    assert.equal(lateProfile.packTickets, 10);
    assert.equal((await updateMail(lateId, campaignId!, true)).credited, false);
    assert.equal((await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, lateId)))[0].packTickets, 10);
  } finally {
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, lateId));
  }
});

test("private patch administration requires an allowlisted Clerk identity and rejects originless mutations", async t => {
  const originalAllowlist = process.env.PATCH_ADMIN_USER_IDS;
  delete process.env.PATCH_ADMIN_USER_IDS;
  const app = createApp((req, _res, next) => {
    (req as any).auth = Object.assign(() => ({
      userId: req.header("x-test-user-id"),
      sessionId: "patch-admin-test",
      tokenType: "session_token",
      isAuthenticated: true,
    }), { [Symbol.for("@clerk/express.auth")]: true });
    next();
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(async () => {
    if (originalAllowlist === undefined) delete process.env.PATCH_ADMIN_USER_IDS;
    else process.env.PATCH_ADMIN_USER_IDS = originalAllowlist;
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const url = `${origin}/api/admin/patches`;
  const get = (userId?: string) => fetch(url, {
    headers: {
      ...(userId ? { "x-test-user-id": userId } : {}),
      "x-clerk-user-id": "listed-admin",
      "x-user-id": "listed-admin",
    },
  });
  assert.equal((await get()).status, 401);
  assert.equal((await get("listed-admin")).status, 403);
  process.env.PATCH_ADMIN_USER_IDS = "listed-admin,e2e-player";
  assert.equal((await get("preview-fixture")).status, 403);
  assert.equal((await get("e2e-player")).status, 403);
  assert.equal((await get("listed-admin")).status, 200);

  const body = {
    version: `route-${Date.now()}`,
    title: "Route test",
    date: "2026-10-05",
    overview: "Origin and authorization check.",
    buffs: [],
    changes: [],
    softCurrency: 50,
    packTickets: 10,
    artCardId: "sherlock",
  };
  const { softCurrency: _defaultClout, packTickets: _defaultTickets, artCardId: _defaultArt, ...withoutGift } = body;
  const defaultResponse = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ ...withoutGift, version: `${body.version}-default` }),
  });
  assert.equal(defaultResponse.status, 201);
  const defaultDraft = await defaultResponse.json() as { id: string; softCurrency: number; packTickets: number; artCardId: string | null };
  assert.equal(defaultDraft.artCardId, null);
  assert.equal(defaultDraft.softCurrency, 50);
  assert.equal(defaultDraft.packTickets, 0);
  await db.delete(patchDraftsTable).where(eq(patchDraftsTable.id, defaultDraft.id));
  const post = (headers: Record<string, string> = {}) => fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", ...headers },
    body: JSON.stringify(body),
  });
  assert.equal((await post()).status, 403);
  assert.equal((await post({ origin: "https://attacker.example", "sec-fetch-site": "cross-site" })).status, 403);

  for (const [suffix, gift] of [
    ["clout-over", { softCurrency: 101, packTickets: 0 }],
    ["ticket-over", { softCurrency: 50, packTickets: 11 }],
    ["ticket-negative", { softCurrency: 0, packTickets: -1 }],
    ["ticket-fraction", { softCurrency: 0, packTickets: 1.5 }],
    ["clout-fraction", { softCurrency: 1.5, packTickets: 0 }],
  ] as const) {
    const overCapResponse = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ ...body, version: `${body.version}-${suffix}`, ...gift }),
    });
    assert.equal(overCapResponse.status, 400);
  }
  // Patch art must name an original catalog character, never a support card or unknown ID.
  for (const artCardId of ["soul-food", "not-a-card", "__proto__"]) {
    const badArt = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ ...body, version: `${body.version}-art-${artCardId}`, artCardId }),
    });
    assert.equal(badArt.status, 400, artCardId);
  }
  const longMailTitle = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ ...body, version: `${body.version}-long`, title: "x".repeat(120) }),
  });
  assert.equal(longMailTitle.status, 400);
  const created = await post({ origin, "sec-fetch-site": "same-origin" });
  assert.equal(created.status, 201);
  const draft = await created.json() as { id: string; artCardId: string | null; updatedAt: string; version: string; title: string; date: string; overview: string; buffs: string[]; changes: string[]; softCurrency: number; packTickets: number };
  assert.equal(draft.artCardId, "sherlock");
  assert.equal(draft.packTickets, 10);
  const preview = await previewPatch(draft.id);
  assert.ok(preview);
  assert.equal(preview.patch.artCardId, "sherlock");
  assert.equal(preview.letter.gift.packTickets, 10);
  await db.update(playerProfilesTable).set({
    inbox: [{
      id: preview.letter.id,
      title: "Conflicting content",
      body: "Existing content with this campaign ID.",
      sender: "System",
      sentAt: new Date().toISOString(),
      readAt: null,
      claimedAt: null,
      gift: { softCurrency: 0, packTickets: 0, styleShards: 0 },
    }],
  }).where(eq(playerProfilesTable.clerkUserId, userIds[3]));
  const publishUrl = `${url}/${draft.id}/publish`;
  const publishResponse = await fetch(publishUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ confirmVersion: draft.updatedAt }),
  });
  assert.equal(publishResponse.status, 200);
  await db.update(patchDeliveryTargetsTable).set({ attempts: 3 }).where(and(
    eq(patchDeliveryTargetsTable.patchId, draft.id),
    eq(patchDeliveryTargetsTable.clerkUserId, userIds[3]),
  ));
  assert.equal((await listPublicPatches()).find(patch => patch.version === draft.version)?.mailStatus, "partial");
  await db.update(playerProfilesTable).set({ inbox: [] }).where(eq(playerProfilesTable.clerkUserId, userIds[3]));
  const resumeResponse = await fetch(`${url}/${draft.id}/deliver`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
  });
  assert.equal(resumeResponse.status, 200);
  const publicCopy = (await listPublicPatches()).find(patch => patch.version === draft.version);
  assert.equal(publicCopy?.mailStatus, "complete");
  assert.equal(publicCopy?.artCardId, "sherlock");
  const patchInput = {
    version: draft.version,
    title: draft.title,
    date: draft.date,
    overview: draft.overview,
    buffs: draft.buffs,
    changes: draft.changes,
    softCurrency: draft.softCurrency,
    packTickets: draft.packTickets,
  };
  const putPublished = await fetch(`${url}/${draft.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
    body: JSON.stringify(patchInput),
  });
  assert.equal(putPublished.status, 409);
  const republish = await fetch(publishUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": "listed-admin", origin, "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ confirmVersion: draft.updatedAt }),
  });
  assert.equal(republish.status, 409);
  await db.delete(patchDraftsTable).where(eq(patchDraftsTable.id, draft.id));
});
test("prepared release letter matches the exact authoritative rendering", () => {
  const fixture = JSON.parse(readFileSync(new URL('../../../deliverables/release-mail-1-11/mail-preview.json', import.meta.url), 'utf8'));
  assert.deepEqual(makePatchLetter(release), fixture);
  assert.equal(release.packTickets, 10);
});
