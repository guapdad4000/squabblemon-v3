import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getGetPlayerBootstrapQueryKey, useUpdatePlayerProfile, type PlayerBootstrap } from '@workspace/api-client-react';
import { e2eAuthEnabled } from '../../lib/auth';
import { catalogPortrait, FighterPortrait, profilePortrait } from './FighterPortrait';

export function IdentityEditor({ bootstrap, onClose, onBusyChange }: {
  bootstrap: PlayerBootstrap;
  onClose: (message?: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { profile } = bootstrap;
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState(profile.avatarKey);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const client = useQueryClient();
  const update = useUpdatePlayerProfile();
  const preview = e2eAuthEnabled && profile.id === 'e2e-player';
  const portraits = [...new Set(profile.ownedCardIds)].map(catalogPortrait).filter(card => !!card);
  const selected = catalogPortrait(avatar) ?? profilePortrait(profile).card;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (flight.current) return;
    if (!name.trim() || name.trim().length > 24) {
      setError('Enter a fighter tag with 1–24 characters.');
      return;
    }
    if (avatar !== profile.avatarKey && !portraits.some(card => card.catalogId === avatar)) {
      setError('Choose a portrait from your owned characters.');
      return;
    }
    flight.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      // Omit an unchanged legacy avatar. Name-only edits never need to replace it.
      const data = { displayName: name.trim(), ...(avatar !== profile.avatarKey ? { avatarKey: avatar } : {}) };
      if (preview) {
        await client.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
        client.setQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey(), current => ({
          ...(current ?? bootstrap), profile: { ...(current ?? bootstrap).profile, ...data },
        }));
      } else {
        const result = await update.mutateAsync({ data });
        await client.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
        client.setQueryData(getGetPlayerBootstrapQueryKey(), result);
      }
      onClose(preview ? 'Preview identity applied for this session only. Refresh restores the preview.' : 'Profile saved.');
    } catch (reason) {
      const detail = reason instanceof ApiError && typeof reason.data === 'object' && reason.data && 'error' in reason.data
        ? String(reason.data.error) : '';
      setError(`Could not save identity. ${detail || 'Your draft is still here.'} Please try again.`);
    } finally {
      flight.current = false; setBusy(false); onBusyChange(false);
    }
  }
  return <form className="identity-editor" onSubmit={save} aria-busy={busy}>
    <h2 className="panel-title">Edit Identity</h2>
    <p>Your fighter tag is your name on the block. Your portrait comes from your collection.</p>
    {preview && <p className="profile-notice">Local preview · Changes last for this session only.</p>}
    <div className="identity-draft-preview" aria-label="Identity draft preview">
      <FighterPortrait cardId={selected.catalogId} name={selected.name} />
      <div className="identity-draft-preview-info"><span className="id-card__label">Preview / not saved</span><strong className="id-card__name">{name.trim() || 'Your fighter tag'}</strong><small>{selected.name}</small></div>
    </div>
    <div className="panel-section">
      <label htmlFor="fighter-tag" className="panel-section-title">Fighter tag (max 24)</label>
      <input autoFocus id="fighter-tag" className="paper-input" value={name} maxLength={24} autoComplete="nickname"
        disabled={busy} onChange={event => { setName(event.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'identity-error' : undefined} />
    </div>
    <fieldset className="panel-section" disabled={busy}>
      <legend className="panel-section-title">Owned character portraits</legend>
      {!catalogPortrait(avatar) && <p className="profile-notice">Your saved portrait is unavailable. Keep it with a name-only edit, or choose an owned character below.</p>}
      <div className="avatar-grid">
        {portraits.map(card => <button key={card.catalogId} className="avatar-choice" type="button"
          aria-label={card.name} aria-pressed={avatar === card.catalogId} onClick={() => { setAvatar(card.catalogId); setError(''); }}>
          <FighterPortrait cardId={card.catalogId} name={card.name} decorative /><span>{card.name}</span>
        </button>)}
      </div>
      {!portraits.length && <p>No character portraits unlocked yet. You can still update your fighter tag.</p>}
    </fieldset>
    {error && <p id="identity-error" role="alert" className="profile-notice profile-notice--error">{error}</p>}
    <div className="fighter-id-actions">
      <button className="street-sign-btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</button>
      <button className="street-sign-btn street-sign-btn--secondary" disabled={busy} type="button" onClick={() => onClose()}>Cancel</button>
    </div>
  </form>;
}