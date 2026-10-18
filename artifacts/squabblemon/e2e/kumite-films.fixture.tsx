import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KumiteFilmReplay } from '../src/components/kumite/KumiteFilmPlayer';
const params = new URLSearchParams(location.search);
const owned = params.has('locked') ? [] : ['undercova-brotha', 'leroy'];
function Fixture() {
  const [inspect, setInspect] = useState(false);
  return <main style={{ color: '#eee', minHeight: '160vh', padding: 24 }}>
    <h1>Local film fixture</h1><p>Browser verification data</p>
    <KumiteFilmReplay cardId="undercova-brotha" ownedCardIds={owned} />
    <KumiteFilmReplay cardId="leroy" ownedCardIds={owned} />
    <button onClick={() => setInspect(true)}>Open parent panel</button>
    {inspect ? <div role="dialog" aria-label="Parent fixture panel" onClick={() => setInspect(false)} onKeyDown={e => { if(e.key==='Escape')setInspect(false); }}>
      <div onClick={e => e.stopPropagation()}><KumiteFilmReplay cardId="undercova-brotha" ownedCardIds={owned}/><button onClick={() => setInspect(false)}>Close parent</button></div>
    </div> : null}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
