import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SpecialMove } from '../src/components/SpecialMove';
import { resolveSpecialMove } from '../src/specialMoves';
const clip = resolveSpecialMove('roaster')!;
function Fixture() {
  const [mounted, setMounted] = useState(true);
  const [status, setStatus] = useState('Starting');
  const onStatus = useCallback((value: string) => setStatus(value), []);
  return <main><button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount' : 'Mount'}</button>
    <output data-testid="status">{status}</output><style>{`.special-move-canvas { width:200px; height:280px; position:static; opacity:1; }`}</style>
    {mounted && <SpecialMove clip={clip} onStatus={onStatus} />}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
