import { useLocation } from 'wouter';
import { PlayerBootstrap, useSavePlayerDeck } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { catalogCardById, starterRecipes, validateSavedDeck } from '../../data';
import { useState } from 'react';
import { CardView } from '../../components/CardView';

export function Decks({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [, setLocation] = useLocation();
  const saveDeck = useSavePlayerDeck();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateNew = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const newId = crypto.randomUUID();
      const res = await saveDeck.mutateAsync({
        deckId: newId,
        data: {
          name: 'New Deck',
          cardIds: [],
          heroCardId: '',
          recipeId: null
        }
      });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      setLocation(`/game/decks/${newId}`);
    } catch (e) {
      console.error(e);
      setError("Failed to create deck. Try again.");
      setCreating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 h-full flex flex-col overflow-y-auto hide-scrollbar relative">
      <div className="fixed inset-y-0 left-0 w-8 border-r border-white/5 bg-[repeating-linear-gradient(0deg,transparent,transparent_40px,rgba(255,255,255,0.05)_40px,rgba(255,255,255,0.05)_42px)] z-0 pointer-events-none opacity-50" />
      <div className="relative z-10">
        <div className="mb-6 flex justify-between items-end pl-6">
          <div>
            <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1 drop-shadow-md">Decks</h1>
            <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest bg-black/50 px-2 py-0.5 inline-block">
              {bootstrap.profile.savedDecks.length} / {bootstrap.profile.deckSlots} Slots
            </p>
          </div>
          <div className="flex flex-col items-end bg-black/50 p-2 border border-white/5">
            {error && <div className="font-mono text-[9px] uppercase tracking-widest text-rose-500 mb-1">{error}</div>}
            <button
              onClick={handleCreateNew}
              disabled={creating || bootstrap.profile.savedDecks.length >= bootstrap.profile.deckSlots}
              className="bg-primary text-black font-display font-black italic uppercase text-sm px-4 py-2 hover:bg-yellow-400 disabled:opacity-50 disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              {creating ? 'Building...' : 'New Deck'}
            </button>
          </div>
        </div>

        <div className="mb-8 relative z-10 pl-6">
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-widest mb-4 bg-black/50 inline-block px-2 py-0.5 border-l-2 border-primary">Your Crews</h2>
        {bootstrap.profile.savedDecks.length === 0 ? (
          <div className="border-2 border-dashed border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm font-mono uppercase tracking-widest">
            No saved decks. Create one to hit the streets.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bootstrap.profile.savedDecks.map(deck => {
              const legality = validateSavedDeck(deck.cardIds, bootstrap.profile.ownedCardIds, deck.heroCardId);
              const heroCard = catalogCardById[deck.heroCardId];
              return (
                <button
                  key={deck.id}
                  data-testid="deck-archive-control"
                  onClick={() => setLocation(`/game/decks/${deck.id}`)}
                  aria-label={`${deck.name}${heroCard ? `. Hero card is ${heroCard.rarity} rarity` : ''}`}
                  className="relative group text-left border-2 border-white/10 bg-zinc-950 overflow-hidden flex flex-row items-center p-3 hover:border-primary/50 transition-colors shadow-lg card-bevel"
                >
                  {heroCard ? (
                    <div className="w-16 flex-none mr-4">
                      <CardView card={heroCard} variantId={bootstrap.profile.equippedVariants[deck.heroCardId]} isBoard fillContainer presentationOnly disableLayout />
                    </div>
                  ) : (
                    <div className="w-16 flex-none mr-4 aspect-[63/88] bg-white/5 border border-white/10 card-bevel flex items-center justify-center">
                       <span className="font-mono text-[8px] text-white/30 uppercase">No Hero</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-black italic text-xl uppercase leading-none text-white group-hover:text-primary transition-colors truncate">{deck.name}</h3>
                    <div className="font-mono text-[9px] uppercase tracking-widest flex items-center gap-2 mt-2">
                      <span className={legality.valid ? "text-green-400" : "text-rose-500"}>
                        {legality.valid ? 'Valid' : 'Invalid'}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="text-white/60">{deck.cardIds.length}/7 Cards</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative z-10 pl-6">
        <h2 className="font-mono text-xs text-white/50 uppercase tracking-widest mb-4 bg-black/50 inline-block px-2 py-0.5 border-l-2 border-primary">Starter Recipes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {starterRecipes.map(recipe => {
            const legality = validateSavedDeck(recipe.catalogCardIds, bootstrap.profile.ownedCardIds, recipe.hero);
            const heroCard = catalogCardById[recipe.hero];
            return (
              <button
                key={recipe.id}
                data-testid="deck-archive-control"
                onClick={() => setLocation(`/game/decks/${recipe.id}`)}
                aria-label={`${recipe.name}. Hero card is ${heroCard.rarity} rarity`}
                className="relative group text-left border-2 border-white/10 bg-zinc-950 overflow-hidden flex flex-row items-center p-3 hover:border-white/30 transition-colors shadow-lg card-bevel"
              >
                <div className="w-16 flex-none mr-4">
                  <CardView card={heroCard} variantId={bootstrap.profile.equippedVariants[recipe.hero]} isBoard fillContainer presentationOnly disableLayout />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-mono text-[8px] text-white/40 uppercase truncate mr-2">{recipe.archetype}</div>
                    {!legality.valid && (
                      <div className="font-mono text-[8px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1 py-0.5 uppercase whitespace-nowrap">Missing Cards</div>
                    )}
                  </div>
                  <h3 className="font-display font-black italic text-xl uppercase leading-none text-white truncate group-hover:text-primary transition-colors">{recipe.name}</h3>
                </div>
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
