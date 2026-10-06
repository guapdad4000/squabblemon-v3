import { cards, catalogCardById, type Deck } from '../data';
import type { Match } from '../gameEngine';
import { resolveBattleArtwork, resolveBattleVenue } from '../battleVenues';
import { getAssetUrl, getCardImage } from './assets';
import { getLocationArtwork } from '../locationArtwork';
import { warmImages } from './imageWarmup';

const portrait = (id: string, variants?: Record<string, string>) => {
  const artworkId = cards[id]?.id ?? catalogCardById[id]?.artworkId ?? id;
  return getCardImage(artworkId, variants?.[artworkId]);
};

export function warmDeckArtwork(player: Deck, rival: Deck, variants?: Record<string, string>) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
  void warmImages([
    portrait(player.hero), portrait(rival.hero),
    getAssetUrl(resolveBattleVenue({ cpuDeck: rival.id }).assetId),
    ...player.cards.map(id => portrait(id, variants)),
    ...rival.cards.map(id => portrait(id)),
    getAssetUrl('assets/ui/fight-emblem.webp'),
    getAssetUrl('assets/combat/fight-start-burst.webp'),
  ]);
}

/** The issued match supplies its real fighters and locations, including custom decks. */
export function warmMatchArtwork(match: Match, variants?: Record<string, string>) {
  const locations = match.districtSnapshot?.locations.map(location => location.id) ?? ['legacy-0', 'legacy-1', 'legacy-2'];
  const artwork = resolveBattleArtwork(match);
  const portraitScreen = typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches;
  void warmImages([
    ...match.playerHand.map(card => getCardImage(card.id, variants?.[card.id])),
    getAssetUrl(portraitScreen ? artwork.portraitAssetId : artwork.landscapeAssetId),
    ...locations.map(id => getLocationArtwork(id).node),
    ...match.cpuHand.map(card => getCardImage(card.id)),
    ...match.playerCardIds.map(id => portrait(id, variants)),
    ...match.cpuCardIds.map(id => portrait(id)),
  ]);
}
