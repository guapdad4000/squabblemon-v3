import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StoryCrewSelect } from '../src/components/StoryCrewSelect';
import { CompactDeckPicker } from '../src/components/CompactDeckPicker';
import { starterRecipes } from '../src/data';
import '../src/index.css';
import '../src/styles/studio.css';
const choices = starterRecipes.map(deck => ({ id:deck.id,name:deck.name,heroCardId:deck.hero,cardIds:deck.catalogCardIds }));
function Preview() {
 const [selected,onSelect]=useState(choices[0]?.id ?? '');
 return new URLSearchParams(location.search).get('mode') === 'compact' ? <main style={{background:'#101711',padding:20,minHeight:'100vh',color:'white'}}><h1>Bring your crew</h1><CompactDeckPicker decks={choices} selectedId={selected} onSelect={onSelect} /></main> : <StoryCrewSelect decks={choices} selectedId={selected} onSelect={onSelect} onBack={()=>{}} action={<button className="studio-action studio-action--gold">Enter the fight →</button>} />;
}
createRoot(document.getElementById('root')!).render(<Preview />);
