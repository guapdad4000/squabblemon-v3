import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SpecialMove } from '../src/components/SpecialMove';
import { moveClips } from '../src/specialMoves';
function Fixture() {
  const [sound, setSound] = useState(false), [visible, setVisible] = useState(true);
  return <main style={{ background: '#172030', color: 'white', padding: 20 }}>
    <button onClick={() => setSound(true)}>Sound on</button>
    <button onClick={() => setSound(false)}>Mute</button>
    <button onClick={() => setVisible(false)}>Skip</button>
    {visible && <div style={{ width: 360, height: 540 }}><SpecialMove clip={moveClips.char45} audioEnabled={sound} /></div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
