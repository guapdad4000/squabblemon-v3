import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { GamePopupFrame, GamePopupTitle, GamePopupLabel, GamePopupCopy, GamePopupAmount, GamePopupClose, GamePopupSecondary, RewardFilePaper, RewardFileStamp, RewardFileLoot, RewardFileAction, type GamePopupFamily } from '../src/components/ui/game-popup';
import { GameGlyph } from '../src/components/venue/GameGlyph';
import { getAssetUrl } from '../src/lib/assets';
import '../src/index.css';
import '../src/styles/blzee-type.css';
import './popup-system.fixture.css';

const samples = {
 reward: { label: 'BUDDY’S DAILY DROP', title: 'Back on the block.', stamp: 'READY TO COLLECT', copy: 'Your daily drop is waiting.', action: 'Collect check-in', secondary: 'Later', art: 'assets/buddy-growth/buddy-clipboard.webp' },
 announcement: { label: 'THIS WEEK ON THE BLOCK', title: 'New crew. New trouble.', stamp: 'WEEKLY BRIEF', copy: 'A new featured crew is here. Inspect the banner for its end time, complete pool, and odds.', action: 'See the lineup', secondary: 'Later', art: 'assets/results/v3/wordmark.webp' },
 confirmation: { label: 'BEFORE YOU GO', title: 'Leave this fade?', stamp: 'YOUR CALL', copy: 'Leaving gives your opponent the win. Stay if you want to finish the match.', action: 'Leave match', secondary: 'Keep playing', art: '' },
 recruit: { label: 'WELCOME TO THE CREW', title: 'Buddy.', stamp: 'RECRUITED', copy: 'A new face on your block. Open the collection to inspect his abilities.', action: 'Meet your crew', secondary: 'Keep going', art: 'assets/buddy-growth/buddy-clipboard.webp' },
} as const;
const skin = { '--reward-file-scene': `url("${getAssetUrl('assets/selection/underpass.webp')}")`, '--reward-file-folder': `url("${getAssetUrl('assets/selection/dossier.webp')}")` } as CSSProperties;
function Workshop() {
 const [family,setFamily] = useState<GamePopupFamily>('reward');
 const [open,setOpen] = useState(false);
 const dialog = useRef<HTMLDialogElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 const sample = samples[family];
 useEffect(() => {
  if(open) { dialog.current?.showModal(); if(family==='confirmation') dialog.current?.querySelector<HTMLButtonElement>('.game-popup__secondary')?.focus(); }
  else dialog.current?.close();
 },[open,family]);
 const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
 return <main className="popup-workshop">
  <header><span>DEVELOPMENT WORKSHOP · SAMPLE DATA</span><h1>One block. One language.</h1><p>Story crew-selection materials. Four popup purposes. Shared typography and controls.</p></header>
  <nav aria-label="Popup family">{(Object.keys(samples) as GamePopupFamily[]).map(kind => <button key={kind} aria-pressed={family===kind} onClick={()=>setFamily(kind)}>{kind}</button>)}</nav>
  <button className="popup-workshop__open" ref={trigger} onClick={()=>setOpen(true)}>Open {family} preview</button>
  <section className="popup-workshop__types" aria-label="Font roles"><div><b style={{fontFamily:"'Hemi Head Italic'"}}>HEADLINES</b><span>Hemi Head Italic · 700</span></div><div><b style={{fontFamily:"'Blzee'",fontWeight:400}}>Buddy.</b><span>Blzee · 400 · feature names</span></div><div><b style={{fontFamily:"'Hemi Head'"}}>+300 / COLLECT</b><span>Hemi Head · 700 · amounts/actions</span></div><div><b>Clear, readable details.</b><span>Plus Jakarta Sans · body</span></div><div><b style={{fontFamily:"'Space Mono'"}}>DAY 07</b><span>Space Mono · compact metadata</span></div></section>
  <dialog ref={dialog} className="popup-workshop__dialog" aria-labelledby="popup-demo-title" aria-describedby="popup-demo-copy" onCancel={e=>{e.preventDefault();close();}}>
   {open && <GamePopupFrame family={family} material={family==='announcement'||family==='confirmation'?'brick':'dossier'} tone={family==='confirmation'?'destructive':'neutral'} className="reward-street-file popup-workshop__frame" style={skin}>
    <GamePopupClose onClick={close} aria-label="Close preview"/>
    {sample.art && <div className="popup-workshop__art"><img src={getAssetUrl(sample.art)} alt=""/><RewardFileStamp>{sample.stamp}</RewardFileStamp></div>}
    <RewardFilePaper className="popup-workshop__paper">
     <GamePopupLabel>{sample.label}</GamePopupLabel><GamePopupTitle id="popup-demo-title" feature={family==='recruit'}>{sample.title}</GamePopupTitle>
     <GamePopupCopy id="popup-demo-copy">{sample.copy}</GamePopupCopy>
     {family==='reward' && <RewardFileLoot aria-label="Preview rewards"><div><GameGlyph name="cloutStack"/><GamePopupAmount>+300</GamePopupAmount><span>Clout</span></div><div><GameGlyph name="ticket"/><GamePopupAmount>+2</GamePopupAmount><span>Tickets</span></div><div><GameGlyph name="shards"/><GamePopupAmount>+25</GamePopupAmount><span>Style Shards</span></div></RewardFileLoot>}
     <RewardFileAction onClick={close}>{sample.action} →</RewardFileAction><GamePopupSecondary autoFocus={family==='confirmation'} onClick={close}>{sample.secondary}</GamePopupSecondary>
    </RewardFilePaper>
   </GamePopupFrame>}
  </dialog>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Workshop/>);
