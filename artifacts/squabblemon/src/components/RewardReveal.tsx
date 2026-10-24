import {CharacterRecruitment} from './CharacterRecruitment';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import '../styles/ui-polish.css';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { canPresentRewardStinger, rewardReceipts, type RewardReceipt } from '../lib/rewardReceipts';
import { GameGlyph } from './venue/GameGlyph';
import { getAssetUrl } from '../lib/assets';
import '../styles/reward-reveal.css';
import { GamePopupTitle, GamePopupLabel, GamePopupCopy, GamePopupAmount, RewardFilePaper, RewardFileStamp, RewardFileLoot, RewardFileAction } from './ui/game-popup';
import '../styles/reward-reveal-popup.css';
import { LevelUpMoment } from './LevelUpMoment';
import { DepthReveal } from './DepthReveal';
import { DeferredRewardStinger as RewardStinger } from './DeferredRewardStinger';
import { selectRewardClip } from '../lib/rewardBroadcast';
import { useBattleSpeed } from '../hooks/useBattleSpeed';
import { KUMITE_FILMS } from '../lib/kumiteFilms';
import { KumiteFilmPlayer, KumiteFilmReplay } from './kumite/KumiteFilmPlayer';

function StoryReceipt({ receipt, reduced }: { receipt: RewardReceipt; reduced: boolean }) {
  const wallet = useRef<HTMLDivElement>(null);
  const token = useRef<HTMLImageElement>(null);
  const [travel, setTravel] = useState<{ x: number; y: number } | null>(null);
  const [collected, setCollected] = useState(reduced);
  const balance = receipt.story?.cloutBalance;
  useEffect(() => {
    if (!balance || reduced || collected || !travel) return;
    const timer = window.setTimeout(() => setCollected(true), 1100);
    return () => window.clearTimeout(timer);
  }, [balance, reduced, collected, travel]);
  useEffect(() => {
    if (!balance || reduced) return;
    let frame = requestAnimationFrame(() => {
      const from = token.current?.getBoundingClientRect();
      const to = wallet.current?.getBoundingClientRect();
      if (from && to) setTravel({
        x: to.left + to.width / 2 - from.left - from.width / 2,
        y: to.top + to.height / 2 - from.top - from.height / 2,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [balance, reduced]);

  return <div className="reward-reveal__story-shell">
    <div className="reward-reveal__story-scroll">
      <div className="reward-reveal__story-hero">
        <img className="reward-reveal__story-backdrop" src={getAssetUrl(receipt.story!.backgroundAssetId)} alt="" />
        {receipt.story?.portraitAssetId && <img className="reward-reveal__story-portrait" src={getAssetUrl(receipt.story.portraitAssetId)} data-story-player={receipt.story.portraitAssetId === 'assets/characters/player.webp' || undefined} alt="" />}
        <div className="reward-reveal__story-heading">
          <GamePopupLabel className="studio-eyebrow">{receipt.story?.catchUp ? 'The neighborhood owed you' : 'Story reward delivered'}</GamePopupLabel>
          <GamePopupCopy className="reward-reveal__chapter">{receipt.story!.chapterTitle}</GamePopupCopy>
          <GamePopupTitle id="reward-reveal-title">{receipt.title}</GamePopupTitle>
        </div>
      </div>
      {balance && <section className="reward-reveal__collection" aria-label="Clout collection"
        data-balance-from={balance.from} data-balance-to={balance.to} data-collected={collected}>
        <div className="reward-reveal__token-origin">
          <GameGlyph name="clout" />
          <span>+{(balance.to - balance.from).toLocaleString()} Clout</span>
          {!reduced && !collected && travel && <motion.img
            className="reward-reveal__travel-token"
            src={getAssetUrl('assets/rewards/clout-token.webp')}
            alt=""
            initial={{ x: 0, y: 0, scale: 1.25, opacity: 1 }}
            animate={{ x: travel.x, y: travel.y, scale: .4, opacity: 0 }}
            transition={{ duration: .85, delay: .1, ease: [.18, .68, .2, 1] }}
            aria-hidden="true"
          />}
          {/* The permanent origin image measures the exact journey to the wallet. */}
          <img ref={token} className="reward-reveal__measure-token" src={getAssetUrl('assets/rewards/clout-token.webp')} alt="" aria-hidden="true" />
        </div>
        <div ref={wallet} className="reward-reveal__wallet">
          <span>Clout balance</span>
          <GamePopupAmount><AnimatedNumber from={balance.from} value={collected ? balance.to : balance.from} reducedMotion={reduced || (collected && !travel)} /></GamePopupAmount>
        </div>
        {!reduced && !collected && <button type="button" className="reward-reveal__skip" onClick={() => setCollected(true)}>Skip animation</button>}
      </section>}
      <RewardFilePaper className="reward-reveal__story-content">
        <div className="reward-reveal__story-section">
          <span>{receipt.story?.catchUp ? 'Missing first-clear rewards · added now' : 'Added to your collection'}</span>
          <small>{receipt.items.length} {receipt.items.length === 1 ? 'award' : 'awards'}</small>
        </div>
        <RewardFileLoot className="reward-reveal__items">
          {receipt.items.map((item, index) => <motion.div className="reward-reveal__story-item" key={index}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * .09, .6) }}>
            <div className="reward-reveal__story-item-art">
              {item.image ? <img src={item.image} alt="" /> : <GameGlyph name={item.glyph ?? 'mastery'} shardRarity={item.shardRarity} />}
            </div>
            <div className="reward-reveal__story-item-copy">
              {item.amount !== undefined && <GamePopupAmount>+{item.amount.toLocaleString()}</GamePopupAmount>}
              <span>{item.label}</span>
            </div>
          </motion.div>)}
        </RewardFileLoot>
        <GamePopupCopy className="reward-reveal__saved">{receipt.story?.catchUp
          ? 'These were missing from your earlier first clear. Your past rewards remain yours.'
          : 'Saved to your account. This stop cannot award the same prize twice.'}</GamePopupCopy>
      </RewardFilePaper>
    </div>
    <div className="reward-reveal__story-footer">
      <span role="status" aria-live="polite">{collected && balance ? `${(balance.to - balance.from).toLocaleString()} Clout collected. Balance ${balance.to.toLocaleString()} Clout.` : 'Rewards saved to your account.'}</span>
      <RewardFileAction autoFocus onClick={() => rewardReceipts.dismiss(receipt.id)}>Keep going <span aria-hidden="true">→</span></RewardFileAction>
    </div>
  </div>;
}

export function RewardReveal() {
  const receipt = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const [speed] = useBattleSpeed();
  const dialog = useRef<HTMLDialogElement>(null);
  const [stingerOwner, setStingerOwner] = useState<string | null>(null);
  const film = receipt?.kumiteFilmKey && !reduced && !rewardReceipts.stingerWasConsumed(receipt.id)
    && (!rewardReceipts.stingerWasStarted(receipt.id) || stingerOwner === receipt.id)
    ? KUMITE_FILMS.find(item => item.key === receipt.kumiteFilmKey) : undefined;
  useEffect(() => { if (receipt && !dialog.current?.open) dialog.current?.showModal(); }, [receipt]);
  const mayPresentClip = receipt && canPresentRewardStinger(receipt, Boolean(reduced))
    && (!rewardReceipts.stingerWasStarted(receipt.id) || stingerOwner === receipt.id);
  const clip = receipt && mayPresentClip
    ? rewardReceipts.stingerSelection(receipt.id, () => selectRewardClip('reward'))
    : undefined;
  useEffect(() => {
    if (!receipt || (!clip && !film) || stingerOwner === receipt.id) return;
    if (rewardReceipts.beginStinger(receipt.id)) setStingerOwner(receipt.id);
  }, [receipt, clip, film, stingerOwner]);
  if (!receipt) return null;
  if (film) return <KumiteFilmPlayer key={receipt.id} film={film}
    onClose={() => rewardReceipts.consumeStinger(receipt.id)} onComplete={() => rewardReceipts.consumeStinger(receipt.id)} />;
  if (receipt.characterId) return <CharacterRecruitment key={receipt.id} id={receipt.characterId} items={receipt.items} reduced={Boolean(reduced)} onClose={() => rewardReceipts.dismiss(receipt.id)} />;
  const showReceipt = () => receipt.story ? <StoryReceipt key={receipt.id} receipt={receipt} reduced={Boolean(reduced)} />
    : <div className="reward-reveal__stage">
      <img className="reward-reveal__backdrop" src={getAssetUrl('assets/selection/underpass.webp')} alt="" />
      <img className="reward-reveal__bag" src={getAssetUrl('assets/rewards/clout-bag.webp')} alt="" />
      <motion.div className="reward-reveal__receipt reward-street-file__paper" key={receipt.id} initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <RewardFileStamp>{receipt.achievement ? 'DR. FADE CERTIFIED' : receipt.preview ? 'Local preview reward' : 'Added to your bag'}</RewardFileStamp>
        <GamePopupTitle id="reward-reveal-title">{receipt.title}</GamePopupTitle>
        <RewardFileLoot className="reward-reveal__items">{receipt.items.map((item, i) => <motion.div key={i} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .12 }}>
          <DepthReveal rarity={item.shardRarity} className="reward-reveal__flip">{item.image ? <img src={item.image} alt="" /> : <GameGlyph name={item.glyph ?? 'mastery'} shardRarity={item.shardRarity} />}</DepthReveal>
          {item.amount !== undefined && <GamePopupAmount><AnimatedNumber value={item.amount} prefix="+" delay={i * .12} /></GamePopupAmount>}<span>{item.label}</span>
        </motion.div>)}</RewardFileLoot>
        <GamePopupCopy>{receipt.achievement ? 'You read the districts, banked your Motion, and landed your first SQUABBLE. Go make the block remember.' : receipt.preview ? 'Saved to this preview only.' : 'Your rewards are saved. Keep building your legend.'}</GamePopupCopy>
        {receipt.kumiteFilmKey && (() => { const unlocked = KUMITE_FILMS.find(item => item.key === receipt.kumiteFilmKey); return unlocked ? <KumiteFilmReplay cardId={unlocked.cardId} ownedCardIds={[unlocked.cardId]} /> : null; })()}
        <RewardFileAction autoFocus onClick={() => rewardReceipts.dismiss(receipt.id)}>Keep going <span aria-hidden="true">→</span></RewardFileAction>
      </motion.div>
    </div>;
  const fileStyle = { '--reward-file-scene': `url("${getAssetUrl('assets/selection/underpass.webp')}")`, '--reward-file-folder': `url("${getAssetUrl('assets/selection/dossier.webp')}")` } as CSSProperties;
  return <dialog ref={dialog} style={!receipt.level && !clip ? fileStyle : undefined} data-popup-family={!receipt.level && !clip ? 'reward' : undefined} className={`reward-reveal${!receipt.level && !clip ? ' game-popup reward-street-file' : ''}${receipt.level ? ' reward-reveal--level' : ''}${receipt.story ? ' reward-reveal--story' : ''}${clip ? ' reward-reveal--stinger' : ''}`} aria-labelledby="reward-reveal-title" onCancel={() => rewardReceipts.dismiss(receipt.id)}>
    {receipt.level ? <LevelUpMoment level={receipt.level} reduced={Boolean(reduced)} onContinue={() => rewardReceipts.dismiss(receipt.id)} />
      : clip ? <div className="reward-reveal__stinger">
        <h2 id="reward-reveal-title" className="reward-reveal__stinger-title">{receipt.title}</h2>
        <RewardStinger key={receipt.id} clip={clip} speed={speed} onComplete={() => rewardReceipts.consumeStinger(receipt.id)} actionLabel="Show rewards" />
      </div>
      : receipt.story ? <StoryReceipt key={receipt.id} receipt={receipt} reduced={Boolean(reduced)} />
        : showReceipt()}
  </dialog>;
}
