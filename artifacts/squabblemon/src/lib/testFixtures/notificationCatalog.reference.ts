// Frozen catalog-notice loops from main 56f48cd. Keep independent of optimized helpers.
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog } from '../../data';
import { CHARACTER_STYLE_SETS } from '@workspace/squabblemon-engine/cosmetics';
import type { CollectionNotice } from '../notificationCatalog';
type Profile = Pick<PlayerBootstrap['profile'], 'ownedCardIds' | 'unlockedCosmeticIds' | 'ownedVariants'>;
export function referenceCollectionNotifications(p: Profile): CollectionNotice[] {
  const notices: CollectionNotice[] = [];
  for (const id of p.ownedCardIds) notices.push({ id: `card:${id}`, section: 'cards', title: `New card · ${cardCatalog.find(c => c.catalogId === id)?.name ?? id}`, href: `/game/collection?card=${encodeURIComponent(id)}` });
  for (const set of Object.values(CHARACTER_STYLE_SETS)) if (p.ownedCardIds.includes(set.cardId)) notices.push({ id: `banner:${set.cardId}`, section: 'style', title: `New banner · ${cardCatalog.find(c => c.catalogId === set.cardId)?.name ?? set.cardId}`, href: `/game/style/${set.cardId}?tab=banner` });
  for (const id of p.unlockedCosmeticIds) {
    const [kind, cardId, cosmetic] = id.split(':');
    const name = cardCatalog.find(card => card.catalogId === cardId)?.name ?? cardId;
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
    const card = cardCatalog.find(c => c.variantSlots.some(v => v.id === id));
    if (card) notices.push({ id: `style:${id}`, section: 'style', title: `New finish · ${card.name} · ${card.variantSlots.find(v => v.id === id)?.name}`, href: `/game/collection?card=${encodeURIComponent(card.catalogId)}&variant=${encodeURIComponent(id)}` });
  }
  return notices;
}
