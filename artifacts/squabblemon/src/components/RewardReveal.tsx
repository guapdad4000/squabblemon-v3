import { useEffect, useRef, useSyncExternalStore } from 'react';
import { rewardReceipts } from '../lib/rewardReceipts';
import { GameGlyph } from './venue/GameGlyph';
import { getAssetUrl } from '../lib/assets';
import '../styles/reward-reveal.css';
export function RewardReveal() {
  const receipt = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (receipt && !dialog.current?.open) dialog.current?.showModal(); }, [receipt]);
  if (!receipt) return null;
  return <dialog ref={dialog} className="reward-reveal" aria-labelledby="reward-reveal-title" onCancel={() => rewardReceipts.dismiss()}>
    <div className="reward-reveal__stage">
      <img className="reward-reveal__bag" src={getAssetUrl('assets/rewards/clout-bag.webp')} alt="" />
      <div className="reward-reveal__receipt" key={receipt.id}>
        <span className="studio-eyebrow">{receipt.preview ? 'Local preview reward' : 'Added to your bag'}</span>
        <h2 id="reward-reveal-title">{receipt.title}</h2>
        <div className="reward-reveal__items">{receipt.items.map((item, i) => <div key={i}>
          {item.image ? <img src={item.image} alt="" /> : <GameGlyph name={item.glyph ?? 'mastery'} />}
          {item.amount !== undefined && <strong>+{item.amount.toLocaleString()}</strong>}<span>{item.label}</span>
        </div>)}</div>
        <p>{receipt.preview ? 'Saved to this preview only.' : 'Your rewards are saved. Keep building your legend.'}</p>
        <button autoFocus className="studio-action studio-action--gold" onClick={() => rewardReceipts.dismiss()}>Keep going →</button>
      </div>
    </div>
  </dialog>;
}
