// Local presentation only. No account writes, rewards or matchmaking transport.
import React from 'react';
import { createRoot } from 'react-dom/client';
import BreakthroughHowToPlay from '../src/components/breakthrough/BreakthroughHowToPlay';
import '../src/styles/blzee-type.css';
if (!import.meta.env.DEV) throw new Error('The Breakthrough guide review is development-only.');
const root = createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(() => root.unmount());
root.render(<React.StrictMode><main><BreakthroughHowToPlay /></main></React.StrictMode>);
