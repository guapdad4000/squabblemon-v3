import { PageHeading } from '../../components/venue/PageHeading';
import { ArsenalScreen } from '../../components/venue/ArsenalScreen';
import { ChevronDown, Layers, Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { PlayerBootstrap, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useDeckPersistence } from '../../lib/useDeckPersistence';
import { useQueryClient } from '@tanstack/react-query';
import { starterRecipes, validateSavedDeck } from '../../data';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PageDecor } from '../../components/venue/PageDecor';
import { DeckCarousel } from '../../components/DeckCarousel';
import { usePersistentDeckSelection } from '../../lib/deckSelection';
import { loadFeedbackPreferences } from '../../battleFeedback';
import { playVoiceLine, stopSoundEffect } from '../../lib/sfx';
import { GangBackdrop } from '../../components/GangBackdrop';
import '../../styles/gang-backdrop.css';
import { deckEditorPath, readDeckListContext, saveDeckListContext } from '../../lib/deckJourney';

export function Decks({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const welcomeVoice = useRef<HTMLAudioElement | null>(null);
  const [, setLocation] = useLocation();
  const { save: saveDeck } = useDeckPersistence(bootstrap);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoredContext = useRef(readDeckListContext(bootstrap.profile.id, typeof window === 'undefined' ? null : window.sessionStorage));
  const selectedDeckRef = useRef('');
  const savedDeckIds = bootstrap.profile.savedDecks.map(deck => deck.id);
  const starterDeckIds = starterRecipes.map(recipe => recipe.id);
  const [selectedDeckId, setSelectedDeckId] = usePersistentDeckSelection(
    bootstrap.profile.id,
    [...savedDeckIds, ...starterDeckIds.filter(id => !savedDeckIds.includes(id))],
    restoredContext.current?.selectedDeckId,
  );
  const atCapacity = bootstrap.profile.savedDecks.length >= bootstrap.profile.deckSlots;
  selectedDeckRef.current = selectedDeckId;
  useEffect(() => {
    welcomeVoice.current = playVoiceLine('decks-welcome', loadFeedbackPreferences().audioEnabled);
    return () => stopSoundEffect(welcomeVoice.current);
  }, []);

  useLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>('.game-route-stage');
    if (!stage) return;
    stage.scrollTop = restoredContext.current?.scrollTop ?? 0;
    const frame = requestAnimationFrame(() => {
      stage.querySelector<HTMLElement>('[data-testid="deck-carousel"] [aria-hidden="false"] [data-testid="deck-cover"]')?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      saveDeckListContext(bootstrap.profile.id, {
        selectedDeckId: selectedDeckRef.current,
        scrollTop: stage.scrollTop,
      }, window.sessionStorage);
    };
  }, [bootstrap.profile.id]);

  const handleCreateNew = async () => {
    if (creating || atCapacity) return;
    setCreating(true); setError(null);
    try {
      const newId = crypto.randomUUID();
      const res = await saveDeck.mutateAsync({ deckId: newId, data: { name: 'New Deck', cardIds: [], heroCardId: '', recipeId: null } });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      setLocation(deckEditorPath(newId));
    } catch (e) {
      console.error(e); setError('Failed to create deck. Try again.'); setCreating(false);
    }
  };

  return <ArsenalScreen className="decks-spectacle world-decor-host" label="Your gangs">
    <GangBackdrop />
    <PageDecor theme="crew" />
    <div className="decks-spectacle__hero">
      <header className="decks-spectacle__header">
        <div className="decks-spectacle__title">
          <Layers size={28} aria-hidden="true" />
          <h1>The Lineup</h1>
        </div>
        <div className="decks-spectacle__stats">
          <span>{bootstrap.profile.savedDecks.length} / {bootstrap.profile.deckSlots} Gangs</span>
          <button
            type="button"
            onClick={handleCreateNew}
            disabled={creating || atCapacity}
            className="venue-button venue-button--gold"
          >
            <Plus size={17} aria-hidden="true" />
            {creating ? 'Building…' : 'New Deck'}
          </button>
        </div>
      </header>

      {error && <p role="alert" className="venue-error">{error}</p>}
      {atCapacity && <p className="venue-error">All gang slots are in use. Edit a gang, or delete one to free a slot.</p>}

      <div className="decks-spectacle__carousel-wrap">
        {bootstrap.profile.savedDecks.length === 0 ? (
          <div className="venue-empty">
            <Layers size={48} aria-hidden="true" />
            <h3>Every gang starts with you.</h3>
            <p>Pick ten cards, find your chemistry, and make your mark on the block.</p>
            <button type="button" className="venue-button venue-button--gold" disabled={creating || atCapacity} onClick={handleCreateNew}>
              Build your first gang
            </button>
          </div>
        ) : (
          <DeckCarousel
            decks={bootstrap.profile.savedDecks.map(deck => ({
              ...deck,
              valid: validateSavedDeck(deck.cardIds, bootstrap.profile.ownedCardIds, deck.heroCardId).valid,
            }))}
            selectedId={savedDeckIds.includes(selectedDeckId) ? selectedDeckId : savedDeckIds[0]}
            onSelect={setSelectedDeckId}
            onOpen={id => setLocation(deckEditorPath(id))}
            label="Your saved decks"
          />
        )}
      </div>
    </div>

    <details className="decks-spectacle__examples">
      <summary><ChevronDown size={14} aria-hidden="true" />Learning examples · find your starting point</summary>
      <div className="decks-spectacle__examples-content">
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
          selectedId={starterDeckIds.includes(selectedDeckId) ? selectedDeckId : starterDeckIds[0]}
          onSelect={setSelectedDeckId}
          onOpen={id => setLocation(deckEditorPath(id))}
          label="Learning examples"
          openLabel="Build from example"
        />
      </div>
    </details>
  </ArsenalScreen>;
}
