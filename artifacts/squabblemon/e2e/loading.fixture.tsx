import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LoadingScreen } from '../src/components/LoadingScreen';
import '../src/index.css';
function Fixture() {
  const [loading, setLoading] = useState(true);
  (window as any).finishLoading = () => setLoading(false);
  return loading ? <LoadingScreen /> : <p>Ready</p>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
