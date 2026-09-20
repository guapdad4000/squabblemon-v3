import React from 'react';
import { createRoot } from 'react-dom/client';
import { Link, Router, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { MusicControls } from '../src/components/MusicControls';
import GameSoundtrack from '../src/components/GameSoundtrack';
import { RewardReveal } from '../src/components/RewardReveal';
import { rewardReceipts } from '../src/lib/rewardReceipts';
import '../src/index.css';
import '../src/styles/studio.css';
function Fixture() {
  const [location] = useLocation();
  return <main style={{padding:24,color:'white',background:'#16110c',minHeight:'100vh'}}>
    <GameSoundtrack/><RewardReveal/><MusicControls/>
    <p>{location}</p><nav style={{display:'flex',gap:20}}>{['/game','/game/story','/game/play','/game/shop'].map(path=><Link key={path} href={path}>{path}</Link>)}</nav>
    <button onClick={()=>rewardReceipts.show({id:crypto.randomUUID(), title:'Bounty collected', preview:true, items:[{label:'Clout',amount:100,glyph:'cloutStack'},{label:'Tickets',amount:2,glyph:'ticket'},{label:'Style Shards',amount:25,glyph:'shards'}]})}>Preview reward</button>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Router hook={useHashLocation}><Fixture/></Router>);
