import { PageHeading } from '../../components/venue/PageHeading';
import { ArsenalScreen, FocusViewButton } from '../../components/venue/ArsenalScreen';
import { ArrowUpRight, Check, ChevronDown, Layers, Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { PlayerBootstrap, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useDeckPersistence } from '../../lib/useDeckPersistence';
import { useQueryClient } from '@tanstack/react-query';
import { catalogCardById, getCardImage, starterRecipes, validateSavedDeck, CARD_RARITY_DEFINITIONS } from '../../data';
import { useState } from 'react';
import { PageDecor } from '../../components/venue/PageDecor';

function CrewPortrait({ name, heroId, count, valid, index, subtitle, onClick }: {
  name: string; heroId: string; count: number; valid: boolean; index: number; subtitle?: string; onClick: () => void;
}) {
  const hero = catalogCardById[heroId];
  return <button type="button" data-testid="deck-archive-control" className="crew-portrait" onClick={onClick}
    aria-label={`${name}${hero ? `. Hero card is ${CARD_RARITY_DEFINITIONS[hero.rarity].label} rarity` : ''}`}>
    <span className="crew-portrait__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    {hero && <img className="crew-portrait__art" src={getCardImage(heroId)} alt="" loading="lazy" />}
    <div className="crew-portrait__copy">
      {subtitle && <small>{subtitle}</small>}
      <h3>{name}</h3>
      <div className="crew-portrait__meta"><span>{count} / 10 cards</span><span className={`crew-portrait__status ${valid ? '' : 'is-incomplete'}`}>{valid && <Check size={12} aria-hidden="true" />}{valid ? 'Ready' : 'Needs cards'}</span></div>
    </div>
    <ArrowUpRight className="crew-portrait__arrow" size={18} aria-hidden="true" />
  </button>;
}

export function Decks({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [, setLocation] = useLocation();
  const { save: saveDeck } = useDeckPersistence(bootstrap);
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        : <div className="arsenal-archive__grid">{bootstrap.profile.savedDecks.map((deck, index) =>
          <CrewPortrait key={deck.id} name={deck.name} heroId={deck.heroCardId} count={deck.cardIds.length} index={index}
            valid={validateSavedDeck(deck.cardIds, bootstrap.profile.ownedCardIds, deck.heroCardId).valid}
            onClick={() => setLocation(`/game/decks/${deck.id}`)} />
        )}</div>}
    </div>
    <details className="arsenal-archive__examples"><summary><ChevronDown size={14} aria-hidden="true" />Learning examples · find your starting point</summary>
      <p>Mix any owned cards. Saving an example creates your own gang.</p>
      <div className="arsenal-archive__grid">{starterRecipes.map((recipe, index) =>
        <CrewPortrait key={recipe.id} name={recipe.name} heroId={recipe.hero} count={recipe.catalogCardIds.length} index={index} subtitle={recipe.archetype}
          valid={validateSavedDeck(recipe.catalogCardIds, bootstrap.profile.ownedCardIds, recipe.hero).valid}
          onClick={() => setLocation(`/game/decks/${recipe.id}`)} />
      )}</div>
    </details>
  </ArsenalScreen>;
}
