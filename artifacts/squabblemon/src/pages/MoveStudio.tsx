import { StreetSelect } from '../components/ui/street-select';
import { useMemo, useState } from 'react';
import { cards, getCardImage } from '../data';
import { getAssetUrl } from '../lib/assets';
import { getMoveClipUrl, MOVE_STORAGE_KEY, moveAssignments, moveClips, readMoveOverrides, type MoveOverrides } from '../specialMoves';
import { SpecialMove } from '../components/SpecialMove';

export default function MoveStudio() {
  const [cardId, setCardId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('card') ?? '';
    return Object.hasOwn(cards, requested) ? requested : 'barber';
  });
  const [overrides, setOverrides] = useState<MoveOverrides>(readMoveOverrides);
  const [clipId, setClipId] = useState(() => {
    const saved = readMoveOverrides();
    return (Object.hasOwn(saved, cardId) ? saved[cardId] : moveAssignments[cardId]) ?? '';
  });
  const [replay, setReplay] = useState(0);
  const [status, setStatus] = useState('Ready to review');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const card = cards[cardId];
  const clip = moveClips[clipId];
  const previewClip = useMemo(() => clip ? { ...clip, startSeconds: 0, playbackRate: 1 } : undefined, [clip]);
  function save() {
    const next = { ...overrides, [cardId]: clipId || null };
    try {
      localStorage.setItem(MOVE_STORAGE_KEY, JSON.stringify(next));
      setOverrides(next);
      setStatus(`Saved for ${card.name}. Future moves in this browser use this selection.`);
    } catch { setStatus('Browser storage is unavailable. Export your assignments to keep them.'); }
  }
  function download() {
    const assignments = { ...moveAssignments, ...overrides, [cardId]: clipId || null };
    const url = URL.createObjectURL(new Blob([JSON.stringify(assignments, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'special-move-assignments.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="move-studio">
    <a href={getAssetUrl('')}>← Squabblemon</a>
    <h1>Special move workshop</h1>
    <p>Every card keeps its battle effects. Try an animation on top, swap a rough clip, or choose the card effect on its own. These first assignments are provisional.</p>
    <div className="move-studio-layout"><section>
      <label>Card<StreetSelect aria-label="Card" value={cardId} onValueChange={event => {
        const id = event; setCardId(id);
        setClipId((Object.hasOwn(overrides, id) ? overrides[id] : moveAssignments[id]) ?? '');
        setReplay(value => value + 1); setStatus('Ready to review');
      }}>{Object.entries(cards).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</StreetSelect></label>
      <p><strong>{card.ability}</strong><br />{card.effect}</p>
      <label>Animation<StreetSelect aria-label="Animation" value={clipId} onValueChange={event => { setClipId(event); setReplay(value => value + 1); setStatus('Unsaved preview'); }}>
        <option value="">Card effect only (no video)</option>
        {Object.entries(moveClips).map(([id, item]) => <option key={id} value={id}>{id} · {item.label} · {item.move}</option>)}
      </StreetSelect></label>
      <button onClick={() => setReplay(value => value + 1)}>Replay preview</button>
      <button aria-pressed={audioEnabled} onClick={() => { setAudioEnabled(value => !value); if (!audioEnabled) setReplay(value => value + 1); }}>{audioEnabled ? 'Mute preview' : 'Play with sound'}</button>
      <button className="primary" onClick={save}>Use for this card</button>
      <p role="status">{status}</p>
      <small>Selections save on this browser. Export assignments to share them or make them the game defaults. Preview plays the full clip at normal speed; battles use shorter excerpts, with a full reveal for OG Uncle.</small>
      <div><button onClick={download}>Export assignments</button><button onClick={() => {
        try { localStorage.removeItem(MOVE_STORAGE_KEY); setOverrides({}); setClipId(moveAssignments[cardId] ?? ''); setStatus('Default assignments restored.'); }
        catch { setStatus('Browser storage is unavailable.'); }
      }}>Restore defaults</button></div>
      {clip && <p><a href={getMoveClipUrl(clip)} target="_blank" rel="noreferrer">Watch original clip ↗</a></p>}
    </section><div className="move-studio-stage">
      <img src={getCardImage(card.id)} alt={card.name} />
      {previewClip && <SpecialMove key={`${cardId}:${clipId}:${replay}`} clip={previewClip} onStatus={setStatus} audioEnabled={audioEnabled} />}
    </div></div>
  </main>;
}
