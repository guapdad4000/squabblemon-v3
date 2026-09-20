import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useLocation, useParams } from 'wouter';
import { PlayerBootstrap, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useDeckPersistence } from '../../lib/useDeckPersistence';
import { useQueryClient } from '@tanstack/react-query';
import { starterRecipes } from '../../data';
import { DeckWorkbench } from '../../components/DeckWorkbench';
import type { DeckDraft } from '../../lib/deckWorkshop';
import { PageDecor } from '../../components/venue/PageDecor';

export function DeckEditor({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { deckId = '' } = useParams();
  const [, setLocation] = useLocation();
  const { save, remove, preview } = useDeckPersistence(bootstrap);
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const recipe = starterRecipes.find(item => item.id === deckId);
  const saved = bootstrap.profile.savedDecks.find(item => item.id === deckId);
  const initial = saved ?? (recipe ? { name: recipe.name, cardIds: recipe.catalogCardIds, heroCardId: recipe.hero, recipeId: recipe.id } : null);
  async function persist(draft: DeckDraft) {
    const id = recipe ? crypto.randomUUID() : deckId;
    const res = await save.mutateAsync({ deckId: id, data: draft });
    queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
    return id;
  }
  if (!initial) return <div className="p-6 text-white"><p>Deck not found.</p><button className="venue-button" onClick={() => setLocation('/game/decks')}>Back to my decks</button></div>;
  return <div className="deck-editor-screen world-decor-host">
    <PageDecor theme="crew" />
    <nav className="deck-editor-nav" aria-label="Deck navigation"><button className="arsenal-link" onClick={() => setLocation('/game/decks')}><ArrowLeft size={15} aria-hidden="true" />Back to my decks</button>
      {recipe && <p>Learning example · save to make it yours</p>}
      {preview && <p>Saved on this device</p>}
      {saved && <button className="arsenal-icon arsenal-danger" title="Delete deck" aria-label="Delete deck" disabled={remove.isPending} onClick={async () => {
        if (!window.confirm('Delete this saved deck? Your cards stay in your collection.')) return;
        try { const res = await remove.mutateAsync({ deckId }); queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res); setLocation('/game/decks'); }
        catch { setError('Could not delete your deck. Please retry.'); }
      }}><Trash2 size={16} aria-hidden="true" /></button>}
      {error && <p role="alert">{error}</p>}
    </nav>
    <DeckWorkbench key={deckId} initial={initial} ownedCardIds={bootstrap.profile.ownedCardIds} equippedVariants={bootstrap.profile.equippedVariants}
      onSave={async draft => { const id = await persist(draft); if (recipe) setLocation(`/game/decks/${id}`); }}
      onTest={async draft => { const id = await persist(draft); setLocation(`/game/decks/${id}/test`); }} />
  </div>;
}
