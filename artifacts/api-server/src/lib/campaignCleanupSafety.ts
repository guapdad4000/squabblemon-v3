export const DEFAULT_NEW_ACCOUNT_DISPLAY_NAME = "New Challenger";

export type CampaignCleanupManifest = {
  stage: "clerk-created" | "profile-created";
  runId: string;
  clerkUserId: string;
  initialDisplayName?: string;
  createdAt: string;
};

export type CampaignCleanupProfile = {
  display_name: unknown;
  created_at: unknown;
};

export function expectedCampaignDisplayName(runId: string): string {
  return `Campaign ${runId.slice(0, 8)}`;
}

/**
 * Validates a row locked by the cleanup transaction and returns the exact
 * display name that must be used by the delete statement. A provisional
 * manifest can only own the untouched database default because the remote
 * runner enriches the manifest before submitting onboarding.
 */
export function lockedCampaignProfileName(
  rows: CampaignCleanupProfile[],
  manifest: CampaignCleanupManifest,
  now = Date.now(),
): string | null {
  if (rows.length > 1) {
    throw new Error("Campaign profile identity query returned more than one row.");
  }
  if (rows.length === 0) return null;

  const profile = rows[0];
  if (typeof profile.display_name !== "string" || !profile.display_name) {
    throw new Error("Campaign profile has an invalid display name.");
  }

  const runCreatedAt = new Date(manifest.createdAt).getTime();
  const profileCreatedAt =
    profile.created_at instanceof Date
      ? profile.created_at.getTime()
      : new Date(profile.created_at as string | number).getTime();
  if (!Number.isFinite(runCreatedAt) || !Number.isFinite(profileCreatedAt)) {
    throw new Error("Campaign profile creation time is invalid.");
  }
  if (
    profileCreatedAt < runCreatedAt - 5 * 60_000 ||
    profileCreatedAt > now + 5 * 60_000
  ) {
    throw new Error("Campaign profile creation time does not belong to this run.");
  }

  const expectedName = expectedCampaignDisplayName(manifest.runId);
  const allowedNames =
    manifest.stage === "profile-created"
      ? new Set([manifest.initialDisplayName, expectedName])
      : new Set([DEFAULT_NEW_ACCOUNT_DISPLAY_NAME]);

  if (!allowedNames.has(profile.display_name)) {
    throw new Error("Exact campaign profile identity check failed.");
  }
  return profile.display_name;
}