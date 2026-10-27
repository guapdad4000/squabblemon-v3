import {cardMotionReduced} from '../../lib/cardFinish';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { KumiteCrewActions } from './KumiteCrewActions';
import { kumiteFighter, kumiteFormAsset } from '@workspace/squabblemon-engine/kumiteForms';
import { Check, HandFist, LockKeyhole, Swords, X } from 'lucide-react';
import { Link } from 'wouter';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { KumiteProgression } from '../../lib/kumite';
import { KumitePortrait } from './KumiteWinnerCard';
import { catalogPortrait } from '../profile/FighterPortrait';
import { cards, catalogCardById, getAssetUrl, getCardImage } from '../../data';
import { KumiteFilmReplay } from './KumiteFilmPlayer';

/** Reward receipts and progress come only from the authenticated server profile. */
export function KumiteRewards({ progression, bootstrap }: { progression?: KumiteProgression | null; bootstrap?: PlayerBootstrap }) {
  const dossier=useRef<HTMLElement>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filter,setFilter]=useState<'all'|'progress'|'unlocked'>('all');
  const [stanceTier, setStanceTier] = useState<'base' | 'squabble' | 'awakened'>('base');
  useEffect(()=>{if(selectedCardId)dossier.current?.scrollIntoView({block:'nearest',behavior:cardMotionReduced()?'instant':'smooth'});},[selectedCardId]);
  if (!progression) return null;
  const rewards = progression.rewards;
  const nextMilestone = rewards.find(r => !r.claimed) ?? rewards[rewards.length - 1];
  const selectedReward = rewards.find(r => r.cardId === selectedCardId) ?? null;
  const selectedCatalog = selectedReward ? catalogCardById[selectedReward.cardId] : null;
  const selectedEngine = selectedCatalog ? cards[selectedCatalog.engineId] : null;
  const displayedPower = selectedEngine
    ? stanceTier === 'awakened'
      ? Math.max(10, selectedEngine.power * 2 + 2)
      : stanceTier === 'squabble'
        ? selectedEngine.power * 2
        : selectedEngine.power
    : 0;
  // Each server milestone sits on a branch of the illustrated road. Receipt order
  // stays stable; ownership alone never marks a Kumite milestone complete.
  return <section className="kumite-rewards kumite-roadmap" aria-label="Your Kumite fighter rewards">
    <header>
      <HandFist size={21} aria-hidden="true" />
      <h2>Kumite unlocks</h2>
      <span>{progression.completedMatches} FIGHTS · {progression.matchWins} WINS · {progression.championships} TITLES</span>
      <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-raid-cta"><Swords size={14} aria-hidden="true" /><span>Grind Unlocks in Dojo Raid →</span></Link>
    </header>
    {selectedReward && selectedCatalog && selectedEngine && (
      <aside ref={dossier} className="kumite-dossier-preview" data-stance={stanceTier} aria-label={`${selectedReward.name} fighter dossier`}>
        <div className="kumite-dossier-preview__art-wrap" data-stance={stanceTier}>
          <img className="kumite-dossier-preview__art" src={kumiteFighter(selectedReward.cardId) ? getAssetUrl(kumiteFormAsset(kumiteFighter(selectedReward.cardId)!,stanceTier)) : getCardImage(selectedReward.cardId)} alt={selectedReward.name} />
          <span className="kumite-dossier-preview__aura-tag">
            {stanceTier === 'awakened' ? 'GLO OVERDRIVE' : stanceTier === 'squabble' ? 'SQUABBLE 2×' : 'BASE STANCE'}
          </span>
        </div>
        <div className="kumite-dossier-preview__body">
          <div className="kumite-dossier-preview__top">
            <span className="kumite-eyebrow">{selectedReward.rarity ?? selectedCatalog.rarity} · {selectedEngine.type.toUpperCase()} · {selectedEngine.cost}M / {displayedPower}H</span>
            <button type="button" className="kumite-dossier-preview__close" onClick={() => setSelectedCardId(null)} aria-label="Close fighter dossier"><X size={16} /></button>
          </div>
          <h3>{selectedReward.name} <small>— {selectedEngine.ability}</small></h3>
          {kumiteFighter(selectedReward.cardId) && <div className="kumite-stance-tabs" role="group" aria-label="Preview dynamic Squabble forms">
            {([
              ['base', `I · BASE (${selectedEngine.power}H)`],
              ['squabble', `II · SQUABBLE (${selectedEngine.power * 2}H)`],
              ['awakened', `III · GLO (${Math.max(10, selectedEngine.power * 2 + 2)}H)`],
            ] as const).map(([tier, label]) => (
              <button key={tier} type="button" aria-pressed={stanceTier === tier} onClick={() => setStanceTier(tier)}>
                {label}
              </button>
            ))}
          </div>}
          {progression.mastery?.filter(m=>m.cardId===selectedReward.cardId).map(m=><div key={m.cardId} className="kumite-mastery"><div><span>{m.dojoCleared?'✓':'○'} DOJO · TIER {m.requiredTier}</span><span>{m.weeklyWin?'✓':'○'} WEEKLY WIN · IN CREW</span><strong>{m.altOwned?'GRANDMASTER ART UNLOCKED':'GRANDMASTER ART'}</strong></div><ul>{m.quests.map(q=><li key={q.id} data-complete={q.complete}><span>{q.claimed?'✓':q.complete?'◆':'○'} {q.label}</span><small>{q.claimed?'SAVED':`+${q.styleShards} STYLE SHARDS`}</small></li>)}</ul></div>)}
          {bootstrap&&<KumiteCrewActions bootstrap={bootstrap} cardId={selectedReward.cardId}/>}
          <div className="kumite-dossier-preview__actions">
            <span className="kumite-dossier-preview__req">{selectedReward.claimed ? '✓ UNLOCKED' : `${Math.min(selectedReward.required, selectedReward.progress)}/${selectedReward.required} · ${selectedReward.requirement}`}</span>
            <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-raid-cta">FIGHT DOJO →</Link>
            {selectedReward.claimed && selectedReward.owned && <KumiteFilmReplay cardId={selectedReward.cardId} ownedCardIds={[selectedReward.cardId]} />}
          </div>
        </div>
      </aside>
    )}
    <div className="kumite-roadmap__filters" role="group" aria-label="Filter unlock road">{([['all','ALL'],['progress','IN PROGRESS'],['unlocked','UNLOCKED']] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
    <div className="kumite-roadmap__map"><div className="kumite-roadmap__embers" aria-hidden="true"><i/><i/><i/><i/></div>
      <img className="kumite-roadmap__art" src={getAssetUrl('assets/kumite/unlock-roadmap.webp')} alt="" draggable={false} loading="lazy" />
      <svg className="kumite-roadmap__svg-spine" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {rewards.slice(0, -1).map((reward, index) => {
          const x1 = index % 2 === 0 ? 25 : 75;
          const y1 = 14.7 + index * 9.8;
          const x2 = (index + 1) % 2 === 0 ? 25 : 75;
          const y2 = 14.7 + (index + 1) * 9.8;
          return <line key={reward.id} x1={x1} y1={y1} x2={x2} y2={y2} data-lit={reward.claimed} />;
        })}
      </svg>
      <div className="kumite-rewards__cards kumite-roadmap__nodes">{rewards.map((reward, index) => <article key={reward.id} className="kumite-roadmap__node" hidden={filter==='unlocked'?!reward.claimed:filter==='progress'?reward.claimed:false} data-earned={reward.claimed} data-next={nextMilestone?.id === reward.id && !reward.claimed} data-selected={selectedCardId === reward.cardId} data-side={index % 2 === 0 ? 'left' : 'right'} style={{ '--node-x': `${index % 2 === 0 ? 25 : 75}%`, '--node-y': `${14.7 + index * 9.8}%` } as CSSProperties}>
        {nextMilestone?.id === reward.id && !reward.claimed && <span className="kumite-roadmap__target-flag">★ NEXT TARGET</span>}
        <div className="kumite-roadmap__rarity">{reward.rarity ?? catalogPortrait(reward.cardId)?.rarity ?? 'CARD'}</div>
        <button type="button" className="kumite-roadmap__inspect-btn" onClick={() => {setStanceTier('base');setSelectedCardId(current => current === reward.cardId ? null : reward.cardId);}} aria-label={`Inspect ${reward.name} dossier`}><KumitePortrait hero={reward.cardId} name={reward.name} /></button>
        <div className="kumite-roadmap__node-copy"><h3><Link href={`/game/collection?card=${encodeURIComponent(reward.cardId)}`} aria-label={`View ${reward.name}`}>{reward.name}</Link></h3><p>{reward.requirement}</p><div className="kumite-roadmap__paths"><span>BRACKET · {reward.progress}/{reward.required}</span><Link href="/game/challenges?game=punch-on-patrol&raid=kumite">DOJO RAID →</Link></div><div className="kumite-rewards__meter" role="progressbar" aria-label={`${reward.name} reward progress`} aria-valuemin={0} aria-valuemax={reward.required} aria-valuenow={Math.min(reward.required, reward.progress)}><i style={{ width: `${Math.min(100, reward.progress / Math.max(1, reward.required) * 100)}%` }} /></div><small>{reward.claimed ? <><Check size={12} aria-hidden="true" />Unlocked</> : <><LockKeyhole size={11} aria-hidden="true" />{Math.min(reward.required, reward.progress)} / {reward.required}{reward.owned ? ' · Owned' : ''}</>}</small></div>
      </article>)}</div>
    </div>
  </section>;
}
