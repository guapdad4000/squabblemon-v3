import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DeferredRewardStinger } from '../src/components/DeferredRewardStinger';
import { rewardClips } from '../src/lib/broadcastCatalog';
import '../src/index.css';

function Fixture() {
  const [complete, setComplete] = useState(0);
  return complete
    ? <p role="status">Rewards shown · {complete}</p>
    : <DeferredRewardStinger clip={rewardClips[0]} maxDurationMs={1000}
      onComplete={() => setComplete(count => count + 1)} />;
}

createRoot(document.getElementById('root')!).render(<Fixture />);