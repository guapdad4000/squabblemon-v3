import { readFile, writeFile } from "node:fs/promises";
import { assertCampaignDatabaseTarget } from "./database-safety.mjs";
import { pool } from "../lib/db/src/index.ts";
import {
  expectedCampaignDisplayName,
  lockedCampaignProfileName,
  type CampaignCleanupManifest,
} from "../artifacts/api-server/src/lib/campaignCleanupSafety.ts";

const manifestPath = process.env.CAMPAIGN_E2E_MANIFEST;
const expectedRunId = process.env.CAMPAIGN_E2E_RUN_ID;
const expectedEnvironment = process.env.CAMPAIGN_E2E_EXPECT_ENVIRONMENT;
const expectedEmail = process.env.CAMPAIGN_E2E_EMAIL;
const expectedOrigin = process.env.CAMPAIGN_E2E_ORIGIN;
const expectedDeployId = process.env.CAMPAIGN_E2E_DEPLOY_ID;

if (!manifestPath || !expectedRunId) {
  throw new Error("Cleanup requires CAMPAIGN_E2E_MANIFEST and CAMPAIGN_E2E_RUN_ID.");
}
if (!expectedEmail || !expectedOrigin || !expectedDeployId) {
  throw new Error("Cleanup requires the exact campaign email, origin, and deployment ID.");
}
if (!process.env.CLERK_SECRET_KEY) {
  throw new Error("Cleanup requires CLERK_SECRET_KEY; database deletion will not start without identity cleanup credentials.");
}
if (!expectedEnvironment || expectedEnvironment !== process.env.APP_ENV) {
  throw new Error("Cleanup requires matching explicit and database deployment environments.");
}
const requiredClerkPrefix = process.env.APP_ENV === "production" ? "sk_live_" : "sk_test_";
if (!process.env.CLERK_SECRET_KEY.startsWith(requiredClerkPrefix)) {
  throw new Error(`${process.env.APP_ENV} cleanup requires a ${requiredClerkPrefix} Clerk secret.`);
}

const target = assertCampaignDatabaseTarget(process.env);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const validStage =
  manifest.stage === "clerk-created" || manifest.stage === "profile-created";
const validInitialName =
  manifest.stage === "profile-created"
    ? typeof manifest.initialDisplayName === "string" && manifest.initialDisplayName.length > 0
    : manifest.initialDisplayName === undefined;
if (
  manifest.version !== 1 ||
  !validStage ||
  !validInitialName ||
  manifest.environment !== expectedEnvironment ||
  manifest.runId !== expectedRunId ||
  typeof manifest.clerkUserId !== "string" ||
  manifest.clerkEmail !== expectedEmail ||
  !/^user_[A-Za-z0-9]+$/.test(manifest.clerkUserId) ||
  manifest.databaseFingerprint !== target.fingerprint ||
  manifest.origin !== expectedOrigin ||
  manifest.deployId !== expectedDeployId
) {
  throw new Error("Cleanup manifest does not match this run, Clerk user, and database.");
}

const createdAt = new Date(manifest.createdAt);
const createdAtMs = createdAt.getTime();
if (
  !Number.isFinite(createdAtMs) ||
  createdAtMs > Date.now() + 5 * 60_000 ||
  Date.now() - createdAtMs > 24 * 60 * 60 * 1000
) {
  throw new Error("Cleanup manifest creation time is invalid or older than 24 hours.");
}

const cleanupIdentity: CampaignCleanupManifest = {
  stage: manifest.stage,
  runId: manifest.runId,
  clerkUserId: manifest.clerkUserId,
  createdAt: manifest.createdAt,
  ...(manifest.initialDisplayName === undefined
    ? {}
    : { initialDisplayName: manifest.initialDisplayName }),
};
const expectedName = expectedCampaignDisplayName(expectedRunId);
const clerkAlreadyDeleted = typeof manifest.clerkDeletedAt === "string";
if (
  manifest.clerkDeletedAt !== undefined &&
  !Number.isFinite(new Date(manifest.clerkDeletedAt).getTime())
) {
  throw new Error("Cleanup manifest has an invalid Clerk deletion timestamp.");
}

if (!clerkAlreadyDeleted) {
  const clerkLookup = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(manifest.clerkUserId)}`,
    {
      headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!clerkLookup.ok) {
    throw new Error(`Clerk identity verification failed with status ${clerkLookup.status}; database cleanup refused.`);
  }
  const clerkUser = await clerkLookup.json();
  const addresses = Array.isArray(clerkUser.email_addresses)
    ? clerkUser.email_addresses.map(item => item?.email_address?.toLowerCase())
    : [];
  const clerkCreatedAt =
    typeof clerkUser.created_at === "number"
      ? clerkUser.created_at
      : new Date(clerkUser.created_at).getTime();
  if (
    clerkUser.id !== manifest.clerkUserId ||
    !addresses.includes(manifest.clerkEmail.toLowerCase()) ||
    !Number.isFinite(clerkCreatedAt) ||
    clerkCreatedAt < createdAtMs - 10 * 60_000 ||
    clerkCreatedAt > createdAtMs + 5 * 60_000
  ) {
    throw new Error("Clerk user does not match the exact campaign manifest; database cleanup refused.");
  }
}

const client = await pool.connect();
try {
  // Refuse unexpected database state before removing the recoverable Clerk
  // identity. This transaction is deliberately read-only.
  await client.query("begin");
  const preflightProfile = await client.query(
    "select display_name, created_at from player_profiles where clerk_user_id = $1 for update",
    [manifest.clerkUserId],
  );
  lockedCampaignProfileName(preflightProfile.rows, cleanupIdentity);
  const rooms = await client.query(
    "select count(*)::int as count from online_rooms where host_user_id = $1 or guest_user_id = $1",
    [manifest.clerkUserId],
  );
  if (Number(rooms.rows[0]?.count ?? 0) !== 0) {
    throw new Error("Campaign profile owns a multiplayer room; cleanup refused.");
  }
  await client.query("rollback");

  if (!clerkAlreadyDeleted) {
    const clerkResponse = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(manifest.clerkUserId)}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!clerkResponse.ok) {
      throw new Error(`Clerk cleanup failed with status ${clerkResponse.status}.`);
    }
    manifest.clerkDeletedAt = new Date().toISOString();
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  await client.query("begin");
  const lockedProfile = await client.query(
    "select display_name, created_at from player_profiles where clerk_user_id = $1 for update",
    [manifest.clerkUserId],
  );
  const lockedDisplayName = lockedCampaignProfileName(
    lockedProfile.rows,
    cleanupIdentity,
  );
  if (lockedDisplayName !== null) {
    const removed = await client.query(
      "delete from player_profiles where clerk_user_id = $1 and display_name = $2 returning clerk_user_id",
      [manifest.clerkUserId, lockedDisplayName],
    );
    if (removed.rowCount !== 1) {
      throw new Error("Exact campaign profile delete did not remove one row.");
    }
  }
  await client.query("commit");

  const remaining = await client.query(
    `select
      (select count(*) from player_profiles where clerk_user_id = $1) +
      (select count(*) from player_missions where clerk_user_id = $1) +
      (select count(*) from player_matches where clerk_user_id = $1) +
      (select count(*) from player_pack_openings where clerk_user_id = $1) +
      (select count(*) from player_collection_claims where clerk_user_id = $1) +
      (select count(*) from player_story_nodes where clerk_user_id = $1) +
      (select count(*) from player_story_actions where clerk_user_id = $1) +
      (select count(*) from player_story_reward_claims where clerk_user_id = $1) +
      (select count(*) from online_rooms where host_user_id = $1 or guest_user_id = $1) as count`,
    [manifest.clerkUserId],
  );
  if (Number(remaining.rows[0]?.count ?? 0) !== 0) {
    throw new Error("Campaign cascade cleanup left player-owned rows.");
  }
  manifest.cleanupCompletedAt = new Date().toISOString();
  manifest.cleanupProfileDisplayName = lockedDisplayName ?? null;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  process.stdout.write(
    `Campaign account cleanup completed for database ${target.fingerprint}; expected profile tag ${expectedName}.\n`,
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch {}
  throw error;
} finally {
  client.release();
  await pool.end();
}