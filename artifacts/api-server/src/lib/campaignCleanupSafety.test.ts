import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
  expectedCampaignDisplayName,
  lockedCampaignProfileName,
  type CampaignCleanupManifest,
} from "./campaignCleanupSafety";

const now = Date.parse("2026-09-19T12:00:00.000Z");
const baseManifest: CampaignCleanupManifest = {
  stage: "clerk-created",
  runId: "campaign-20260919",
  clerkUserId: "user_campaign",
  createdAt: new Date(now).toISOString(),
};

test("provisional cleanup accepts an absent profile or the untouched database default", () => {
  assert.equal(lockedCampaignProfileName([], baseManifest, now), null);
  assert.equal(
    lockedCampaignProfileName([
      {
        display_name: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
        created_at: new Date(now),
      },
    ], baseManifest, now),
    DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
  );
});

test("enriched cleanup returns the exact locked initial or campaign display name", () => {
  const manifest: CampaignCleanupManifest = {
    ...baseManifest,
    stage: "profile-created",
    initialDisplayName: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
  };
  assert.equal(
    lockedCampaignProfileName([
      {
        display_name: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
        created_at: new Date(now),
      },
    ], manifest, now),
    DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
  );
  assert.equal(
    lockedCampaignProfileName([
      {
        display_name: expectedCampaignDisplayName(manifest.runId),
        created_at: new Date(now),
      },
    ], manifest, now),
    "Campaign campaign",
  );
});

test("cleanup rejects unrelated, stale, future, or ambiguous profiles", () => {
  const manifest: CampaignCleanupManifest = {
    ...baseManifest,
    stage: "profile-created",
    initialDisplayName: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
  };
  assert.throws(
    () => lockedCampaignProfileName([
      { display_name: "Another Player", created_at: new Date(now) },
    ], manifest, now),
    /identity/,
  );
  assert.throws(
    () => lockedCampaignProfileName([
      {
        display_name: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
        created_at: new Date(now - 6 * 60_000),
      },
    ], manifest, now),
    /creation time/,
  );
  assert.throws(
    () => lockedCampaignProfileName([
      {
        display_name: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
        created_at: new Date(now + 6 * 60_000),
      },
    ], manifest, now),
    /creation time/,
  );
  assert.throws(
    () => lockedCampaignProfileName([
      {
        display_name: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
        created_at: new Date(now),
      },
      {
        display_name: DEFAULT_NEW_ACCOUNT_DISPLAY_NAME,
        created_at: new Date(now),
      },
    ], manifest, now),
    /more than one/,
  );
});

test("provisional cleanup never accepts a profile that onboarding renamed", () => {
  assert.throws(
    () => lockedCampaignProfileName([
      {
        display_name: expectedCampaignDisplayName(baseManifest.runId),
        created_at: new Date(now),
      },
    ], baseManifest, now),
    /identity/,
  );
});