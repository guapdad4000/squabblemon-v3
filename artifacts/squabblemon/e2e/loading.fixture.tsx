import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadingScreen, type LoadingPhase } from '../src/components/LoadingScreen';
import '../src/index.css';

function Fixture() {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<LoadingPhase>(() => {
    const requested = new URLSearchParams(location.search).get('phase');
    return requested === 'account' || requested === 'player' || requested === 'scene' ? requested : 'application';
  });
  const [mount, setMount] = useState(0);
  (window as any).finishLoading = () => setLoading(false);
  (window as any).startLoading = (nextPhase: LoadingPhase = 'application') => {
    setPhase(nextPhase);
    setLoading(true);
    setMount(current => current + 1);
  };
  (window as any).changeLoadingPhase = (nextPhase: LoadingPhase) => setPhase(nextPhase);
  (window as any).remountLoading = () => setMount(current => current + 1);
  return loading ? <LoadingScreen key={mount} phase={phase} /> : <p>Ready</p>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);