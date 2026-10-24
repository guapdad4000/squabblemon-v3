import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KeyedVideo } from '../src/components/KeyedVideo';

function Fixture() {
  const [paused, setPaused] = useState(true);
  const [mounted, setMounted] = useState(true);
  const [offscreen, setOffscreen] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [ended, setEnded] = useState(0);
  return <main>
    <button onClick={() => setPaused(value => !value)}>{paused ? 'Resume' : 'Pause'}</button>
    <button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount' : 'Mount'}</button>
    <button onClick={() => setOffscreen(value => !value)}>{offscreen ? 'Show' : 'Move offscreen'}</button>
    <button onClick={() => setPortrait(value => !value)}>Change aspect</button>
    <output data-testid="ended">{ended}</output>
    <style>{`.keyed-test { display:block; width:${portrait ? 90 : 160}px; height:${portrait ? 160 : 90}px; }`}</style>
    <section style={{ position: 'absolute', top: offscreen ? 3000 : 60, left: 20 }}>
      {mounted && <KeyedVideo className="keyed-test" src={`${import.meta.env.BASE_URL}assets/pvp/versus/versus-logo.webm`}
        mode="green" loop maxWidth={160} paused={paused} onEnded={() => setEnded(value => value + 1)} />}
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
