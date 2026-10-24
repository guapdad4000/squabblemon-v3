import characterRevisions from '../characterRevisions.json';
import storyPortraitRevisions from './storyPortraitRevisions.json';
import { elementalStandin } from './elementalStandins';

export const getAssetUrl = (path: string) => {
  const requestedPath = path.replace(/^\/+/, '');
  // Versioned coin family keeps saved references compatible and avoids stale CDN art.
  const cleanPath = ({ 'assets/rewards/clout-token.webp': 'assets/rewards/clout-token-v2.webp',
    'assets/rewards/clout-stack.webp': 'assets/rewards/clout-stack-v2.webp' } as Record<string, string>)[requestedPath] ?? requestedPath;
  const url = `${(import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')}/${cleanPath}`;
  // Story dialogue and battle opponents use asset paths, not catalog IDs. Give
  // those portraits the same revision as collection and card views.
  const artworkId = /^assets\/characters\/([^/]+)\.webp$/.exec(cleanPath)?.[1];
  const revision = artworkId && ((storyPortraitRevisions as Record<string, string>)[artworkId]
    ?? (characterRevisions as Record<string, string>)[artworkId]);
  return revision ? `${url}?v=${revision}` : url;
};

// Battle-only tokens and older saved battles use gameplay IDs for these portraits.
const legacyPortraitIds: Record<string, string> = {
  shiesty: 'shiesty-yn',
  grin: 'grin',
  cardguard: 'card-guard',
  sideofhands: 'a-side-of-hands',
};
export const getCardImage = (cardId: string, variantId?: string | null) => {
  const standin = elementalStandin(cardId);
  if (standin) return standin;
  const baseId = Object.hasOwn(legacyPortraitIds, cardId) ? legacyPortraitIds[cardId] : cardId;
  const alternates = ['dorothy', 'scarecrow', 'tin-man', 'lion', 'alice', 'cheshire', 'sherlock', 'watson'];
  const id = baseId === 'cologne-criminal' && variantId === 'cologne-criminal:crazy'
    ? 'cologne-criminal-crazy'
    : alternates.includes(baseId) && variantId === baseId + ':alternate' ? baseId + '-alternate' : baseId;
  return getAssetUrl(`assets/characters/${id}.webp`);
};

// Older match snapshots borrow their summoner's artwork ID. Resolve the token
// identity first without changing saved matches or the summoner's own portrait.
export const getCardArtworkId = (card: { id: string; cardId?: string; buddyBud?: unknown }) =>
  card.buddyBud ? 'buddy-bud' : card.id === 'steward-blue' ? card.id
    : card.cardId === 'cardguard' ? 'card-guard' : card.cardId === 'grin' ? 'grin' : card.id;
