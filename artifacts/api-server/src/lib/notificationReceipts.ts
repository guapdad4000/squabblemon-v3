import { and, eq, like } from 'drizzle-orm';
import { db, playerCollectionClaimsTable } from '@workspace/db';

const PREFIX = 'notification:v1:';
export const MAX_NOTIFICATION_RECEIPTS_PER_REQUEST = 250;

export function cleanNotificationReceiptIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string =>
    typeof id === 'string' && id.length > 0 && id.length <= 512,
  ))].slice(0, MAX_NOTIFICATION_RECEIPTS_PER_REQUEST);
}

function receiptKey(id: string) {
  return `${PREFIX}${Buffer.from(id).toString('base64url')}`;
}

export async function getNotificationReceipts(userId: string): Promise<string[]> {
  const rows = await db.select({ reward: playerCollectionClaimsTable.reward })
    .from(playerCollectionClaimsTable)
    .where(and(
      eq(playerCollectionClaimsTable.clerkUserId, userId),
      like(playerCollectionClaimsTable.milestoneKey, `${PREFIX}%`),
    ));
  return [...new Set(rows.flatMap(row => {
    const id = row.reward.notificationReceipt?.id;
    return typeof id === 'string' ? [id] : [];
  }))];
}

export async function saveNotificationReceipts(userId: string, input: unknown): Promise<string[]> {
  const ids = cleanNotificationReceiptIds(input);
  if (ids.length) {
    await db.insert(playerCollectionClaimsTable).values(ids.map(id => ({
      clerkUserId: userId,
      milestoneKey: receiptKey(id),
      reward: { notificationReceipt: { id } },
    }))).onConflictDoNothing();
  }
  return getNotificationReceipts(userId);
}
