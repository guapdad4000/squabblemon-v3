import { eq } from 'drizzle-orm';
import { db, playerProfilesTable as profiles } from '@workspace/db';

export type Mail = { id: string; title: string; body: string; sender: string; sentAt: string; readAt: string | null; claimedAt: string | null; gift: { softCurrency: number; packTickets: number; styleShards: number } };
export function parseMail(input: unknown): Mail {
  const m = input as Mail;
  if (!m || typeof m.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(m.id) || typeof m.title !== 'string' || !m.title.trim() || m.title.length > 120 || typeof m.body !== 'string' || !m.body.trim() || m.body.length > 6000 || typeof m.sender !== 'string' || !m.sender.trim() || m.sender.length > 80) throw new Error('Invalid mail content');
  const gift = m.gift ?? { softCurrency: 0, packTickets: 0, styleShards: 0 };
  for (const key of ['softCurrency', 'packTickets', 'styleShards'] as const) if (!Number.isSafeInteger(gift[key]) || gift[key] < 0 || gift[key] > 1000000) throw new Error('Invalid mail gift');
  return { id: m.id, title: m.title, body: m.body, sender: m.sender, gift: { softCurrency: gift.softCurrency, packTickets: gift.packTickets, styleShards: gift.styleShards }, sentAt: new Date().toISOString(), readAt: null, claimedAt: null };
}
export function isMail(value: unknown): value is Mail {
  try {
    parseMail(value);
    const m = value as Mail;
    return !!m.gift && typeof m.sentAt === 'string' && Number.isFinite(Date.parse(m.sentAt)) && (m.readAt === null || typeof m.readAt === 'string') && (m.claimedAt === null || typeof m.claimedAt === 'string');
  } catch { return false; }
}
export async function getMail(userId: string) {
  const [profile] = await db.select({ inbox: profiles.inbox }).from(profiles).where(eq(profiles.clerkUserId, userId));
  if (!profile) throw new Error('Profile not found');
  return profile.inbox.filter(isMail).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
export async function updateMail(userId: string, id: string, claim: boolean) {
  return db.transaction(async tx => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.clerkUserId, userId)).for('update');
    if (!profile) throw new Error('Profile not found');
    const item = profile.inbox.find(m => m.id === id);
    if (!item || !isMail(item)) throw new Error('Mail not found');
    const now = new Date().toISOString();
    const credit = claim && !item.claimedAt;
    const next = { ...item, readAt: item.readAt ?? now, claimedAt: claim ? item.claimedAt ?? now : item.claimedAt };
    const wallet = { softCurrency: profile.softCurrency, packTickets: profile.packTickets, styleShards: profile.styleShards };
    if (credit) for (const key of ['softCurrency', 'packTickets', 'styleShards'] as const) {
      wallet[key] += item.gift[key];
      if (!Number.isSafeInteger(wallet[key]) || wallet[key] > 2147483647) throw new Error('Wallet limit reached');
    }
    await tx.update(profiles).set({ ...wallet, inbox: profile.inbox.map(m => m.id === id ? next : m) }).where(eq(profiles.clerkUserId, userId));
    return { mail: next, credited: credit };
  });
}
/** Server/operator only. A stable campaign ID makes interrupted sends safe to retry. */
export async function deliverMail(input: unknown, recipients: 'all' | string[], apply = false) {
  const mail = parseMail(input);
  const targets = recipients === 'all' ? (await db.select({ id: profiles.clerkUserId }).from(profiles)).map(p => p.id) : [...new Set(recipients)];
  if (targets.some(id => !id.trim())) throw new Error('Empty recipient');
  const checkExisting = (existing: Record<string, unknown> | undefined) => {
    if (existing && (!isMail(existing) || existing.title !== mail.title || existing.body !== mail.body || existing.sender !== mail.sender || (['softCurrency', 'packTickets', 'styleShards'] as const).some(key => existing.gift[key] !== mail.gift[key]))) throw new Error('Campaign ID already used with different content');
  };
  // Preflight every target, including dry runs, before delivering any packages.
  for (const id of targets) {
    const [profile] = await db.select({ inbox: profiles.inbox }).from(profiles).where(eq(profiles.clerkUserId, id));
    if (!profile) throw new Error(`Recipient profile missing: ${id}`);
    checkExisting(profile.inbox.find(m => m.id === mail.id));
  }
  let delivered = 0;
  for (const id of targets) {
    if (!apply) continue;
    await db.transaction(async tx => {
      const [profile] = await tx.select().from(profiles).where(eq(profiles.clerkUserId, id)).for('update');
      if (!profile) throw new Error(`Recipient profile missing: ${id}`);
      const existing = profile.inbox.find(m => m.id === mail.id);
      if (existing) {
        checkExisting(existing);
        return;
      }
      await tx.update(profiles).set({ inbox: [...profile.inbox, mail] }).where(eq(profiles.clerkUserId, id));
      delivered++;
    });
  }
  return { campaign: mail.id, recipients: targets.length, delivered, apply };
}
