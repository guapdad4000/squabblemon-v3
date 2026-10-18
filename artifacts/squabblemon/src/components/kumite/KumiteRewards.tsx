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
  if (!progression) return null;
  const rewards = progression.rewards;
  const selectedReward = rewards.find(r => r.cardId === selectedCardId) ?? null;
  const selectedCatalog = selectedReward ? catalogCardById[selectedReward.cardId] : null;
  const selectedEngine = selectedCatalog ? cards[selectedCatalog.engineId] : null;
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
      <aside className="kumite-dossier-preview" aria-label={`${selectedReward.name} fighter dossier`}>
        <img className="kumite-dossier-preview__art" src={getCardImage(selectedReward.cardId)} alt={selectedReward.name} />
        <div className="kumite-dossier-preview__body">
          <div className="kumite-dossier-preview__top">
            <span className="kumite-eyebrow">{selectedReward.rarity ?? selectedCatalog.rarity} · {selectedEngine.type.toUpperCase()} · {selectedEngine.cost} MOTION · {selectedEngine.power} HANDS</span>
            <button type="button" className="kumite-dossier-preview__close" onClick={() => setSelectedCardId(null)} aria-label="Close fighter dossier"><X size={16} /></button>
          </div>
          <h3>{selectedReward.name} <small>— {selectedEngine.ability}</small></h3>
          <p>{selectedEngine.effect}</p>
          <div className="kumite-dossier-preview__actions">
            <span className="kumite-dossier-preview__req">{selectedReward.claimed ? '✓ Unlocked via Kumite' : `${selectedReward.requirement} (${Math.min(selectedReward.required, selectedReward.progress)} / ${selectedReward.required})`}</span>
            <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-raid-cta">Fight Dojo Raid →</Link>
            <Link href={`/game/collection?card=${encodeURIComponent(selectedReward.cardId)}`} className="kumite-text-button">Open in Collection →</Link>
            {selectedReward.claimed && selectedReward.owned && <KumiteFilmReplay cardId={selectedReward.cardId} ownedCardIds={[selectedReward.cardId]} />}
          </div>
        </div>
      </aside>
    )}
    <div className="kumite-roadmap__map">
      <img className="kumite-roadmap__art" src={getAssetUrl('assets/kumite/unlock-roadmap.webp')} alt="" draggable={false} loading="lazy" />
      <div className="kumite-rewards__cards kumite-roadmap__nodes">{rewards.map((reward, index) => <article key={reward.id} className="kumite-roadmap__node" data-earned={reward.claimed} data-selected={selectedCardId === reward.cardId} data-side={index % 2 === 0 ? 'left' : 'right'} style={{ '--node-x': `${index % 2 === 0 ? 25 : 75}%`, '--node-y': `${14.7 + index * 9.8}%` } as CSSProperties}>
        <div className="kumite-roadmap__rarity">{reward.rarity ?? catalogPortrait(reward.cardId)?.rarity ?? 'CARD'}</div>
        <button type="button" className="kumite-roadmap__inspect-btn" onClick={() => setSelectedCardId(current => current === reward.cardId ? null : reward.cardId)} aria-label={`Inspect ${reward.name} dossier`}><KumitePortrait hero={reward.cardId} name={reward.name} /></button>
        <div className="kumite-roadmap__node-copy"><h3><Link href={`/game/collection?card=${encodeURIComponent(reward.cardId)}`} aria-label={`View ${reward.name}`}>{reward.name}</Link></h3><p>{reward.requirement}</p><div className="kumite-rewards__meter" role="progressbar" aria-label={`${reward.name} reward progress`} aria-valuemin={0} aria-valuemax={reward.required} aria-valuenow={Math.min(reward.required, reward.progress)}><i style={{ width: `${Math.min(100, reward.progress / Math.max(1, reward.required) * 100)}%` }} /></div><small>{reward.claimed ? <><Check size={12} aria-hidden="true" />Unlocked</> : <><LockKeyhole size={11} aria-hidden="true" />{Math.min(reward.required, reward.progress)} / {reward.required}{reward.owned ? ' · Owned' : ''}</>}</small></div>
      </article>)}</div>
    </div>
  </section>;
}
