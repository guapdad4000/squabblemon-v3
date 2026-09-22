import { PageHeading } from '../../components/venue/PageHeading';
import { ArsenalScreen, FocusViewButton } from '../../components/venue/ArsenalScreen';
import { ChevronDown, Layers, Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { PlayerBootstrap, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useDeckPersistence } from '../../lib/useDeckPersistence';
import { useQueryClient } from '@tanstack/react-query';
import { starterRecipes, validateSavedDeck } from '../../data';
import { useState } from 'react';
import { PageDecor } from '../../components/venue/PageDecor';
import { DeckCarousel } from '../../components/DeckCarousel';

export function Decks({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [, setLocation] = useLocation();
  const { save: saveDeck } = useDeckPersistence(bootstrap);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState(bootstrap.profile.savedDecks[0]?.id ?? '');
  const [selectedExampleId, setSelectedExampleId] = useState(starterRecipes[0]?.id ?? '');
  const atCapacity = bootstrap.profile.savedDecks.length >= bootstrap.profile.deckSlots;

  const handleCreateNew = async () => {
    if (creating || atCapacity) return;
    setCreating(true); setError(null);
    try {
      const newId = crypto.randomUUID();
      const res = await saveDeck.mutateAsync({ deckId: newId, data: { name: 'New Deck', cardIds: [], heroCardId: '', recipeId: null } });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      setLocation(`/game/decks/${newId}`);
    } catch (e) {
      console.error(e); setError('Failed to create deck. Try again.'); setCreating(false);
    }
  };

  return <ArsenalScreen className="arsenal-archive world-decor-host" label="Your gangs">
    <PageDecor theme="crew" />
    <div className="arsenal-heading-row">
      <PageHeading art="deck-stack" eyebrow="THE LINEUP / GANG BUILDER" title="Your gang.">{bootstrap.profile.savedDecks.length} / {bootstrap.profile.deckSlots} saved gangs. Bring the right energy.</PageHeading>
      <div className="arsenal-heading-actions">
        <FocusViewButton />
        <button
          type="button"
          onClick={handleCreateNew}
          disabled={creating || atCapacity}
          className="arsenal-action arsenal-action--lead"
        >
          <Plus size={17} aria-hidden="true" />
          {creating ? 'Building…' : 'New Deck'}
        </button>
      </div>
    </div>
    {error && <p role="alert" className="arsenal-error">{error}</p>}
    {atCapacity && <p className="arsenal-error">All gang slots are in use. Edit a gang, or delete one to free a slot.</p>}
    <div className="arsenal-archive__section">
      <h2 className="arsenal-section-label">
        <span>Your gangs</span>
        <span className="arsenal-section-label__count">{bootstrap.profile.savedDecks.length} / {bootstrap.profile.deckSlots}</span>
      </h2>
      {bootstrap.profile.savedDecks.length === 0 ? <div className="arsenal-empty"><Layers size={32} aria-hidden="true" /><h2>Every gang starts with you.</h2><p>Pick ten cards, find your chemistry, and make your mark on the block.</p><button type="button" className="arsenal-link" disabled={creating || atCapacity} onClick={handleCreateNew}><Plus size={16} />Build your first gang</button></div>
        : <DeckCarousel
          decks={bootstrap.profile.savedDecks.map(deck => ({
            ...deck,
            valid: validateSavedDeck(deck.cardIds, bootstrap.profile.ownedCardIds, deck.heroCardId).valid,
          }))}
          selectedId={selectedDeckId}
          onSelect={setSelectedDeckId}
          onOpen={id => setLocation(`/game/decks/${id}`)}
          label="Your saved decks"
        />}
    </div>
    <details className="arsenal-archive__examples"><summary><ChevronDown size={14} aria-hidden="true" />Learning examples · find your starting point</summary>
      <p>Mix any owned cards. Saving an example creates your own gang.</p>
      <DeckCarousel
        decks={starterRecipes.map(recipe => ({
          id: recipe.id,
          name: recipe.name,
          heroCardId: recipe.hero,
          cardIds: recipe.catalogCardIds,
          subtitle: recipe.archetype,
          valid: validateSavedDeck(recipe.catalogCardIds, bootstrap.profile.ownedCardIds, recipe.hero).valid,
        }))}
        selectedId={selectedExampleId}
        onSelect={setSelectedExampleId}
        onOpen={id => setLocation(`/game/decks/${id}`)}
        label="Learning examples"
        openLabel="Build from example"
      />
    </details>
  </ArsenalScreen>;
}
