import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Award } from 'lucide-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { readCareer } from '@workspace/squabblemon-engine/career';
import { catalogCardByEngineId } from '@workspace/squabblemon-engine/data';
import { ACCOUNT_XP_PER_LEVEL } from '@workspace/squabblemon-engine/economy';
import { catalogPortrait, FighterPortrait, profilePortrait } from './FighterPortrait';
import { IdentityEditor } from './IdentityEditor';

const eventBadges: Record<string, string> = {
  'badge:after-hours': 'After-hours champion',
  'badge:street-draft': 'Street draft winner',
  'badge:neighborhood': 'Neighborhood champion',
};

export function ProfileOverview({ bootstrap, onBusyChange }: { bootstrap: PlayerBootstrap; onBusyChange: (busy: boolean) => void }) {
  const { profile } = bootstrap;
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const { card, isFallback } = profilePortrait(profile);
  const ownedCount = new Set(profile.ownedCardIds.filter(id => !!catalogPortrait(id))).size;
  const career = readCareer(profile.storyProgress.gameplay);
  const masteryIds = new Set([
    ...profile.unlockedCosmeticIds.filter(id => id.startsWith('mastery:')).map(id => id.slice(8)),
    ...Object.entries(career.wins).filter(([, wins]) => wins >= 5).map(([id]) => id),
  ].map(id => catalogPortrait(id)?.catalogId ?? catalogCardByEngineId[id]?.catalogId).filter((id): id is string => !!id));
  const mastered = [...masteryIds].map(id => catalogPortrait(id)!);
  const events = [...new Set(profile.unlockedCosmeticIds)].filter(id => Object.hasOwn(eventBadges, id));
  // The API owns the account level. Present progress relative to that
  // authoritative level so legacy accounts never appear to move backwards.
  const levelStartXp = Math.max(0, (profile.level - 1) * ACCOUNT_XP_PER_LEVEL);
  const nextLevelXp = profile.level * ACCOUNT_XP_PER_LEVEL;
  const progress = Math.max(0, Math.min(ACCOUNT_XP_PER_LEVEL, profile.xp - levelStartXp));
  const xpRemaining = Math.max(0, nextLevelXp - profile.xp);
  if (editing) return <IdentityEditor bootstrap={bootstrap} onBusyChange={onBusyChange} onClose={text => { setMessage(text ?? ''); setEditing(false); }} />;
  return <div className="profile-overview">
    <p className="panel-section-title">Safehouse records / Fighter ID</p>
    <section className="id-card" aria-label="Your fighter identity">
      <div className="id-card__tape" aria-hidden="true" />
      <div className="id-card__photo"><FighterPortrait cardId={card.catalogId} name={card.name} /></div>
      <div className="id-card__info">
        <span className="id-card__label">Fighter tag</span>
        <h1 className="id-card__name">{profile.displayName}</h1>
        <p className="id-card__character">{card.name}<small>{isFallback ? ' / Default portrait' : ' / Character portrait'}</small></p>
        <div className="id-card__stats">
          <div><span className="id-card__label">Account level</span><strong className="id-card__stat-val">Level {profile.level}</strong></div>
          <div><span className="id-card__label">Street Rep</span><strong className="id-card__stat-val">{profile.streetRep.toLocaleString()}</strong></div>
        </div>
        <button ref={editButton} className="street-sign-btn" onClick={() => { setMessage(''); setEditing(true); }}>Edit Identity</button>
      </div>
      <div className="id-card__stamp" aria-hidden="true" />
    </section>
    {message && <p role="status" className="profile-notice">{message}</p>}
    <section className="panel-section" aria-labelledby="profile-progress-title">
      <h2 className="panel-section-title" id="profile-progress-title">Account progress</h2>
      <div className="profile-xp-label" data-testid="text-account-xp-goal"><strong>{progress.toLocaleString()} / {ACCOUNT_XP_PER_LEVEL} account XP</strong><span>{xpRemaining.toLocaleString()} XP to level {profile.level + 1}</span></div>
      <progress className="profile-xp" max={ACCOUNT_XP_PER_LEVEL} value={progress} aria-label={`Account XP toward level ${profile.level + 1}`} />
      <p className="profile-progress-note">{profile.xp.toLocaleString()} lifetime account XP · Account XP raises this level. Character XP separately trains individual cards; Street Rep records your battle reputation.</p>
      <div className="profile-collection-line"><div><strong>{ownedCount}</strong><span>unique characters collected</span></div><Link className="street-sign-btn street-sign-btn--secondary" href="/game/collection">View collection →</Link></div>
    </section>
    <section className="panel-section" aria-labelledby="profile-badges-title">
      <h2 className="panel-section-title" id="profile-badges-title">Earned on the streets</h2>
      {mastered.length || events.length ? <ul className="badge-grid">
        {mastered.map(character => <li className="badge-item" key={character.catalogId}>
          <Award className="badge-icon" aria-hidden="true" />
          <div className="badge-info"><strong className="badge-title">{character.name}</strong><span className="badge-desc">Mastered · 5 character victories</span></div>
        </li>)}
        {events.map(id => <li className="badge-item" key={id}><Award className="badge-icon" aria-hidden="true" /><strong className="badge-title">{eventBadges[id]}</strong></li>)}
      </ul> : <p className="profile-notice">No badges earned yet. Master a character with five victories, or win an event to start your collection.</p>}
      <Link href="/game/missions?view=mastery" className="street-sign-btn street-sign-btn--secondary">Explore mastery & events →</Link>
    </section>
  </div>;
}