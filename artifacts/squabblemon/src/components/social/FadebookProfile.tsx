import { useState, type FormEvent } from 'react';
import type { SocialState } from '@workspace/api-client-react';
import { AtSign, Check, Copy, Pencil, Share2, X } from 'lucide-react';
import { useSocial } from '../../lib/social';
import { basePath } from '../../lib/routing';
import { FighterPortrait } from '../profile/FighterPortrait';
import { friendLink, normalizeHandle, shareOrCopy, socialError, USERNAME_PATTERN } from './format';

export const FADEBOOK_LOGO = `${basePath}/assets/homies/fadebook-logo-transparent.png`;

export function FadebookMasthead({ connected }: { connected: boolean }) {
  return <header className="fb-masthead">
    <img className="fb-masthead__logo" src={FADEBOOK_LOGO} alt="Fadebook" draggable={false} data-testid="img-fadebook-logo" />
    <span className="fb-conn" data-online={connected || undefined} data-testid="status-connection">
      <i aria-hidden="true" />{connected ? 'Online' : 'Reconnecting'}
    </span>
  </header>;
}

export function FadebookProfile({ state, homieCount }: { state: SocialState; homieCount: number }) {
  const social = useSocial();
  const self = state.self;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(self.username);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [done, setDone] = useState<'handle' | 'link' | null>(null);

  async function copy(kind: 'handle' | 'link') {
    const text = kind === 'handle' ? `@${self.username}` : friendLink(self.friendCode);
    const result = await shareOrCopy(text, kind === 'link' ? 'Add me on Squabblemon' : undefined);
    if (result) { setDone(kind); setManual(null); window.setTimeout(() => setDone(c => c === kind ? null : c), 2400); }
    else setManual(text);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || social.busy) return;
    const next = normalizeHandle(draft);
    if (!USERNAME_PATTERN.test(next)) { setError('Usernames are 3 to 24 letters, numbers or underscores.'); return; }
    if (next === self.username) { setEditing(false); return; }
    setSaving(true); setError(null);
    try { await social.updateUsername(next); setEditing(false); setNotice(`You are now @${next}.`); }
    catch (reason) { setError(socialError(reason, 'That username could not be saved. It may already be taken.')); }
    finally { setSaving(false); }
  }

  return <section className="fb-profile" aria-labelledby="fb-self-name">
    <div className="fb-profile__banner" aria-hidden="true" />
    <div className="fb-profile__body">
      <span className="fb-profile__portrait"><FighterPortrait avatarKey={self.avatarKey} name={self.displayName} decorative /></span>
      <div className="fb-profile__id">
        <h1 id="fb-self-name" data-testid="text-self-name">{self.displayName}</h1>
        {!editing ? <div className="fb-profile__handle">
          <span data-testid="text-username">@{self.username}</span>
          <button type="button" className="fb-chip" onClick={() => void copy('handle')} data-testid="button-copy-username">
            {done === 'handle' ? <Check size={14} /> : <Copy size={14} />}{done === 'handle' ? 'Copied' : 'Copy'}</button>
          <button type="button" className="fb-chip" disabled={social.busy} onClick={() => { setDraft(self.username); setError(null); setNotice(null); setEditing(true); }} data-testid="button-edit-username">
            <Pencil size={14} />Change</button>
        </div> : <form className="fb-handle-form" onSubmit={save} noValidate>
          <label htmlFor="fb-username">New username</label>
          <div className="fb-handle-form__row">
            <span className="fb-input-wrap"><AtSign size={15} aria-hidden="true" />
              <input id="fb-username" className="fb-input" value={draft} disabled={saving || social.busy} maxLength={25} autoComplete="off" spellCheck={false} autoFocus
                aria-invalid={!!error} aria-describedby="fb-username-help" onChange={e => { setDraft(e.target.value); setError(null); }} data-testid="input-username" /></span>
            <button className="sq-btn sq-btn--primary" disabled={saving || social.busy} data-testid="button-save-username">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="sq-btn sq-btn--ghost" disabled={saving || social.busy} onClick={() => setEditing(false)} aria-label="Cancel username change" data-testid="button-cancel-username"><X size={16} /></button>
          </div>
          <small id="fb-username-help">3 to 24 letters, numbers or underscores. Your display name stays the same.</small>
        </form>}
        {error && <p className="fb-err" role="alert">{error}</p>}
        {notice && <p className="fb-ok" role="status">{notice}</p>}
      </div>
      <dl className="fb-profile__stats">
        <div><dt>Homies</dt><dd data-testid="text-homie-count">{homieCount}</dd></div>
        <div><dt>Waiting</dt><dd>{state.incomingRequests.length}</dd></div>
      </dl>
      <div className="fb-profile__share">
        <button type="button" className="sq-btn sq-btn--primary" onClick={() => void copy('link')} data-testid="button-share-link">
          {done === 'link' ? <Check size={16} /> : <Share2 size={16} />}{done === 'link' ? 'Link ready' : 'Share my Fadebook link'}</button>
      </div>
    </div>
    {manual && <label className="fb-manual">
      <span>Copying is blocked here. Select and send this:</span>
      <input readOnly value={manual} onFocus={e => e.currentTarget.select()} autoFocus data-testid="input-manual-share" />
    </label>}
  </section>;
}
