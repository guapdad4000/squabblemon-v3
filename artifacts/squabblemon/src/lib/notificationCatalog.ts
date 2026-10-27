import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog, catalogCardById } from '../data';
import { CHARACTER_STYLE_SETS } from '@workspace/squabblemon-engine/cosmetics';

type Profile = Pick<PlayerBootstrap['profile'], 'ownedCardIds' | 'unlockedCosmeticIds' | 'ownedVariants'>;
export type CollectionNotice = { id: string; section: 'cards' | 'style' | 'profile' | 'story'; title: string; href: string };

const cardName = (id: string) => Object.hasOwn(catalogCardById, id) ? catalogCardById[id].name : id;
type CatalogCard = typeof cardCatalog[number];
type VariantMatch = { card: CatalogCard; variant: CatalogCard['variantSlots'][number] };
const variants = new Map<string, VariantMatch>();
function findVariant(id: string) {
  // Only authored public metadata is retained; no profile or notice is cached.
  // A first lookup does the original work, without indexing unrelated variants.
  // Only known IDs enter the cache, bounding it to the authored variant catalog.
  const existing = variants.get(id);
  if (existing) return existing;
  const card = cardCatalog.find(candidate => candidate.variantSlots.some(variant => variant.id === id));
  const variant = card?.variantSlots.find(candidate => candidate.id === id);
  if (!card || !variant) return undefined;
  const match = { card, variant };
  variants.set(id, match);
  return match;
}

/** Rebuild player notices from current ownership using stable public catalog lookups. */
export function collectionNotifications(p: Profile): CollectionNotice[] {
  const notices: CollectionNotice[] = [];
  for (const id of p.ownedCardIds) notices.push({ id: `card:${id}`, section: 'cards', title: `New card · ${cardName(id)}`, href: `/game/collection?card=${encodeURIComponent(id)}` });
  for (const set of Object.values(CHARACTER_STYLE_SETS)) if (p.ownedCardIds.includes(set.cardId)) notices.push({ id: `banner:${set.cardId}`, section: 'style', title: `New banner · ${cardName(set.cardId)}`, href: `/game/style/${set.cardId}?tab=banner` });
  for (const id of p.unlockedCosmeticIds) {
    const [kind, cardId, cosmetic] = id.split(':');
    const name = cardName(cardId);
    const label = id.replaceAll(/[-:]/g, ' ');
    const notice: CollectionNotice = { id: `style:${id}`, section: 'style', title: `New unlock · ${label}`, href: '/game/style' };
    if (kind === 'style' && Object.hasOwn(CHARACTER_STYLE_SETS, cardId) && ['stickers', 'backdrop', 'banner-finish'].includes(cosmetic)) {
      const tab = cosmetic === 'stickers' ? 'stickers' : cosmetic === 'backdrop' ? 'scene' : 'banner';
      const item = cosmetic === 'stickers' ? 'Sticker pack' : cosmetic === 'backdrop' ? 'Card scene' : 'Silver Lining';
      notice.title = `New style · ${name} · ${item}`;
      notice.href = `/game/style/${encodeURIComponent(cardId)}?tab=${tab}${cosmetic === 'banner-finish' ? '&finish=silver' : ''}`;
    } else if ((kind === 'mastery' || kind === 'badge') && cardId) {
      const badges: Record<string, string> = { 'after-hours': 'After-hours champion', 'street-draft': 'Street draft winner', neighborhood: 'Neighborhood champion' };
      notice.section = 'profile';
      notice.title = kind === 'mastery' ? `Mastery earned · ${name}` : `Badge earned · ${badges[cardId] ?? cardId.replaceAll('-', ' ')}`;
      notice.href = '/game/settings#overview';
    } else if ((kind === 'story-key' && cardId) || ['side-alley-tagged-cardback', 'block-party-crowned'].includes(id)) {
      notice.section = 'story';
      notice.title = kind === 'story-key' ? `Chapter unlocked · ${cardId.replaceAll('-', ' ')}` : `Story reward · ${label}`;
      notice.href = '/game/story' + (kind === 'story-key' ? '' : `?node=${id === 'block-party-crowned' ? 'block-crowned' : 'side-alley-challenge'}`);
    }
    notices.push(notice);
  }
  for (const id of p.ownedVariants) {
    const match = findVariant(id);
    if (match) notices.push({ id: `style:${id}`, section: 'style', title: `New finish · ${match.card.name} · ${match.variant.name}`, href: `/game/collection?card=${encodeURIComponent(match.card.catalogId)}&variant=${encodeURIComponent(id)}` });
  }
  return notices;
}

export { dojoReminderNotice } from './dojoReminder';
