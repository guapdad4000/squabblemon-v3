import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import '../styles/ui-polish.css';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { rewardReceipts } from '../lib/rewardReceipts';
import { GameGlyph } from './venue/GameGlyph';
import { getAssetUrl } from '../lib/assets';
import '../styles/reward-reveal.css';
import { LevelUpMoment } from './LevelUpMoment';
export function RewardReveal() {
  const receipt = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (receipt && !dialog.current?.open) dialog.current?.showModal(); }, [receipt]);
  if (!receipt) return null;
  return <dialog ref={dialog} className={`reward-reveal${receipt.level ? ' reward-reveal--level' : ''}`} aria-labelledby="reward-reveal-title" onCancel={() => rewardReceipts.dismiss()}>
    {receipt.level ? <LevelUpMoment level={receipt.level} reduced={Boolean(reduced)} onContinue={() => rewardReceipts.dismiss()} /> : <div className="reward-reveal__stage">
      <img className="reward-reveal__backdrop" src={getAssetUrl('assets/results/win-scene-wide.webp')} alt="" />
      <img className="reward-reveal__bag" src={getAssetUrl('assets/rewards/clout-bag.webp')} alt="" />
      <motion.div className="reward-reveal__receipt" key={receipt.id} initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <span className="studio-eyebrow">{receipt.achievement ? 'DR. FADE CERTIFIED' : receipt.preview ? 'Local preview reward' : 'Added to your bag'}</span>
        <h2 id="reward-reveal-title">{receipt.title}</h2>
        <div className="reward-reveal__items">{receipt.items.map((item, i) => <motion.div key={i} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .12 }}>
          {item.image ? <img src={item.image} alt="" /> : <GameGlyph name={item.glyph ?? 'mastery'} />}
          {item.amount !== undefined && <strong><AnimatedNumber value={item.amount} prefix="+" delay={i * .12} /></strong>}<span>{item.label}</span>
        </motion.div>)}</div>
        <p>{receipt.achievement ? 'You read the districts, banked your Motion, and landed your first SQUABBLE. Go make the block remember.' : receipt.preview ? 'Saved to this preview only.' : 'Your rewards are saved. Keep building your legend.'}</p>
        <button autoFocus className="studio-action studio-action--gold" onClick={() => rewardReceipts.dismiss()}>Keep going →</button>
      </motion.div>
    </div>}
  </dialog>;
}
