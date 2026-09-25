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
  const portrait = profilePortrait(profile);
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
    <div className="profile-edition"><span>Oakland / Player file</span><span>No. {String(profile.level).padStart(3, '0')} · Certified original</span></div>
    <section className="id-card" aria-label="Your fighter identity">
      <div className="id-card__tape" aria-hidden="true" />
      <div className="id-card__photo"><span className="id-card__photo-note">Face of the block</span><FighterPortrait cardId={portrait.card.catalogId} avatarKey={portrait.avatarKey} name={portrait.name} /><span className="id-card__photo-caption">{portrait.isSticker ? 'STICKER ID' : 'FIGHTER ID'} / SQUABBLEMON</span></div>
      <div className="id-card__info">
        <span className="id-card__label">Remember the name.</span>
        <h1 className="id-card__name">{profile.displayName}</h1>
        <p className="id-card__character">{portrait.name}<small>{portrait.isFallback ? 'Default portrait' : portrait.isSticker ? 'Your signature · Profile + PvP' : 'Character portrait · Profile + PvP'}</small></p>
        <div className="id-card__stats">
          <div className="id-card__level"><span className="id-card__label">Account level</span><strong className="id-card__stat-val">Level {profile.level}</strong></div>
          <div><span className="id-card__label">Street Rep</span><strong className="id-card__stat-val">{profile.streetRep.toLocaleString()}</strong></div>
        </div>
        <button ref={editButton} className="street-sign-btn" onClick={() => { setMessage(''); setEditing(true); }}>Edit Identity</button>
      </div>
      <div className="id-card__stamp" aria-hidden="true">ONE OF<br />ONE.</div>
    </section>
    {message && <p role="status" className="profile-notice">{message}</p>}
    <div className="profile-flex-strip" aria-label="Your collection and achievements">
      <div><strong>{ownedCount.toLocaleString()}</strong><span>Characters</span></div>
      <div><strong>{mastered.length}</strong><span>Mastered</span></div>
      <div><strong>{events.length}</strong><span>Event badges</span></div>
      <span className="profile-flex-note" aria-hidden="true">Built different.</span>
    </div>
    <div className="profile-paper-columns">
    <section className="panel-section profile-progress-paper" aria-labelledby="profile-progress-title">
      <span className="profile-paper-number" aria-hidden="true">01 / THE COME UP</span>
      <h2 className="profile-paper-title" id="profile-progress-title">Still climbing<span>.</span></h2>
      <div className="profile-xp-label" data-testid="text-account-xp-goal"><strong>{progress.toLocaleString()} / {ACCOUNT_XP_PER_LEVEL} account XP</strong><span>{xpRemaining.toLocaleString()} XP to level {profile.level + 1}</span></div>
      <progress className="profile-xp" max={ACCOUNT_XP_PER_LEVEL} value={progress} aria-label={`Account XP toward level ${profile.level + 1}`} />
      <p className="profile-progress-note">{profile.xp.toLocaleString()} lifetime account XP. Every level adds to your story.</p>
      <Link className="profile-ink-link" href="/game/collection">Open your collection <span aria-hidden="true">↗</span></Link>
    </section>
    <section className="panel-section profile-badges-paper" aria-labelledby="profile-badges-title">
      <span className="profile-paper-number" aria-hidden="true">02 / THE RECEIPTS</span>
      <h2 className="profile-paper-title" id="profile-badges-title">Earned. Never given<span>.</span></h2>
      {mastered.length || events.length ? <ul className="badge-grid">
        {mastered.map(character => <li className="badge-item" key={character.catalogId}>
          <Award className="badge-icon" aria-hidden="true" />
          <div className="badge-info"><strong className="badge-title">{character.name}</strong><span className="badge-desc">Mastered · 5 character victories</span></div>
        </li>)}
        {events.map(id => <li className="badge-item" key={id}><Award className="badge-icon" aria-hidden="true" /><strong className="badge-title">{eventBadges[id]}</strong></li>)}
      </ul> : <p className="profile-progress-note">Your first badge is waiting. Master a character with five victories, or take an event all the way.</p>}
      <Link href="/game/missions?view=mastery" className="profile-ink-link">Explore mastery & events <span aria-hidden="true">↗</span></Link>
    </section>
    </div>
    <footer className="profile-file-footer"><span>YOUR REPUTATION TRAVELS WITH YOU.</span><span>SAFEHOUSE RECORDS / KEEP BUILDING</span></footer>
  </div>;
}
