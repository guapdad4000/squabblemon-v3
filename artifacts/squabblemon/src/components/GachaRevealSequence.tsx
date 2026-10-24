import type { CSSProperties } from 'react';
import type { PackOpening, PackReward } from '@workspace/api-client-react';
import { styleShardLabel } from '@workspace/squabblemon-engine/styleShards';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { ArrowRight } from 'lucide-react';
import { catalogCardById, CARD_RARITY_DEFINITIONS, getAssetUrl, type CardRarity } from '../data';
import { CollectibleCard } from './CollectibleCard';
import { CardPressTarget } from './CardInspection';
import { CharacterUnlock } from './CharacterUnlock';
import { GameGlyph } from './venue/GameGlyph';
import { GamePopupClose, GamePopupSecondary, RewardFileAction } from './ui/game-popup';
import '../styles/gacha-reveal-sequence.css';

export const rewardResourceName = (reward: PackReward) => reward.kind === 'styleShards' ? styleShardLabel(reward.shardRarity) : reward.kind === 'softCurrency' ? 'Clout' : reward.name ?? 'Card';
export const rewardDisplayName = (reward: PackReward) => (reward.cardId ? catalogCardById[reward.cardId]?.name : undefined) ?? reward.name ?? rewardResourceName(reward);
const rarityLabel = (reward: PackReward) => CARD_RARITY_DEFINITIONS[reward.rarity as CardRarity]?.label ?? 'Resource';

/** The same approved full print for new cards, variants and duplicate receipts. */
export function RewardCard({ reward, large = false, inspectable = large }: { reward: PackReward; large?: boolean; inspectable?: boolean }) {
  const card = reward.cardId ? catalogCardById[reward.cardId] : undefined;
  const duplicate = reward.kind === 'styleShards' && Boolean(card);
  return <div className={`gacha-reward-print${large ? ' gacha-reward-print--large' : ''}`} data-rarity={reward.rarity?.toLowerCase() ?? 'currency'}>
    {card && (reward.kind === 'card' || reward.kind === 'variant' || duplicate)
      ? <CollectibleCard card={card} variantId={reward.variantId ?? undefined} isInspector={large} fillContainer presentationOnly inspectable={inspectable} disableLayout className="w-full" />
      : <div className="gacha-reward-print__resource"><GameGlyph name={reward.kind === 'styleShards' ? 'shards' : 'clout'} shardRarity={reward.shardRarity}/><strong>+{reward.amount}</strong><span>{rewardResourceName(reward)}</span></div>}
    {reward.isNew && reward.kind !== 'variant' && <span className="gacha-reward-print__stamp">NEW</span>}
    {reward.kind === 'variant' && <span className="gacha-reward-print__stamp">STYLE UNLOCKED</span>}
  </div>;
}
function RewardReceipt({ reward }: { reward: PackReward }) {
  return reward.kind === 'styleShards' && reward.cardId ? <span className="gacha-reveal__receipt"><GameGlyph name="shards" shardRarity={reward.shardRarity}/><span>Duplicate · <b>+{reward.amount} {styleShardLabel(reward.shardRarity)}</b></span></span> : null;
}
export type GachaRevealSequenceProps = {
  phase: string;
  preparing?: boolean;
  rewards: PackReward[];
  revealIndex: number;
  pullSize: number;
  preview: boolean;
  isWelcomeOpening?: boolean;
  rareHighlightReward?: PackReward;
  seasonRewards?: PackOpening['seasonRewards'];
  onReveal: (index: number) => void;
  onSummary: () => void;
  onFinish: () => void;
};
/** Presentation only: Shop retains the saved opening, order, native dialog and journal lifecycle. */
export function GachaRevealSequence({ phase, preparing = false, rewards, revealIndex, pullSize, preview, isWelcomeOpening, rareHighlightReward, seasonRewards, onReveal, onSummary, onFinish }: GachaRevealSequenceProps) {
  if (phase !== 'reveal' && phase !== 'summary' && !preparing) return null;
  const current = rewards[revealIndex];
  const single = (phase === 'reveal' || preparing) && Boolean(current);
  const card = current?.cardId ? catalogCardById[current.cardId] : undefined;
  const highlighted = current === rareHighlightReward;
  const ten = pullSize === 10;
  const arena = getAssetUrl('brand/gacha/cinematic-v2/single-arrival-wall-v2.webp');
  const cardRewards = rewards.map((reward,index)=>({reward,index})).filter(({reward})=>reward.cardId && catalogCardById[reward.cardId]);
  const resources = rewards.map((reward,index)=>({reward,index})).filter(({reward})=>!reward.cardId || !catalogCardById[reward.cardId]);
  const display = current && <div className="gacha-reveal__flip" key={`card-${revealIndex}`} style={{ '--entry-side': revealIndex % 2 ? -1 : 1 } as CSSProperties}>
    {card ? <CardPressTarget card={card} variantId={current.variantId ?? undefined} tapToInspect className="gacha-reveal__card-target" aria-label={`Inspect ${rewardDisplayName(current)}`}><RewardCard reward={current} large inspectable={false}/></CardPressTarget> : <RewardCard reward={current} large/>}
  </div>;
  return <div className="gacha-reveal game-popup reward-street-file" data-popup-family="reward" data-preparing={preparing || undefined} data-view={single ? 'single' : 'haul'} data-rarity={current?.rarity?.toLowerCase() ?? 'currency'} data-ten={ten} style={{ '--haul-count': Math.max(1, Math.min(6, cardRewards.length)) } as CSSProperties}>
    <div className="gacha-reveal__backdrop" aria-hidden="true"><img className="gacha-reveal__arena" src={arena} alt="" decoding="async" draggable={false}/><span/></div>
    <header className="gacha-reveal__header"><div><span className="gacha-reveal__eyebrow">{preview ? 'LOCAL PREVIEW · NOT SAVED' : isWelcomeOpening ? 'DR. FADE · FREE WELCOME PULL' : `${pullSize} ${pullSize === 1 ? 'PACK' : 'PACKS'} · SAVED`}</span><h2 id="gym-results-title">{single ? `${revealIndex + 1} / ${rewards.length}` : 'Your haul.'}</h2>{!single && <p>{rewards.length} rewards</p>}</div><GamePopupClose aria-label="Close rewards" onClick={onFinish}/></header>
    <div className="gacha-reveal__content" data-short-haul={!single && cardRewards.length <= 6} tabIndex={0} aria-label={single ? 'Current reward' : 'All rewards'}>
      {single && current ? <section className="gacha-reveal__single" aria-label={rewardDisplayName(current)}>
        {current.kind === 'card' && current.isNew && styleSetFor(current.cardId) ? <CharacterUnlock key={revealIndex} cardId={current.cardId!} cardFirst>{display}</CharacterUnlock> : display}
        <div className="gacha-reveal__caption" key={`caption-${revealIndex}`}><h3>{rewardDisplayName(current)}</h3><span>{rarityLabel(current)}{highlighted && <b className="gacha-reveal__guarantee"> · GUARANTEED RARE+</b>}</span><RewardReceipt reward={current}/></div>
      </section> : <>{cardRewards.length > 0 && <div className="gacha-reveal__grid" data-reward-count={rewards.length}>
        {cardRewards.map(({reward,index}) => {
          const card = reward.cardId ? catalogCardById[reward.cardId] : undefined;
          const content = <><RewardCard reward={reward} inspectable={false}/><span className="gacha-reveal__item-caption"><strong>{rewardDisplayName(reward)}</strong><small>{rarityLabel(reward)}{reward === rareHighlightReward && <b className="gacha-reveal__guarantee"> · GUARANTEED RARE+</b>}</small><RewardReceipt reward={reward}/></span></>;
          return card ? <CardPressTarget key={index} card={card} variantId={reward.variantId ?? undefined} tapToInspect className="gacha-reveal__item" aria-label={`Inspect ${rewardDisplayName(reward)}`}>{content}</CardPressTarget>
            : <button type="button" key={index} className="gacha-reveal__item" aria-label={`View ${rewardDisplayName(reward)}`} onClick={()=>onReveal(index)}>{content}</button>;
        })}
      </div>}{resources.length > 0 && <div className="gacha-reveal__resources" aria-label="Resource rewards">{resources.map(({reward,index})=><button key={index} type="button" onClick={()=>onReveal(index)} aria-label={`View +${reward.amount} ${rewardResourceName(reward)}`}><GameGlyph name={reward.kind==='styleShards'?'shards':'clout'} shardRarity={reward.shardRarity}/><span><strong>+{reward.amount}</strong><small>{rewardResourceName(reward)}</small></span></button>)}</div>}</>}
      {!single && Boolean(seasonRewards?.length) && <section className="gacha-reveal__milestones" aria-label="Monthly milestone rewards"><h3>Monthly bonus · saved</h3>{seasonRewards!.map(reward=><p key={`${reward.seasonId}:${reward.threshold}`}><strong>{reward.seasonId} · {reward.threshold} packs</strong><span>{[reward.softCurrency ? `+${reward.softCurrency} Clout` : '',reward.packTickets ? `+${reward.packTickets} Street Pack ${reward.packTickets === 1 ? 'ticket' : 'tickets'}` : '',reward.styleShards ? `+${reward.styleShards} Universal Style Shards` : ''].filter(Boolean).join(' · ')}</span></p>)}</section>}
    </div>
    <footer className="gacha-reveal__actions">{single ? <><RewardFileAction onClick={()=>revealIndex + 1 < rewards.length ? onReveal(revealIndex + 1) : onSummary()}>{revealIndex + 1 < rewards.length ? 'Next card' : 'View haul'}<ArrowRight size={18}/></RewardFileAction><GamePopupSecondary onClick={onSummary}>View all {rewards.length}</GamePopupSecondary></> : <RewardFileAction onClick={onFinish}>Back to gacha<ArrowRight size={18}/></RewardFileAction>}</footer>
  </div>;
}
