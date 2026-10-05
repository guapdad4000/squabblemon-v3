import { and, eq, sql } from 'drizzle-orm';
import {
  db,
  playerCollectionClaimsTable as claims,
  playerProfilesTable as profiles,
  socialIdentitiesTable as identities,
} from '@workspace/db';
import { normalizeCardProgress } from '@workspace/squabblemon-engine/cardProgression';
import { parseMail } from './mail';

const USERNAME = 'superduperkyle_750d071f';
const CARD_ID = 'guap';
const CARD_NAME = 'GUAP';
const PACK_TICKETS = 20;
const KEY = 'operator:superduperkyle-guap-20-tickets-2026-10-04';
const MAIL_ID = 'gift_superduperkyle_guap_20_20261004';
const receipt = { code: 'SUPERDUPERKYLE_GUAP_20', packTickets: PACK_TICKETS, softCurrency: 0, styleShards: 0, cardIds: [CARD_ID] };

export class SuperduperkyleGiftError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function identity() {
  const [row] = await db.select({
    userId: identities.userId,
    username: identities.username,
    displayName: profiles.displayName,
    lastActiveAt: profiles.lastActiveAt,
    ownedCardIds: profiles.ownedCardIds,
  }).from(identities).innerJoin(profiles, eq(profiles.clerkUserId, identities.userId)).where(eq(identities.username, USERNAME));
  if (!row || !row.username) throw new SuperduperkyleGiftError(404, 'The requested player profile was not found.');
  return row;
}

export async function previewSuperduperkyleGift() {
  const player = await identity();
  const [existing] = await db.select({ id: claims.id }).from(claims).where(and(
    eq(claims.clerkUserId, player.userId), eq(claims.milestoneKey, KEY),
  ));
  return {
    player: { displayName: player.displayName, username: player.username, lastActiveAt: player.lastActiveAt.toISOString() },
    gift: { cardId: CARD_ID, cardName: CARD_NAME, packTickets: PACK_TICKETS },
    alreadyOwnsCard: player.ownedCardIds.includes(CARD_ID),
    alreadyGranted: Boolean(existing),
  };
}

export async function sendSuperduperkyleGift() {
  const player = await identity();
  return db.transaction(async tx => {
    await tx.execute(sql`select ${profiles.clerkUserId} from ${profiles} where ${profiles.clerkUserId} = ${player.userId} for update`);
    const [profile] = await tx.select().from(profiles).where(eq(profiles.clerkUserId, player.userId));
    if (!profile) throw new SuperduperkyleGiftError(404, 'The requested player profile was not found.');
    const [existing] = await tx.select().from(claims).where(and(eq(claims.clerkUserId, player.userId), eq(claims.milestoneKey, KEY)));
    if (existing) return { player: { displayName: profile.displayName, username: USERNAME }, gift: receipt, alreadyGranted: true };

    const nextTickets = profile.packTickets + PACK_TICKETS;
    if (!Number.isSafeInteger(nextTickets) || nextTickets > 2_147_483_647) throw new SuperduperkyleGiftError(409, 'The player wallet cannot receive the ticket gift.');
    const owned = new Set(profile.ownedCardIds); owned.add(CARD_ID);
    const discovered = new Set(profile.discoveredCardIds); discovered.add(CARD_ID);
    const cardProgression = { ...profile.cardProgression, [CARD_ID]: normalizeCardProgress(profile.cardProgression[CARD_ID]) };
    const mail = parseMail({
      id: MAIL_ID,
      title: 'GUAP pulled up.',
      sender: 'The Squabblemon Team',
      body: 'GUAP and 20 Pack Tickets were added straight to your account. Run the city.',
      gift: { softCurrency: 0, packTickets: 0, styleShards: 0 },
    });
    if (profile.inbox.some(item => item.id === MAIL_ID)) throw new SuperduperkyleGiftError(409, 'The gift receipt already exists without its grant ledger.');
    await tx.update(profiles).set({
      packTickets: nextTickets,
      ownedCardIds: [...owned],
      discoveredCardIds: [...discovered],
      collectionProgress: owned.size,
      cardProgression,
      inbox: [...profile.inbox, mail],
    }).where(eq(profiles.clerkUserId, player.userId));
    await tx.insert(claims).values({ clerkUserId: player.userId, milestoneKey: KEY, reward: { promoCode: receipt } });
    return { player: { displayName: profile.displayName, username: USERNAME }, gift: receipt, alreadyGranted: false };
  });
}
