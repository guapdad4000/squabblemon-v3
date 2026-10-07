import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CardFoil } from '../src/components/CardFoil';
import { mountDeckBox } from '../src/components/decks/deckBoxScene';
import { SceneFrame } from '../src/components/venue/SceneFrame';
import { detectGPUQuality } from '../src/lib/gpuQuality';
import { getAssetUrl } from '../src/lib/assets';
import '../src/index.css';
import '../src/styles/venue.css';

function Proof() {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [tier, setTier] = useState('loading');
  const scene = new URLSearchParams(location.search).get('scene');
  useEffect(() => {
    let active = true, dispose: (() => void) | undefined;
    void detectGPUQuality().then(quality => {
      if (!active) return;
      setTier(quality.tier);
      if (quality.tier !== 'static' && host.current) dispose = mountDeckBox(host.current, { name: 'Home Court', image: null }, quality);
    });
    return () => { active = false; dispose?.(); };
  }, []);
  if (scene === 'safehouse' || scene === 'gym') return <main data-gpu-tier={tier} style={{position:'relative',height:'100vh',background:'#314151'}}>
    <SceneFrame kind={scene} frameRef={frame} poster={scene==='safehouse'?getAssetUrl('scenes/safehouse/concept.webp'):undefined}/>
  </main>;
  return <main data-gpu-tier={tier} style={{ background:'#172128',color:'white',minHeight:'100vh',padding:18 }}>
    <h1>GPU quality: {tier}</h1>
    <div data-card-id="proof" style={{position:'relative',width:230,height:320,background:'linear-gradient(140deg,#b79853,#173c4a,#e0bb68)',border:'8px solid #9d8053'}}>
      <CardFoil tier={5} variant="prismatic" />
    </div>
    <div style={{position:'relative',width:260,height:340,background:'#34434a',marginTop:18}}>
      {tier==='static'&&<strong style={{display:'grid',placeItems:'center',height:'100%',color:'#ebd39b'}}>HOME COURT · PRINT FINISH</strong>}
      <div ref={host} style={{width:'100%',height:'100%'}} />
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Proof />);