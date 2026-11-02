import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KumiteDojoPractice } from '../src/components/fadecade/KumiteDojoPractice';
import { profileBootstrap } from './fighter-id.fixture';
import { decks, engineIdsToCatalogIds } from '@workspace/squabblemon-engine/data';
import '../src/index.css';
const crew = engineIdsToCatalogIds(decks.find(deck => deck.id === 'block')!.cards);
const bootstrap = profileBootstrap({
  id: 'practice-design-fixture', displayName: 'Practice Fighter',
  ownedCardIds: [...crew, 'chonk-lee'],
  savedDecks: new URLSearchParams(location.search).has('empty') ? [] : [{
    id: 'practice-crew', name: 'THE BLOCK', heroCardId: crew[0], cardIds: crew, recipeId: null,
  }], settings: { reducedMotion: true, turnTimerEnabled: false },
});
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <KumiteDojoPractice bootstrap={bootstrap} fighterId="chonk-lee" onExit={() => { document.body.dataset.exited = 'true'; }} />
  </QueryClientProvider>,
);
