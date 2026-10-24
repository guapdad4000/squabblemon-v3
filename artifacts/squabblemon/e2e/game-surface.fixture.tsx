import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { installGameSurfacePolicy } from '../src/lib/gameSurfacePolicy';
import '../src/index.css';
import '../src/styles/venue.css';
import '../src/styles/game-surface.css';

function Fixture() {
  const [active, setActive] = useState(true), [inspected, setInspected] = useState(false);
  useEffect(() => active ? installGameSurfacePolicy() : undefined, [active]);
  return <><div className="game-shell" style={{height:'100dvh',width:'100%'}}><div className="game-shell__content" style={{margin:0}}><div className="game-route-stage" style={{padding:16}}>
    <h1 id="game-title" style={{fontSize:24}}>Fade Market · game surface</h1>
    <p id="game-copy">This game label should never highlight on drag.</p>
    <img id="game-image" src="/assets/market/thank-you-fade-again-bag.webp" alt="Market bag" style={{width:90}} />
    <button id="card-target" onContextMenu={event => {event.preventDefault();setInspected(true);}}>Card inspection target</button>
    <p id="inspection-state">{inspected ? 'Details opened' : 'Closed'}</p>
    <label>Search<input id="edit-field" defaultValue="Buddy" style={{display:'block',background:'#eee',color:'#111',minHeight:44}} /></label>
    <textarea id="edit-notes" defaultValue="Keep this editable" />
    <select id="native-select"><option>Common</option><option>Rare</option></select>
    <div id="editable" contentEditable suppressContentEditableWarning>Editable name</div>
    <strong className="sq-code" id="copy-code">ABC123</strong>
    <button draggable="true" id="puzzle-handle"><svg width="22" height="22"><path d="M2 2L20 20" stroke="currentColor"/></svg>Reorder handle</button>
    <div id="card-rail" style={{display:'flex',gap:12,overflowX:'auto',maxWidth:'100%',padding:'12px 0',scrollSnapType:'x mandatory'}}>
      {[1,2,3,4,5,6].map(value=><button key={value} style={{flex:'0 0 180px',height:100,scrollSnapAlign:'start',background:'#284c3a'}}>Card {value}</button>)}
    </div>
    <div id="vertical-content" style={{height:1100,background:'linear-gradient(#12241a,#284c3a)'}}>Vertical content</div>
    <button id="stop-policy" onClick={()=>setActive(false)}>Leave game</button>
  </div></div></div>
  {createPortal(<div role="dialog" id="portal-dialog" style={{position:'fixed',right:12,top:12,background:'#123',padding:8}}><span id="portal-label">Portalled game label</span><img id="portal-image" src="/assets/market/thank-you-fade-again-bag.webp" style={{width:35}} alt="Reward"/></div>,document.body)}
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture/></React.StrictMode>);
