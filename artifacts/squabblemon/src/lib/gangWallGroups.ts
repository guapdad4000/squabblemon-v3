import { cardCatalog, canonicalElement, decks, type CatalogCard, type Deck } from '../data';

export type WallMode = 'elements' | 'groups' | 'bonds' | 'combos' | 'road';
export type WallGroup = Readonly<{ name: string; cards: readonly CatalogCard[]; note?: string }>;
type CatalogMode = Exclude<WallMode, 'road'>;

/** Each entry contains only authored catalog data, never player ownership or rewards. */
export function createGangWallGroupReader(catalog: readonly CatalogCard[], crewCatalog: readonly Deck[]) {
  const groups = new Map<CatalogMode, readonly WallGroup[]>();
  return (mode: WallMode): readonly WallGroup[] => {
    // The reward road historically uses the combo group for its art/paint fallback.
    const key = mode === 'elements' || mode === 'groups' || mode === 'bonds' ? mode : 'combos';
    const existing = groups.get(key);
    if (existing) return existing;
    const computed = key === 'elements'
      ? [...new Set(catalog.map(card => canonicalElement(card.type)))].map(name => ({
        name, cards: catalog.filter(card => canonicalElement(card.type) === name),
      }))
      : key === 'groups'
        ? [...new Set(catalog.map(card => card.faction))].map(name => ({
          name, cards: catalog.filter(card => card.faction === name),
        }))
        : key === 'bonds'
          ? catalog.filter(card => card.elementalBond).map(card => ({
            name: card.name,
            cards: [card, ...catalog.filter(partner => partner.catalogId !== card.catalogId
              && canonicalElement(partner.type) === card.elementalBond)],
            note: card.effect,
          }))
          : crewCatalog.filter(crew => crew.archetype.includes('Combo') || crew.id === 'voltage' || crew.id === 'compound')
            .map(crew => ({
              name: crew.name, cards: catalog.filter(card => crew.cards.includes(card.engineId)), note: crew.plan,
            }));
    const result = Object.freeze(computed.map(group => Object.freeze({
      ...group, cards: Object.freeze(group.cards),
    })));
    groups.set(key, result);
    return result;
  };
}

// At most four lazy entries for the immutable, build-time public catalog.
export const getGangWallGroups = createGangWallGroupReader(cardCatalog, decks);
