import { useEffect, useState } from 'react';
import { CharacterBanner, CharacterSticker } from './CharacterBanner';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { cardMotionReduced } from '../lib/cardFinish';

/** Presentation only: pack rewards are committed before this component mounts. */
export function CharacterUnlock({ cardId, children }: { cardId: string; children: React.ReactNode }) {
  const [intro, setIntro] = useState(() => !cardMotionReduced());
  useEffect(() => { if (!intro) return; const timer = window.setTimeout(() => setIntro(false), 3000); return () => window.clearTimeout(timer); }, [intro]);
  const set = styleSetFor(cardId);
  if (!set) return <>{children}</>;
  return <div className="character-unlock" data-intro={intro}>
    {intro ? <><span className="style-kicker">A LEGEND JOINS YOUR GANG</span><CharacterBanner cardId={cardId} /><button type="button" className="style-button" onClick={() => setIntro(false)}>Show my card · Skip intro</button></> : <>
      {children}
      <div className="character-unlock__collection"><CharacterBanner cardId={cardId} compact animated={false} /><p><strong>Character banner unlocked.</strong> Equip it in your bag. Complete the look with his four-sticker pack.</p><div>{set.stickers.map(sticker => <CharacterSticker key={sticker.id} id={sticker.id} />)}</div><button type="button" className="style-link" onClick={() => setIntro(true)}>Replay character reveal</button></div>
    </>}
  </div>;
}
