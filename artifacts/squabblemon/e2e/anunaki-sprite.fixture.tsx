import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { BossIdleSprite } from '../src/components/fadecade/BossIdleSprite';
import type { DojoSpritePhase } from '../src/components/fadecade/DojoMotionSprite';
import { ReactionArt } from '../src/components/ReactionArt';
import { REACTIONS } from '@workspace/squabblemon-engine/reactions';
import '../src/index.css';
import '../src/styles/boss-raid.css';

function SpriteFixture() {
 const [phase,setPhase]=useState<DojoSpritePhase>('idle');
 const [asset,setAsset]=useState('boss-anu');
 const [paused,setPaused]=useState(false),[mounted,setMounted]=useState(true),[still,setStill]=useState(false);
 return <main style={{background:'#111a25',color:'#f9edce',minHeight:'100vh',padding:20}}>
  <h1>DRAWN ANUNAKI ANIMATION / ACTUAL COMPONENTS</h1>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'15px 0'}}>
   {(['idle','windup','strike','recoil'] as const).map(item=><button key={item} type="button" onClick={()=>setPhase(item)} aria-pressed={phase===item} style={{padding:12}}>{item}</button>)}
   <button type="button" onClick={()=>setAsset(asset==='boss-anu'?'yakub':'boss-anu')} style={{padding:12}}>Switch actor</button>
   <button type="button" onClick={()=>setPaused(!paused)} aria-pressed={paused} style={{padding:12}}>Pause sprite</button>
   <button type="button" onClick={()=>setMounted(!mounted)} style={{padding:12}}>Toggle mount</button>
   <button type="button" onClick={()=>setStill(!still)} aria-pressed={still} style={{padding:12}}>Still reactions</button>
  </div>
  <figure data-testid="sprite-stage" style={{width:320,height:480,maxWidth:'100%',margin:0,background:'radial-gradient(ellipse,#304455,#111a25 70%)'}}>
   {mounted && <BossIdleSprite asset={`anunaki:${asset}`} name={asset} phase={phase} paused={paused}/>}
  </figure>
  <section style={{display:'flex',flexWrap:'wrap',gap:15,marginTop:20}} aria-label="Drawn chat reactions">
   {REACTIONS.filter(item=>item.id.includes('reaction:yakub:')||item.id.includes('reaction:anu:')).map(item=><figure key={item.id} data-reaction-id={item.id} style={{width:256,margin:0,background:'#1e2b3a'}}><div style={{width:256,height:256}}><ReactionArt id={item.id} still={still}/></div><figcaption>{item.name}</figcaption></figure>)}
  </section>
 </main>;
}
const root=createRoot(document.getElementById('root')!);Object.defineProperty(window,'__spriteUnmount',{value:()=>root.unmount()});root.render(<SpriteFixture/>);
