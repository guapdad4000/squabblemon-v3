import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadingScreen, type LoadingPhase } from '../src/components/LoadingScreen';
import '../src/index.css';
function Fixture() {
  const [loading, setLoading] = useState(true);
  const phase = new URLSearchParams(location.search).get('phase') as LoadingPhase | null;
  (window as any).finishLoading = () => setLoading(false);
  return loading ? <LoadingScreen phase={phase ?? 'application'} /> : <p>Ready</p>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
