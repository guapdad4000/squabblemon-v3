import { db, playerProfilesTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { validateCosmeticLoadout, type CosmeticLoadout } from '@workspace/squabblemon-engine/cosmetics';
import { lockPlayerProfile } from './playerRewardTransactions';
import { EconomyTransactionError } from './collectionTransactions';

export async function equipCosmetics(userId: string, loadout: CosmeticLoadout) {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new EconomyTransactionError(404, 'Player profile not found.');
    const invalid = validateCosmeticLoadout(profile, loadout);
    if (invalid) throw new EconomyTransactionError(400, invalid);
    await tx.update(playerProfilesTable).set({ settings: { ...profile.settings, cosmetics: loadout } }).where(eq(playerProfilesTable.clerkUserId, userId));
  });
}
