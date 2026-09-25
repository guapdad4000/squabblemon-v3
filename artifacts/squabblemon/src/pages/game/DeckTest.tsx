import { useGameBack } from '../../components/venue/GameBackButton';
import { useParams } from 'wouter';
import { PlayerBootstrap } from '@workspace/api-client-react';
import { PlayLoop } from '../../components/PlayLoop';
import { e2eAuthEnabled } from '../../lib/auth';
import {
  starterRecipes,
  validateSavedDeck,
} from '../../data';
import { useMemo } from 'react';

export function DeckTest({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const goBack = useGameBack();
  const params = useParams();
  const deckId = params.deckId;

  const recipe = starterRecipes.find(r => r.id === deckId);
  const deckData = useMemo(() => {
    if (!deckId) return null;
    if (recipe) {
      return {
        id: recipe.id,
        name: recipe.name,
        archetype: recipe.archetype,
        accent: recipe.accent,
        plan: recipe.plan,
        cards: recipe.catalogCardIds,
        hero: recipe.hero,
      };
    }

    const saved = bootstrap.profile.savedDecks.find(d => d.id === deckId);
    if (saved) {
      return {
        id: saved.id,
        name: saved.name,
        archetype: 'Custom',
        accent: 'TEST',
        plan: 'Local Test',
        cards: saved.cardIds,
        hero: saved.heroCardId || saved.cardIds[0],
      };
    }

    return null;
  }, [deckId, bootstrap.profile.savedDecks, recipe]);

  const legality = deckData
    ? validateSavedDeck(
        deckData.cards,
        bootstrap.profile.ownedCardIds,
        deckData.hero,
      )
    : null;

  if (!deckData || !legality?.valid) {
    return (
      <div className="min-h-[100dvh] bg-black text-white p-6 flex flex-col items-center justify-center text-center">
        <h2 className="font-display font-black text-xl italic uppercase mb-2 text-rose-500">
          {deckData ? 'Deck Is Not Ready' : 'Deck Not Found'}
        </h2>
        {legality && (
          <ul className="mb-5 max-w-md text-left font-mono text-[10px] uppercase tracking-wider text-white/60">
            {legality.issues.map((issue) => (
              <li key={issue} className="mb-2">— {issue}</li>
            ))}
          </ul>
        )}

      </div>
    );
  }

  return (
    <PlayLoop
      mode={e2eAuthEnabled && bootstrap.profile.id === 'e2e-player' ? 'guest' : 'practice'}
      initialDeckId={deckId}
      onExit={goBack}
      hideLobby={true}
      turnTimerEnabled={false}
      customPlayerDeck={deckData || undefined}
      equippedVariants={bootstrap.profile.equippedVariants}
    />
  );
}
