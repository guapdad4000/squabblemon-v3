import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BattleArtPreload, BattleStartArt, CombatSprite, DefeatCross } from '../src/components/BattleArt';
import { BattleStatus } from '../src/components/BattleEffects';
import { decks, getCardImage } from '../src/data';
import '../src/index.css';
import './combat-art.fixture.css';

function ArtPreview() {
  const [replay, setReplay] = useState(0);
  const [locked, setLocked] = useState(true);
  const [frozen, setFrozen] = useState(true);
  return <main className="combat-art-demo">
    <BattleArtPreload />
    <header><span>SQUABBLEMON · COMBAT ART</span><h1>Make every hit count.</h1><p>Gold, steel, ice and a little attitude.</p><button onClick={() => { setReplay(v => v + 1); setLocked(true); setFrozen(true); }}>Replay all effects</button></header>
    <section className="battle-arena demo-opening" aria-label="Fight start preview">
      <div className="broadcast-overlay"><BattleStartArt key={replay} phase="squabble" player={decks[0]} rival={decks[1]} /></div>
    </section>
    <section className="demo-effects" aria-label="Card effects">
      <article><div className="demo-card" key={`lock-${replay}`}><img className="demo-portrait" src={getCardImage('hooper')} alt="Hooper" />{locked ? <BattleStatus silenced /> : <div className="status-release is-unlocking demo-release"><CombatSprite asset="lock-chain-strand" className="unlock-chain"/><CombatSprite asset="lock-chain-strand" className="unlock-chain"/><CombatSprite asset="lock-padlock" className="unlock-padlock"/></div>}</div><h2>Locked down</h2><p>Chains pull tight. The lock drops.</p><button onClick={() => setLocked(v => !v)}>{locked ? 'Release chains' : 'Lock again'}</button></article>
      <article><div className="demo-card" key={`ice-${replay}`}><img className="demo-portrait" src={getCardImage('snow-bunny')} alt="Snow Bunny" />{frozen ? <BattleStatus frozen /> : <div className="status-release is-unlocking demo-release"><CombatSprite asset="freeze-rim" className="unlock-ice"/><CombatSprite asset="lock-chain-strand" className="unlock-chain"/><CombatSprite asset="lock-chain-strand" className="unlock-chain"/><CombatSprite asset="lock-padlock" className="unlock-padlock"/></div>}</div><h2>Cold shoulder</h2><p>Ice takes hold around the portrait.</p><button onClick={() => setFrozen(v => !v)}>{frozen ? 'Break the ice' : 'Freeze again'}</button></article>
      <article><div className="demo-card demo-defeat" key={`defeat-${replay}`}><div className="attack-destroyed-card"><img className="defeated-portrait" src={getCardImage('cornball')} alt="Cornball"/><DefeatCross /></div></div><h2>Crossed out</h2><p>Two strikes. Then the card falls.</p><button onClick={() => setReplay(v => v + 1)}>Replay defeat</button></article>
    </section>
    <footer>Five original transparent sprites. Shared artwork across battle, status effects and cleanup.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<ArtPreview />);
