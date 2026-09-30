import { createHash } from "node:crypto";
import { and, asc, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, patchDeliveryTargetsTable, patchDraftsTable, playerProfilesTable } from "@workspace/db";
import type { PatchContent, PatchDraftRecord } from "@workspace/db";
import { isMail, parseMail, type Mail } from "./mail";

const DELIVERY_BATCH_SIZE = 25;
const MAX_AUTOMATIC_ATTEMPTS = 3;
const TARGET_AUDIENCE_FILTER = sql`${playerProfilesTable.clerkUserId} <> 'e2e-player'`;
const AUTOMATIC_WORK_FILTER = sql`(
  ${patchDeliveryTargetsTable.status} = 'pending'
  OR (${patchDeliveryTargetsTable.status} = 'failed' AND ${patchDeliveryTargetsTable.attempts} < ${MAX_AUTOMATIC_ATTEMPTS})
)`;

export function adminPatchRecord(record: PatchDraftRecord) {
  return {
    id: record.id,
    version: record.version,
    title: record.title,
    date: record.patchDate,
    overview: record.overview,
    buffs: record.buffs,
    changes: record.changes,
    softCurrency: record.softCurrency,
    packTickets: record.packTickets,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    createdBy: record.createdBy,
    publishedBy: record.publishedBy,
    intendedCount: record.intendedCount,
    deliveredCount: record.deliveredCount,
    failedCount: record.failedCount,
    lastError: record.lastError,
    campaignId: record.campaignId,
  };
}

function campaignId(version: string): string {
  const slug = version.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "version";
  const digest = createHash("sha256").update(version).digest("hex").slice(0, 16);
  return `patch_${slug}_${digest}`;
}

export function makePatchLetter(patch: PatchContent): Omit<Mail, "sentAt" | "readAt" | "claimedAt"> {
  const displayDate = new Date(`${patch.date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const title = `Patch ${patch.version}: ${patch.title}`;
  const body = [
    `Patch ${patch.version} · ${displayDate}`,
    patch.title,
    "",
    patch.overview,
    ...(patch.buffs.length ? ["", "Buffs", ...patch.buffs.map(item => `• ${item}`)] : []),
    ...(patch.changes.length ? ["", "Changes", ...patch.changes.map(item => `• ${item}`)] : []),
  ].join("\n");
  if (title.length > 120) throw new Error("Patch mail title exceeds 120 characters.");
  if (body.length > 6000) throw new Error("Patch letter exceeds the supported mail length.");
  return {
    id: campaignId(patch.version),
    title,
    body,
    sender: "Squabblemon Team",
    gift: { softCurrency: patch.softCurrency, packTickets: patch.packTickets, styleShards: 0 },
  };
}

function patchContent(record: PatchDraftRecord): PatchContent {
  return {
    version: record.version,
    title: record.title,
    date: record.patchDate,
    overview: record.overview,
    buffs: record.buffs,
    changes: record.changes,
    softCurrency: record.softCurrency,
    packTickets: record.packTickets,
  };
}

export async function listPublicPatches() {
  const rows = await db.select({
    id: patchDraftsTable.id,
    version: patchDraftsTable.version,
    title: patchDraftsTable.title,
    patchDate: patchDraftsTable.patchDate,
    overview: patchDraftsTable.overview,
    buffs: patchDraftsTable.buffs,
    changes: patchDraftsTable.changes,
    publishedAt: patchDraftsTable.publishedAt,
  }).from(patchDraftsTable)
    .where(and(eq(patchDraftsTable.status, "published"), isNotNull(patchDraftsTable.publishedAt)))
    .orderBy(sql`${patchDraftsTable.publishedAt} DESC`, asc(patchDraftsTable.version))
    .limit(100);
  const activePatchIds = rows.length ? new Set((await db.select({ patchId: patchDeliveryTargetsTable.patchId })
    .from(patchDeliveryTargetsTable)
    .where(and(
      inArray(patchDeliveryTargetsTable.patchId, rows.map(record => record.id)),
      AUTOMATIC_WORK_FILTER,
    ))
    .groupBy(patchDeliveryTargetsTable.patchId)).map(target => target.patchId)) : new Set<string>();
  const partialPatchIds = rows.length ? new Set((await db.select({ patchId: patchDeliveryTargetsTable.patchId })
    .from(patchDeliveryTargetsTable)
    .where(and(
      inArray(patchDeliveryTargetsTable.patchId, rows.map(record => record.id)),
      sql`${patchDeliveryTargetsTable.status} = 'missing' OR (${patchDeliveryTargetsTable.status} = 'failed' AND ${patchDeliveryTargetsTable.attempts} >= ${MAX_AUTOMATIC_ATTEMPTS})`,
    ))
    .groupBy(patchDeliveryTargetsTable.patchId)).map(target => target.patchId)) : new Set<string>();
  return rows.map(record => ({
    version: record.version,
    title: record.title,
    date: record.patchDate,
    overview: record.overview,
    buffs: record.buffs,
    changes: record.changes,
    publishedAt: record.publishedAt!.toISOString(),
    mailStatus: activePatchIds.has(record.id)
      ? "delivering" as const
      : partialPatchIds.has(record.id) ? "partial" as const : "complete" as const,
  }));
}

export async function listAdminPatches() {
  const rows = await db.select().from(patchDraftsTable)
    .orderBy(sql`${patchDraftsTable.updatedAt} DESC`)
    .limit(100);
  return rows.map(adminPatchRecord);
}

export async function getAdminPatch(id: string) {
  const [record] = await db.select().from(patchDraftsTable).where(eq(patchDraftsTable.id, id));
  return record ? adminPatchRecord(record) : undefined;
}

export async function createPatchDraft(input: PatchContent, userId: string) {
  const [record] = await db.insert(patchDraftsTable).values({
    version: input.version.trim(),
    title: input.title.trim(),
    patchDate: input.date,
    overview: input.overview.trim(),
    buffs: input.buffs.map(item => item.trim()),
    changes: input.changes.map(item => item.trim()),
    softCurrency: input.softCurrency ?? 50,
    packTickets: input.packTickets ?? 0,
    createdBy: userId,
  }).returning();
  return adminPatchRecord(record);
}

export async function updatePatchDraft(id: string, input: PatchContent) {
  const [record] = await db.update(patchDraftsTable).set({
    version: input.version.trim(),
    title: input.title.trim(),
    patchDate: input.date,
    overview: input.overview.trim(),
    buffs: input.buffs.map(item => item.trim()),
    changes: input.changes.map(item => item.trim()),
    softCurrency: input.softCurrency ?? 50,
    packTickets: input.packTickets ?? 0,
    // A strict monotonic edit stamp prevents stale publish confirmations even
    // when two edits occur within one JS millisecond.
    updatedAt: sql`GREATEST(clock_timestamp(), ${patchDraftsTable.updatedAt} + interval '1 millisecond')`,
  }).where(and(eq(patchDraftsTable.id, id), eq(patchDraftsTable.status, "draft"))).returning();
  return record ? adminPatchRecord(record) : undefined;
}

export async function previewPatch(id: string) {
  const [record] = await db.select().from(patchDraftsTable).where(eq(patchDraftsTable.id, id));
  if (!record) return undefined;
  const [audience] = await db.select({ value: count() }).from(playerProfilesTable).where(TARGET_AUDIENCE_FILTER);
  return {
    patch: adminPatchRecord(record),
    letter: makePatchLetter(patchContent(record)),
    audienceCount: audience.value,
  };
}

export async function publishPatch(id: string, confirmVersion: string, userId: string) {
  return db.transaction(async tx => {
    const [record] = await tx.select().from(patchDraftsTable).where(eq(patchDraftsTable.id, id)).for("update");
    if (!record) return { kind: "missing" as const };
    if (record.status !== "draft" || record.updatedAt.toISOString() !== confirmVersion) return { kind: "conflict" as const };
    const mail = makePatchLetter(patchContent(record));
    await tx.execute(sql`
      INSERT INTO patch_delivery_targets (patch_id, clerk_user_id)
      SELECT ${record.id}::uuid, ${playerProfilesTable.clerkUserId}
      FROM ${playerProfilesTable}
      WHERE ${TARGET_AUDIENCE_FILTER}
      ON CONFLICT (patch_id, clerk_user_id) DO NOTHING
    `);
    const [audience] = await tx.select({ value: count() }).from(patchDeliveryTargetsTable)
      .where(eq(patchDeliveryTargetsTable.patchId, record.id));
    const publishedAt = new Date();
    const [updated] = await tx.update(patchDraftsTable).set({
      status: "published",
      publishedAt,
      publishedBy: userId,
      intendedCount: audience.value,
      deliveredCount: 0,
      failedCount: 0,
      campaignId: mail.id,
      lastError: null,
      updatedAt: publishedAt,
    }).where(eq(patchDraftsTable.id, record.id)).returning();
    return { kind: "published" as const, patch: adminPatchRecord(updated) };
  });
}

async function processPatchBatch(patchId: string, limit: number, includeExhausted = false): Promise<number> {
  return db.transaction(async tx => {
    const [patch] = await tx.select().from(patchDraftsTable).where(eq(patchDraftsTable.id, patchId)).for("update");
    if (!patch || patch.status !== "published") return 0;
    const mailBase = makePatchLetter(patchContent(patch));
    const targets = await tx.select().from(patchDeliveryTargetsTable)
      .where(and(
        eq(patchDeliveryTargetsTable.patchId, patchId),
        includeExhausted
          ? inArray(patchDeliveryTargetsTable.status, ["pending", "failed"])
          : AUTOMATIC_WORK_FILTER,
      ))
      .orderBy(asc(patchDeliveryTargetsTable.clerkUserId))
      .limit(limit)
      .for("update", { skipLocked: true });
    for (const target of targets) {
      try {
        const [profile] = await tx.select().from(playerProfilesTable)
          .where(eq(playerProfilesTable.clerkUserId, target.clerkUserId)).for("update");
        if (!profile) {
          await tx.update(patchDeliveryTargetsTable).set({
            status: "missing",
            attempts: target.attempts + 1,
            lastError: "Recipient profile was removed before delivery.",
          }).where(eq(patchDeliveryTargetsTable.id, target.id));
          continue;
        }
        if (target.clerkUserId === "e2e-player") throw new Error("Fixture account excluded from patch delivery.");
        const existing = profile.inbox.find(item => (item as { id?: unknown })?.id === mailBase.id);
        let inbox = profile.inbox;
        if (existing) {
          if (!isMail(existing) || existing.title !== mailBase.title || existing.body !== mailBase.body ||
            existing.sender !== mailBase.sender ||
            existing.gift.softCurrency !== mailBase.gift.softCurrency ||
            existing.gift.packTickets !== mailBase.gift.packTickets ||
            existing.gift.styleShards !== mailBase.gift.styleShards) {
            throw new Error("Campaign ID already exists with different content.");
          }
        } else {
          inbox = [...profile.inbox, parseMail({ ...mailBase, sentAt: new Date().toISOString(), readAt: null, claimedAt: null })];
          await tx.update(playerProfilesTable).set({ inbox }).where(eq(playerProfilesTable.clerkUserId, target.clerkUserId));
        }
        await tx.update(patchDeliveryTargetsTable).set({
          status: "delivered",
          attempts: target.attempts + 1,
          deliveredAt: new Date(),
          lastError: null,
        }).where(eq(patchDeliveryTargetsTable.id, target.id));
      } catch {
        await tx.update(patchDeliveryTargetsTable).set({
          status: "failed",
          attempts: target.attempts + 1,
          lastError: "Delivery failed; it is queued for automatic retry.",
        }).where(eq(patchDeliveryTargetsTable.id, target.id));
      }
    }
    const [stats] = await tx.select({
      delivered: sql<number>`count(*) FILTER (WHERE ${patchDeliveryTargetsTable.status} = 'delivered')::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${patchDeliveryTargetsTable.status} IN ('failed', 'missing'))::int`,
      retryable: sql<number>`count(*) FILTER (WHERE ${patchDeliveryTargetsTable.status} = 'failed' AND ${patchDeliveryTargetsTable.attempts} < ${MAX_AUTOMATIC_ATTEMPTS})::int`,
      exhausted: sql<number>`count(*) FILTER (WHERE ${patchDeliveryTargetsTable.status} = 'failed' AND ${patchDeliveryTargetsTable.attempts} >= ${MAX_AUTOMATIC_ATTEMPTS})::int`,
      missing: sql<number>`count(*) FILTER (WHERE ${patchDeliveryTargetsTable.status} = 'missing')::int`,
    }).from(patchDeliveryTargetsTable).where(eq(patchDeliveryTargetsTable.patchId, patchId));
    await tx.update(patchDraftsTable).set({
      deliveredCount: stats.delivered,
      failedCount: stats.failed,
      lastError: stats.retryable
        ? "Some deliveries failed and are queued for automatic retry."
        : stats.exhausted || stats.missing ? "Some deliveries need manual retry or the recipient account was removed." : null,
      updatedAt: new Date(),
    }).where(eq(patchDraftsTable.id, patchId));
    return targets.length;
  });
}

export async function processPatchDeliveryBatch(patchId: string, includeExhausted = false) {
  return processPatchBatch(patchId, DELIVERY_BATCH_SIZE, includeExhausted);
}

/** A scheduled worker processes a handful of independently committed batches per invocation. */
export async function processOutstandingPatchBatches(maxPatches = 5) {
  const candidates = await db.select({ id: patchDraftsTable.id }).from(patchDeliveryTargetsTable)
    .innerJoin(patchDraftsTable, eq(patchDeliveryTargetsTable.patchId, patchDraftsTable.id))
    .where(and(
      eq(patchDraftsTable.status, "published"),
      AUTOMATIC_WORK_FILTER,
    ))
    .groupBy(patchDraftsTable.id, patchDraftsTable.publishedAt)
    .orderBy(asc(patchDraftsTable.publishedAt), asc(patchDraftsTable.id))
    .limit(maxPatches);
  let processed = 0;
  for (const patch of candidates) processed += await processPatchBatch(patch.id, DELIVERY_BATCH_SIZE);
  return processed;
}