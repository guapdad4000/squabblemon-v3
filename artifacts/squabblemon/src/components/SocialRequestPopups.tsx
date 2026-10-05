import { useEffect, useRef, useState } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Swords, UserPlus, X } from 'lucide-react';
import { useOptionalSocial } from '../lib/social';
import { starterRecipes, validateSavedDeck } from '../data';
import { usePersistentDeckSelection } from '../lib/deckSelection';
import { isBattleActive } from '../lib/imageWarmup';
import { CompactDeckPicker } from './CompactDeckPicker';
import { FighterPortrait } from './profile/FighterPortrait';
import { getAssetUrl } from '../lib/assets';
import { socialError } from './social/format';
import '../styles/social-request-popups.css';

export const SOCIAL_POPUP_EVENT = 'squabblemon:open-social-request';

export function SocialRequestPopups({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const social = useOptionalSocial();
  const [, navigate] = useLocation();
  const profile = bootstrap.profile;
  const key = `squabblemon:social-popups:${profile.id}`;
  const [shown, setShown] = useState<string[]>(() => { try { const ids = JSON.parse(sessionStorage.getItem(key) ?? '[]'); return Array.isArray(ids) ? ids : []; } catch { return []; } });
  const [forced, setForced] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const saved = profile.savedDecks.filter(deck => validateSavedDeck(deck.cardIds, profile.ownedCardIds, deck.heroCardId).valid);
  const crews = [...saved.map(deck => ({ ...deck, heroCardId: deck.heroCardId! })), ...starterRecipes.filter(deck => !saved.some(item => item.id === deck.id) && validateSavedDeck(deck.catalogCardIds, profile.ownedCardIds, deck.hero).valid).map(deck => ({ id: deck.id, name: deck.name, heroCardId: deck.hero, cardIds: deck.catalogCardIds }))];
  const [deckId, selectDeck] = usePersistentDeckSelection(profile.id, crews.map(deck => deck.id));
  const candidates = [
    ...(social?.query.data?.incomingRequests ?? []).map(item => ({ id: `friend:${item.id}`, kind: 'friend' as const, item })),
    ...(social?.query.data?.invitations ?? []).filter(item => item.direction === 'incoming' && item.status === 'pending' && Date.parse(item.expiresAt) > now).map(item => ({ id: `fade:${item.id}`, kind: 'fade' as const, item })),
  ];
  const active = candidates.find(item => item.id === forced) ?? candidates.find(item => !shown.includes(item.id));
  const activeId = active?.id;
  useEffect(() => {
    const update = () => {
      setNow(Date.now());
      const anotherDialog = [...document.querySelectorAll('dialog[open], [role="dialog"][data-state="open"]')].some(node => node !== dialog.current);
      const pull = document.querySelector('.gacha-stage[data-phase]:not([data-phase="idle"])');
      setAvailable(document.visibilityState === 'visible' && !isBattleActive() && !anotherDialog && !pull);
    };
    const timer = window.setInterval(update, 1000);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'data-state', 'data-phase'] });
    const open = (event: Event) => setForced((event as CustomEvent<string>).detail);
    window.addEventListener(SOCIAL_POPUP_EVENT, open);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { clearInterval(timer); observer.disconnect(); window.removeEventListener(SOCIAL_POPUP_EVENT, open); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => { setError(null); }, [activeId]);
  useEffect(() => {
    if (activeId && available) { if (!dialog.current?.open) dialog.current?.showModal(); }
    else if (!working) dialog.current?.close();
  }, [activeId, available, working]);
  function later() {
    if (!active || working) return;
    const ids = [...new Set([...shown, active.id])];
    setShown(ids); setForced(null); setError(null);
    try { sessionStorage.setItem(key, JSON.stringify(ids)); } catch {}
    dialog.current?.close();
  }
  async function answer(action: 'accept' | 'decline') {
    if (!active || !social || working || social.busy) return;
    setWorking(true); setError(null);
    try {
      if (active.kind === 'friend') await social.respondRequest(active.item.id, action);
      else {
        const result = await social.respondInvitation(active.item.id, action, action === 'accept' ? deckId : undefined);
        if (action === 'accept') {
          if (result.status !== 'accepted') throw new Error(`This invitation is ${result.status}.`);
          navigate(`/game/online/${result.roomCode}`);
        }
      }
      const ids = [...new Set([...shown, active.id])]; setShown(ids); setForced(null);
      try { sessionStorage.setItem(key, JSON.stringify(ids)); } catch {}
    } catch (reason) { setError(socialError(reason)); }
    finally { setWorking(false); }
  }
  const fade = active?.kind === 'fade';
  return <dialog ref={dialog} className="social-request-popup" data-kind={fade ? 'fade' : 'friend'} aria-labelledby="social-request-title" onCancel={event => { event.preventDefault(); later(); }}>
    {active && <>
      <button className="social-request-popup__close" aria-label="Remind me later" disabled={working} onClick={later}><X size={20} /></button>
      {!fade && <header className="social-request-popup__fadebook-masthead"><img src={getAssetUrl('assets/homies/fadebook-logo-transparent.png')} alt="Fadebook" /><span>FRIEND REQUEST</span></header>}
      {fade && <span className="social-request-popup__eyebrow">{fade ? <Swords size={18} /> : <UserPlus size={18} />}{fade ? 'FRIENDLY FADE' : 'FRIEND REQUEST'}</span>}
      {!fade && <div className="social-request-popup__fadebook-profile">
        <div className="social-request-popup__fadebook-cover" aria-hidden="true" />
        <div className="social-request-popup__fadebook-identity">
          <div className="social-request-popup__fadebook-avatar"><FighterPortrait avatarKey={active.item.player.avatarKey} name={active.item.player.displayName} decorative /></div>
          <div><h2 id="social-request-title">A new homie?</h2><strong>{active.item.player.displayName}</strong><span className="social-request-popup__handle">{active.item.player.username ? `@${active.item.player.username}` : active.item.player.friendCode}</span></div>
        </div>
        <span className="social-request-popup__fadebook-status"><UserPlus size={13} /> Wants to join your homies</span>
      </div>}
      {fade && <div className="social-request-popup__poster">
      <div className="social-request-popup__headline">
      <span className="social-request-popup__kicker">{fade ? 'THE CHALLENGE IS IN' : 'GOOD COMPANY. MORE SQUABBLES.'}</span>
      <h2 id="social-request-title">{fade ? 'You got called out.' : 'A new homie?'}</h2>
      <span className="social-request-popup__stamp" aria-hidden="true">{fade ? 'LET’S RUN IT' : 'LINK UP'}</span>
      </div>
      <div className="social-request-popup__portrait"><FighterPortrait avatarKey={active.item.player.avatarKey} name={active.item.player.displayName} decorative /><span>{active.item.player.friendCode}</span></div>
      </div>}
      <div className="social-request-popup__body">
      {fade ? <p><strong>{active.item.player.displayName}</strong> wants to run a friendly match.</p> : <p className="social-request-popup__fadebook-note">Add them to your homies to keep in touch and run Friendly Fades.</p>}
      {fade && <><small className="social-request-popup__expiry">Invite expires in {Math.max(1, Math.ceil((Date.parse(active.item.expiresAt) - now) / 60000))} min</small><span className="social-request-popup__crew-label">BRING YOUR CREW</span><CompactDeckPicker decks={crews} selectedId={deckId} onSelect={selectDeck} disabled={working} label="Bring your crew" />{!crews.length && <button onClick={() => { later(); navigate('/game/decks'); }}>Build a crew</button>}</>}
      {error && <p className="social-request-popup__error" role="alert">{error}</p>}
      <div className="social-request-popup__actions"><button disabled={working || social?.busy} onClick={() => void answer('decline')}>Decline</button><button className="social-request-popup__accept" disabled={working || social?.busy || (fade && !deckId)} onClick={() => void answer('accept')}>{working ? 'One sec…' : fade ? 'Accept fade' : 'Add homie'}</button></div>
      <button className="social-request-popup__later" disabled={working} onClick={later}>Later · keep it in my inbox</button>
      </div>
    </>}
  </dialog>;
}
