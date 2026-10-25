import { and, eq } from 'drizzle-orm';
import { db, challengeRunsTable, playerMatchesTable } from '@workspace/db';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';

export const rulesUpdatedResponse = {
  code: 'rules-updated',
  error: 'This fade uses an older card balance or battle rules. Start a new fade to continue; your account rewards are unchanged.',
} as const;
export function hasCurrentMatchRules(snapshot: unknown): boolean {
  return !!snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    && (snapshot as { balanceRulesVersion?: number }).balanceRulesVersion === CARD_BALANCE_VERSION;
}

/** Keep the same paid/daily entry and encounter. Archive the old match/prefix;
 * the normal issuance transaction binds at most one fresh replacement. */
export async function recoverChallengeMatchStart(runId: string, userId: string) {
  return db.transaction(async tx => {
    const [run] = await tx.select().from(challengeRunsTable).where(and(
      eq(challengeRunsTable.id, runId), eq(challengeRunsTable.clerkUserId, userId),
      eq(challengeRunsTable.status, 'active'),
    )).for('update');
    if (!run) return null;
    const { playerMatchId, ...encounter } = run.encounterSnapshot as Record<string, unknown>;
    if (typeof playerMatchId !== 'string' || !playerMatchId) return run;
    const [match] = await tx.select().from(playerMatchesTable).where(and(
      eq(playerMatchesTable.id, playerMatchId), eq(playerMatchesTable.clerkUserId, userId),
    ));
    if (!match || match.completedAt || hasCurrentMatchRules(match.playerCardProgressionSnapshot)) return run;
    const [recovered] = await tx.update(challengeRunsTable).set({ encounterSnapshot: encounter, updatedAt: new Date() })
      .where(eq(challengeRunsTable.id, run.id)).returning();
    return recovered;
  });
}
