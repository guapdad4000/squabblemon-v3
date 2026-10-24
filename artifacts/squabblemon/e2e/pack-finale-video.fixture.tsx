import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PackGymFinale, preloadPackGymFinale } from '../src/components/PackGymFinale';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const initialRarity = params.get('rarity') ?? 'Common';
const pullCount = params.has('ten') ? 10 : 1;
const reduced = params.has('reduced');
function Fixture() {
  const [mounted, setMounted] = useState(true), [active, setActive] = useState(false);
  const [rarity, setRarity] = useState(initialRarity), [done, setDone] = useState(0), [skipped, setSkipped] = useState(0);
  useEffect(() => { if (!reduced) preloadPackGymFinale(pullCount); }, []);
  return <main style={{minHeight:'100dvh',background:'#101813',color:'#fff',padding:16}}>
    <p>LOCAL MEDIA LIFECYCLE SAMPLE · no rewards or charges</p>
    <button onClick={() => setActive(true)}>Start</button>
    <button onClick={() => setMounted(false)}>Unmount</button>
    <button onClick={() => setRarity(rarity === 'Mythical' ? 'Common' : 'Mythical')}>Change rarity</button>
    <output aria-label="Completions">{done}</output><output aria-label="Skips">{skipped}</output>
    {mounted && <PackGymFinale active={active} pullCount={pullCount} rarity={rarity} speed={1} reducedMotion={reduced}
      onSkip={() => { setSkipped(value => value + 1); setMounted(false); }}
      onComplete={() => { setDone(value => value + 1); setMounted(false); }} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
