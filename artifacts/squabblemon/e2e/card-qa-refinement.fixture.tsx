import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { createDistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import { createMatch, createCardInstance, playTurnCard } from '../src/gameEngine';
import { cards, decks, catalogCardByEngineId } from '../src/data';
import { CardInspector } from '../src/components/CardInspector';
import { TrainingMachine } from '../src/components/fadecade/TrainingMachine';
import { PlayLoop } from '../src/components/PlayLoop';
import { RewardCard } from '../src/pages/game/Shop';
import type { BattleConfig } from '../src/pages/game/ChallengesHub';
import '../src/index.css';
import '../src/styles/fadecade-chrome.css';
const playerDeck = decks.find(deck => deck.id === 'block')!;
const rivalDeck = decks.find(deck => deck.id === 'combo')!;
const contract = { playerDeckId: playerDeck.id, playerCards: playerDeck.cards, rivalDeckId: rivalDeck.id,
  abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(playerDeck.cards, rivalDeck.cards), districtSnapshot: createDistrictSnapshot('card-qa') };
(window as Window & {cardQA?: unknown}).cardQA = {contract};
function Transformed({id}: {id:string}) {
  const [open, setOpen] = useState(true);
  const [match] = useState(() => {
    const state = createMatch('block','combo'); state.playerMotion = 30;
    state.playerHand = [createCardInstance(id, 'player','card-qa',0)];
    return playTurnCard(state,'player',state.playerHand[0].instanceId,0,true);
  });
  const live = match.boards.flat().find(card => card.cardId === id)!;
  // The caller may hold a pre-effect snapshot: the real inspector must refresh it from the match.
  const stale = {...live, name: cards[id].name, ability: cards[id].ability, effect: cards[id].effect};
  return open ? <CardInspector card={stale} match={match} onClose={() => setOpen(false)}/> : <p>Closed</p>;
}
function Fixture() {
  const [battle, setBattle] = useState<BattleConfig|null>(null);
  const scene = new URLSearchParams(location.search).get('scene') ?? 'training';
  if(scene === 'buddy' || scene === 'luigion') return <Transformed id={scene}/>;
  if(scene === 'gacha') {
    const card = catalogCardByEngineId.buddy;
    return <main style={{maxWidth:960,margin:'auto',padding:16,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:24}}>
      {(['card','variant','styleShards'] as const).map(kind=><section key={kind} data-testid={`gacha-${kind}`}><RewardCard large reward={{kind,cardId:card.catalogId,amount:1,rarity:card.rarity,name:card.name,variantId:null,isNew:kind==='card'}}/></section>)}
    </main>;
  }
  return battle ? <div style={{height:'100dvh'}}><PlayLoop mode={battle.mode} hideLobby activity={battle.activity} trainingCircuit
    customPlayerDeck={battle.customPlayerDeck} initialDeckId={battle.initialDeckId} initialRivalId="combo"
    turnTimerEnabled={false} onExit={()=>setBattle(null)}/></div>
    : <TrainingMachine playerId="card-qa" legalCrews={[playerDeck]} initiallyOpen onBattle={setBattle}/>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);
import.meta.hot?.dispose(()=>root.unmount());
