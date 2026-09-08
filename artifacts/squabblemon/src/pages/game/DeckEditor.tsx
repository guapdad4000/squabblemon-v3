import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { PlayerBootstrap, useSavePlayerDeck, useDeletePlayerDeck } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { CardUpgradeCue } from '../../components/CardUpgrades';
import { catalogCardById, starterRecipes, validateSavedDeck } from '../../data';
import { CardView } from '../../components/CardView';

export function DeckEditor({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const params = useParams();
  const [, setLocation] = useLocation();
  const deckId = params.deckId!;

  const saveDeck = useSavePlayerDeck();
  const deleteDeck = useDeletePlayerDeck();
  const queryClient = useQueryClient();

  const isRecipe = starterRecipes.some(r => r.id === deckId);
  const recipe = isRecipe ? starterRecipes.find(r => r.id === deckId) : null;
  const initialSavedDeck = bootstrap.profile.savedDecks.find(d => d.id === deckId);

  const [name, setName] = useState('');
  const [cards, setCards] = useState<string[]>([]);
  const [hero, setHero] = useState<string>('');

  const [filterType, setFilterType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initializedForId = useRef<string | null>(null);

  useEffect(() => {
    if (initializedForId.current !== deckId) {
      initializedForId.current = deckId;
      if (recipe) {
        setName(recipe.name);
        setCards(recipe.catalogCardIds);
        setHero(recipe.hero);
      } else if (initialSavedDeck) {
        setName(initialSavedDeck.name);
        setCards(initialSavedDeck.cardIds);
        setHero(initialSavedDeck.heroCardId);
      }
    }
  }, [deckId, recipe, initialSavedDeck]);

  const legality = useMemo(() => validateSavedDeck(cards, bootstrap.profile.ownedCardIds, hero), [cards, bootstrap.profile.ownedCardIds, hero]);

  const handleSave = async () => {
    if (isRecipe) return;
    setError(null);
    try {
      const res = await saveDeck.mutateAsync({
        deckId,
        data: {
          name,
          cardIds: cards,
          heroCardId: hero,
          recipeId: initialSavedDeck?.recipeId || null
        }
      });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
    } catch (e) {
      console.error(e);
      setError("Failed to save deck.");
    }
  };

  const handleDelete = async () => {
    if (isRecipe) return;
    if (!window.confirm("Delete this deck?")) return;
    setError(null);
    try {
      const res = await deleteDeck.mutateAsync({ deckId });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      setLocation('/game/decks');
    } catch (e) {
      console.error(e);
      setError("Failed to delete deck.");
    }
  };

  const handleClone = async () => {
    if (!recipe) return;
    setError(null);
    try {
      const newId = crypto.randomUUID();
      const res = await saveDeck.mutateAsync({
        deckId: newId,
        data: {
          name: `${recipe.name} (Copy)`,
          cardIds: recipe.catalogCardIds,
          heroCardId: recipe.hero,
          recipeId: recipe.id
        }
      });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      setLocation(`/game/decks/${newId}`);
    } catch (e) {
      console.error(e);
      setError("Failed to clone recipe.");
    }
  };

  const toggleCard = (catalogId: string) => {
    if (isRecipe) return;
    setCards(prev => {
      if (prev.includes(catalogId)) {
        if (hero === catalogId) setHero('');
        return prev.filter(id => id !== catalogId);
      }
      if (prev.length >= 7) return prev;
      const next = [...prev, catalogId];
      if (next.length === 1 && !hero) {
        setHero(catalogId); // Auto-set hero if it's the first card
      }
      return next;
    });
  };

  const allOwnedCards = useMemo(() => {
    return bootstrap.profile.ownedCardIds
      .map(id => catalogCardById[id])
      .filter(Boolean)
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [bootstrap.profile.ownedCardIds]);

  const filteredCards = useMemo(() => {
    let list = allOwnedCards;
    if (filterType) list = list.filter(c => c.type === filterType);
    return list;
  }, [allOwnedCards, filterType]);

  const deckCards = useMemo(() => {
    return cards.map(id => catalogCardById[id]).filter(Boolean);
  }, [cards]);

  if (!recipe && !initialSavedDeck) {
    return (
      <div className="p-6 text-center text-rose-500 mt-20">
        <h2 className="font-display font-black italic text-2xl uppercase">Deck Not Found</h2>
        <button onClick={() => setLocation('/game/decks')} className="mt-4 border border-white/20 px-4 py-2">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-none p-4 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => setLocation('/game/decks')} className="font-mono text-[9px] uppercase tracking-widest text-white/50 hover:text-white">&lt; Back</button>
          <div className="flex items-center gap-2">
            {error && <span className="font-mono text-[9px] text-rose-400 uppercase tracking-widest mr-2">{error}</span>}
            {!isRecipe && (
              <>
                <button onClick={handleDelete} className="font-mono text-[9px] text-rose-400 uppercase tracking-widest px-3 py-1.5 border border-rose-500/30 hover:bg-rose-500/10">Delete</button>
                <button onClick={handleSave} disabled={saveDeck.isPending} className="font-mono text-[9px] text-primary uppercase tracking-widest px-3 py-1.5 border border-primary/30 hover:bg-primary/10">
                  {saveDeck.isPending ? 'Saving' : 'Save'}
                </button>
              </>
            )}
            {isRecipe && (
              <button onClick={handleClone} disabled={saveDeck.isPending} className="font-mono text-[9px] text-white uppercase tracking-widest px-3 py-1.5 border border-white/30 hover:bg-white/10">Clone</button>
            )}
            <button
              onClick={() => setLocation(`/game/decks/${deckId}/test`)}
              disabled={!legality.valid}
              className="bg-primary text-black font-display font-black italic uppercase text-xs px-4 py-1 hover:bg-yellow-400 disabled:opacity-50 disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              Test
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex-1">
            {isRecipe ? (
              <h1 className="font-display font-black italic text-2xl uppercase leading-none">{name}</h1>
            ) : (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="font-display font-black italic text-2xl uppercase leading-none bg-transparent border-b border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-primary w-full max-w-xs"
                placeholder="Deck Name"
              />
            )}
            <div className="flex items-center gap-2 mt-2 font-mono text-[9px] uppercase tracking-widest">
              <span className={cards.length === 7 ? 'text-primary' : 'text-white/50'}>{cards.length}/7 Cards</span>
              <span className="text-white/20">|</span>
              <span className={hero ? 'text-primary' : 'text-white/50'}>{hero ? 'Hero Selected' : 'No Hero'}</span>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex items-end gap-1 h-8">
              {[1, 2, 3, 4, 5].map(cost => {
                const count = deckCards.filter(c => c.cost === cost || (cost === 5 && c.cost >= 5)).length;
                const height = count === 0 ? 2 : Math.max(4, (count / 7) * 32);
                return (
                  <div key={cost} className="flex flex-col items-center gap-1 w-3" title={`${count} cards of cost ${cost}${cost===5?'+':''}`}>
                    <div className="w-full transition-all" style={{ height: `${height}px`, backgroundColor: count > 0 ? '#facc15' : 'rgba(255,255,255,0.2)' }} />
                    <span className="font-mono text-[6px] text-white/50">{cost}{cost===5?'+':''}</span>
                  </div>
                );
              })}
            </div>

            {deckCards.length > 0 && (
              <div className="flex items-end gap-1 h-8 border-l border-white/10 pl-4">
                {Array.from(new Set(deckCards.map(c => c.type))).map(type => {
                  const count = deckCards.filter(c => c.type === type).length;
                  const height = Math.max(4, (count / 7) * 32);
                  return (
                    <div key={type} className="flex flex-col items-center gap-1 w-3" title={`${count} ${type} cards`}>
                      <div className="w-full bg-accent transition-all" style={{ height: `${height}px` }} />
                      <span className="font-mono text-[6px] text-white/50">{type.slice(0, 1)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {legality.issues.length > 0 && (
          <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/20">
            {legality.issues.map((issue, i) => (
              <div key={i} className="font-mono text-[8px] uppercase text-rose-400">• {issue}</div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 md:p-6 pb-32">
        <div className="mb-8">
          <h2 className="font-mono text-xs text-white/50 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Current Roster</h2>
          {deckCards.length === 0 ? (
            <div className="text-center py-8 text-white/30 font-mono text-xs uppercase border border-white/5 border-dashed">Empty Roster</div>
          ) : (
            <div data-testid="deck-roster-grid" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {deckCards.map(c => (
                <div key={c.catalogId} className="relative group">
                  <CardView
                    card={c}
                    variantId={bootstrap.profile.equippedVariants[c.catalogId]}
                    progress={bootstrap.profile.cardProgression[c.catalogId]}
                    isBoard
                     fillContainer
                     presentationOnly
                  />
                  {hero === c.catalogId && (
                    <div className="absolute top-0 right-0 z-30 bg-primary text-black font-display font-black italic text-[9px] px-1.5 py-0.5 uppercase shadow-md card-bevel border border-black/20">HERO</div>
                  )}
                  {!isRecipe && hero !== c.catalogId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setHero(c.catalogId); }}
                      className="absolute top-0 left-0 z-30 bg-black/80 border border-white/20 text-white font-mono text-[8px] px-1.5 py-0.5 uppercase hover:bg-primary hover:text-black transition-colors card-bevel shadow-md"
                    >
                      Make Hero
                    </button>
                  )}
                  {!isRecipe && (
                    <button type="button" aria-label={`Remove ${c.name}, ${c.rarity} rarity, from crew`} onClick={() => toggleCard(c.catalogId)} className="absolute inset-0 z-20 cursor-pointer card-bevel outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <span className="absolute inset-0 bg-rose-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity backdrop-blur-[1px]">
                        <span className="bg-rose-500 text-white font-display font-black uppercase text-xs px-2 py-0.5 italic shadow-xl border border-rose-400">Remove</span>
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!isRecipe && (
          <div>
            <div className="flex justify-between items-end mb-3 border-b border-white/10 pb-1">
              <h2 className="font-mono text-xs text-white/50 uppercase tracking-widest">Collection</h2>
              <div className="flex gap-2">
                {['Normal', 'Fire', 'Water', 'Electric', 'Plant', 'Air', 'Dark'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(filterType === t ? null : t)}
                    className={`font-mono text-[8px] uppercase px-1.5 py-0.5 border ${filterType === t ? 'border-primary text-primary bg-primary/10' : 'border-white/20 text-white/50 hover:border-white/50'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div data-testid="deck-collection-grid" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {filteredCards.map(c => {
                const inDeck = cards.includes(c.catalogId);
                return (
                   <button type="button" key={c.catalogId} data-testid="deck-card-control" aria-label={`${inDeck ? 'Remove' : 'Add'} ${c.name}, ${c.rarity} rarity`} className={`relative group block w-full text-left card-bevel cursor-pointer transition-transform active:scale-95 ${inDeck ? 'opacity-50 grayscale' : 'hover:scale-[1.02]'}`} onClick={() => toggleCard(c.catalogId)}>
                     <CardView
                       card={c}
                       variantId={bootstrap.profile.equippedVariants[c.catalogId]}
                       progress={bootstrap.profile.cardProgression[c.catalogId]}
                       isBoard
                       fillContainer
                       presentationOnly
                     />
                    {inDeck ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                        <span className="bg-primary text-black font-display font-black uppercase text-xs px-2 py-0.5 italic shadow-xl border border-primary/50">In Deck</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none backdrop-blur-[1px]">
                        <span className="bg-primary text-black font-display font-black uppercase text-xs px-2 py-0.5 italic shadow-xl border border-primary/50">Add</span>
                      </div>
                    )}
                   </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
