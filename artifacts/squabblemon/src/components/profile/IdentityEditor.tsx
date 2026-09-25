import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getGetPlayerBootstrapQueryKey, useUpdatePlayerProfile, type PlayerBootstrap } from '@workspace/api-client-react';
import { e2eAuthEnabled } from '../../lib/auth';
import { catalogPortrait, FighterPortrait, profilePortrait } from './FighterPortrait';
import { avatarSticker, STICKER_AVATARS, stickerAvatarKey } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById } from '@workspace/squabblemon-engine/data';

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
  const [avatarTab, setAvatarTab] = useState<'stickers' | 'characters'>('stickers');
  const [search, setSearch] = useState('');
  const flight = useRef(false);
  const client = useQueryClient();
  const update = useUpdatePlayerProfile();
  const preview = e2eAuthEnabled && profile.id === 'e2e-player';
  const portraits = [...new Set(profile.ownedCardIds)].map(catalogPortrait).filter(card => !!card);
  const selected = catalogPortrait(avatar) ?? profilePortrait(profile).card;
  const selectedSticker = avatarSticker(avatar);
  const selectedName = selectedSticker?.sticker.name ?? selected.name;
  const query = search.trim().toLowerCase();
  const stickers = STICKER_AVATARS.filter(({ set, sticker }) => `${sticker.name} ${catalogCardById[set.cardId]?.name ?? ''}`.toLowerCase().includes(query));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (flight.current) return;
    if (name.trim().length < 2 || name.trim().length > 24) {
      setError('Enter a fighter tag with 2–24 characters.');
      return;
    }
    if (avatar !== profile.avatarKey && !avatarSticker(avatar) && !portraits.some(card => card.catalogId === avatar)) {
      setError('Choose a sticker or one of your owned characters.');
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
    <p className="profile-progress-note">Your name. Your face. Your reputation. Choose any sticker to rep you on your profile and in PvP.</p>
    {preview && <p className="profile-notice">Local preview · Changes last for this session only.</p>}
    <div className="identity-draft-preview" aria-label="Identity draft preview">
      <FighterPortrait cardId={selected.catalogId} avatarKey={avatar} name={selectedName} />
      <div className="identity-draft-preview-info"><span className="id-card__label">Your next look / preview</span><strong className="id-card__name">{name.trim() || 'Your fighter tag'}</strong><small>{selectedName}</small><span className="avatar-preview-note">PROFILE + PVP</span></div>
    </div>
    <div className="panel-section">
      <label htmlFor="fighter-tag" className="panel-section-title">Fighter tag (max 24)</label>
      <input autoFocus id="fighter-tag" className="paper-input" value={name} maxLength={24} autoComplete="nickname"
        disabled={busy} onChange={event => { setName(event.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'identity-error' : undefined} />
    </div>
    <fieldset className="panel-section" disabled={busy}>
      <legend className="panel-section-title">Choose your avatar</legend>
      {!catalogPortrait(avatar) && !selectedSticker && <p className="profile-notice">Your saved portrait is unavailable. Keep it with a name-only edit, or choose an avatar below.</p>}
      <div className="avatar-toolbar">
        <div className="avatar-kind" role="group" aria-label="Avatar type">
          <button type="button" aria-pressed={avatarTab === 'stickers'} onClick={() => setAvatarTab('stickers')}>Stickers <small>{STICKER_AVATARS.length}</small></button>
          <button type="button" aria-pressed={avatarTab === 'characters'} onClick={() => setAvatarTab('characters')}>Characters <small>{portraits.length}</small></button>
        </div>
        <label className="avatar-search"><span className="sr-only">Search avatars</span><input type="search" className="paper-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find your energy…" /></label>
      </div>
      <p className="avatar-help">{avatarTab === 'stickers' ? 'Every sticker is free to use as your avatar. Pick your favorite.' : 'Portraits from your character collection.'}</p>
      <div className="avatar-grid">
        {avatarTab === 'stickers' ? stickers.map(({ sticker }) => <button key={sticker.id} className="avatar-choice avatar-choice--sticker" type="button"
          aria-label={sticker.name} aria-pressed={avatar === stickerAvatarKey(sticker.id)} onClick={() => { setAvatar(stickerAvatarKey(sticker.id)); setError(''); }}>
          <FighterPortrait avatarKey={stickerAvatarKey(sticker.id)} name={sticker.name} decorative /><span>{sticker.name}</span>
          {avatar === stickerAvatarKey(sticker.id) && <b className="avatar-picked" aria-hidden="true">✓</b>}
        </button>) : portraits.filter(card => card.name.toLowerCase().includes(query)).map(card => <button key={card.catalogId} className="avatar-choice" type="button"
          aria-label={card.name} aria-pressed={avatar === card.catalogId} onClick={() => { setAvatar(card.catalogId); setError(''); }}>
          <FighterPortrait cardId={card.catalogId} name={card.name} decorative /><span>{card.name}</span>
        </button>)}
      </div>
      {avatarTab === 'stickers' && !stickers.length && <p className="profile-notice">No stickers match “{search}”. Try another name.</p>}
      {avatarTab === 'characters' && !portraits.length && <p>No character portraits unlocked yet. You can still choose any sticker.</p>}
    </fieldset>
    {error && <p id="identity-error" role="alert" className="profile-notice profile-notice--error">{error}</p>}
    <div className="fighter-id-actions identity-save-bar">
      <button className="street-sign-btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</button>
      <button className="street-sign-btn street-sign-btn--secondary" disabled={busy} type="button" onClick={() => onClose()}>Cancel</button>
    </div>
  </form>;
}
