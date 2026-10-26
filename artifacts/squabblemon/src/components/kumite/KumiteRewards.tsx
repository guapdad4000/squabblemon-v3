import { Check, HandFist, LockKeyhole, Swords, X } from 'lucide-react';
import { Link } from 'wouter';
import { useState, type CSSProperties } from 'react';
import type { KumiteProgression } from '../../lib/kumite';
import { KumitePortrait } from './KumiteWinnerCard';
import { catalogPortrait } from '../profile/FighterPortrait';
import { cards, catalogCardById, getAssetUrl, getCardImage } from '../../data';
import { KumiteFilmReplay } from './KumiteFilmPlayer';

/** Reward receipts and progress come only from the authenticated server profile. */
export function KumiteRewards({ progression }: { progression?: KumiteProgression | null }) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [stanceTier, setStanceTier] = useState<'base' | 'squabble' | 'awakened'>('base');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'claimed'>('all');
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
    {nextMilestone && (
      <div className="kumite-mission-hud" aria-label="Active Kumite unlock mission">
        <div className="kumite-mission-hud__target">
          <span className="kumite-mission-hud__badge">ACTIVE DOJO MISSION</span>
          <strong>{nextMilestone.name}</strong>
          <small>{nextMilestone.requirement}</small>
        </div>
        <div className="kumite-mission-hud__progress">
          <div>
            <span>PROGRESS</span>
            <b>{Math.min(nextMilestone.required, nextMilestone.progress)} / {nextMilestone.required}</b>
          </div>
          <div className="kumite-rewards__meter">
            <i style={{ width: `${Math.min(100, (nextMilestone.progress / Math.max(1, nextMilestone.required)) * 100)}%` }} />
          </div>
        </div>
        <div className="kumite-mission-hud__filters" role="group" aria-label="Filter roadmap milestones">
          {(['all', 'active', 'claimed'] as const).map(mode => (
            <button key={mode} type="button" aria-pressed={filterMode === mode} onClick={() => setFilterMode(mode)}>
              {mode === 'all' ? 'ALL 9' : mode === 'active' ? 'IN PROGRESS' : 'UNLOCKED'}
            </button>
          ))}
        </div>
      </div>
    )}
    {selectedReward && selectedCatalog && selectedEngine && (
      <aside className="kumite-dossier-preview" data-stance={stanceTier} aria-label={`${selectedReward.name} fighter dossier`}>
        <div className="kumite-dossier-preview__art-wrap" data-stance={stanceTier}>
          <img className="kumite-dossier-preview__art" src={getCardImage(selectedReward.cardId)} alt={selectedReward.name} />
          <span className="kumite-dossier-preview__aura-tag">
            {stanceTier === 'awakened' ? 'AWAKENED GLO · 10+ HANDS' : stanceTier === 'squabble' ? 'SQUABBLE 2× STANCE' : 'BASE DOJO STANCE'}
          </span>
        </div>
        <div className="kumite-dossier-preview__body">
          <div className="kumite-dossier-preview__top">
            <span className="kumite-eyebrow">{selectedReward.rarity ?? selectedCatalog.rarity} · {selectedEngine.type.toUpperCase()} · {selectedEngine.cost} MOTION · {displayedPower} HANDS</span>
            <button type="button" className="kumite-dossier-preview__close" onClick={() => setSelectedCardId(null)} aria-label="Close fighter dossier"><X size={16} /></button>
          </div>
          <h3>{selectedReward.name} <small>— {selectedEngine.ability}</small></h3>
          <p>{selectedEngine.effect}</p>
          <div className="kumite-stance-tabs" role="group" aria-label="Preview dynamic Squabble forms">
            {([
              ['base', `01 · Base (${selectedEngine.power}H)`],
              ['squabble', `02 · Squabble (${selectedEngine.power * 2}H)`],
              ['awakened', `03 · Awakened (${Math.max(10, selectedEngine.power * 2 + 2)}H+)`],
            ] as const).map(([tier, label]) => (
              <button key={tier} type="button" aria-pressed={stanceTier === tier} onClick={() => setStanceTier(tier)}>
                {label}
              </button>
            ))}
          </div>
          <div className="kumite-dossier-preview__actions">
            <span className="kumite-dossier-preview__req">{selectedReward.claimed ? '✓ Unlocked via Kumite' : `${selectedReward.requirement} (${Math.min(selectedReward.required, selectedReward.progress)} / ${selectedReward.required})`}</span>
            <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-raid-cta">Fight Dojo Raid →</Link>
            <Link href={`/game/collection?card=${encodeURIComponent(selectedReward.cardId)}`} className="kumite-text-button">Open in Collection →</Link>
            {selectedReward.claimed && selectedReward.owned && <KumiteFilmReplay cardId={selectedReward.cardId} ownedCardIds={[selectedReward.cardId]} />}
          </div>
        </div>
      </aside>
    )}
    <div className="kumite-roadmap__map" data-filter={filterMode}>
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
      <div className="kumite-rewards__cards kumite-roadmap__nodes">{rewards.map((reward, index) => <article key={reward.id} className="kumite-roadmap__node" data-earned={reward.claimed} data-next={nextMilestone?.id === reward.id && !reward.claimed} data-selected={selectedCardId === reward.cardId} data-dimmed={(filterMode === 'active' && reward.claimed) || (filterMode === 'claimed' && !reward.claimed)} data-side={index % 2 === 0 ? 'left' : 'right'} style={{ '--node-x': `${index % 2 === 0 ? 25 : 75}%`, '--node-y': `${14.7 + index * 9.8}%` } as CSSProperties}>
        <div className="kumite-roadmap__rarity">{reward.rarity ?? catalogPortrait(reward.cardId)?.rarity ?? 'CARD'}</div>
        <button type="button" className="kumite-roadmap__inspect-btn" onClick={() => setSelectedCardId(current => current === reward.cardId ? null : reward.cardId)} aria-label={`Inspect ${reward.name} dossier`}><KumitePortrait hero={reward.cardId} name={reward.name} /></button>
        <div className="kumite-roadmap__node-copy"><h3><Link href={`/game/collection?card=${encodeURIComponent(reward.cardId)}`} aria-label={`View ${reward.name}`}>{reward.name}</Link></h3><p>{reward.requirement}</p><div className="kumite-rewards__meter" role="progressbar" aria-label={`${reward.name} reward progress`} aria-valuemin={0} aria-valuemax={reward.required} aria-valuenow={Math.min(reward.required, reward.progress)}><i style={{ width: `${Math.min(100, reward.progress / Math.max(1, reward.required) * 100)}%` }} /></div><small>{reward.claimed ? <><Check size={12} aria-hidden="true" />Unlocked</> : <><LockKeyhole size={11} aria-hidden="true" />{Math.min(reward.required, reward.progress)} / {reward.required}{reward.owned ? ' · Owned' : ''}</>}</small></div>
      </article>)}</div>
    </div>
  </section>;
}
