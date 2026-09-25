import { useViewMemory } from '../../lib/navigationMemory';
import { useExtrasNotificationsSeen } from '../../lib/useExtrasNotificationsSeen';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { CHARACTER_STYLE_OFFERS, CHARACTER_STYLE_ROLLOUT, ownsStyle, styleSetFor, stickerById, validateCosmeticLoadout, type CosmeticLoadout, type CharacterStyleOfferId } from '@workspace/squabblemon-engine/cosmetics';
import { planShopPurchase, type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { catalogCardById, CARD_RARITY_DEFINITIONS } from '../../data';
import { CharacterBanner, CharacterSticker } from '../../components/CharacterBanner';
import { CharacterUnlock } from '../../components/CharacterUnlock';
import { CardView } from '../../components/CardView';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { SpecialMove } from '../../components/SpecialMove';
import { resolveSpecialMove } from '../../specialMoves';
import { getAssetUrl } from '../../lib/assets';
import { e2eAuthEnabled } from '../../lib/auth';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../../lib/shopJournal';
import '../../styles/character-styles.css';

export function CharacterStyles({ bootstrap, cardId = 'kyle' }: { bootstrap: PlayerBootstrap; cardId?: string }) {
  const { profile } = bootstrap;
  const set = styleSetFor(cardId), card = catalogCardById[cardId];
  useExtrasNotificationsSeen(cardId, Boolean(set && card));
  const client = useQueryClient();
  const [tab, setTab] = useViewMemory<'stickers' | 'banner' | 'scene'>(`style-tab:${profile.id}:${cardId}`, 'stickers');
  const [finish, setFinish] = useState<'base' | 'silver'>('base');
  const search = useSearch();
  useEffect(() => { const params = new URLSearchParams(search); const requested = params.get('tab'); if (requested === 'stickers' || requested === 'banner' || requested === 'scene') setTab(requested); setFinish(params.get('finish') === 'silver' ? 'silver' : 'base'); }, [search]);
  const [stickers, setStickers] = useState<string[]>(profile.settings.cosmetics?.stickers ?? []);
  const [pending, setPending] = useState<ShopRequest | null>(() => readShopRequest(sessionStorage, profile.id));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [playing, setPlaying] = useState(false), [reveal, setReveal] = useState(false);
  const flight = useRef(false);
  const preview = e2eAuthEnabled && profile.id === 'e2e-player';
  if (!set || !card) return <main className="character-styles"><h1>This collection is still in the works.</h1></main>;
  const owned = profile.ownedCardIds.includes(cardId);
  const equipped = profile.settings.cosmetics ?? {};
  const offerId: CharacterStyleOfferId = tab === 'stickers' ? 'character-stickers' : tab === 'scene' ? 'character-backdrop' : 'character-banner-finish';
  const offer = CHARACTER_STYLE_OFFERS.find(item => item.id === offerId)!;
  const unlocked = ownsStyle(profile, cardId, offerId);
  const canEquip = owned && (tab === 'banner' && finish === 'base' || unlocked);
  const clip = resolveSpecialMove(card.engineId);
  const alreadyEquipped = tab === 'scene' ? equipped.cardBackgrounds?.[cardId] === 'blue-hour' : tab === 'banner' ? equipped.bannerCardId === cardId && (equipped.bannerFinish ?? 'base') === finish : equipped.bannerCardId === cardId && JSON.stringify(equipped.stickers ?? []) === JSON.stringify(stickers);
  async function applyBootstrap(next: PlayerBootstrap) {
    await client.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    client.setQueryData(getGetPlayerBootstrapQueryKey(), next);
  }
  async function buy() {
    if (flight.current) return; flight.current = true; setBusy(true); setMessage('');
    try {
      const request = pending ?? { idempotencyKey: crypto.randomUUID(), itemId: offerId, cardId };
      saveShopRequest(sessionStorage, profile.id, request); setPending(request);
      const result = preview ? (() => { const planned = planShopPurchase(profile, request); return { bootstrap: { ...bootstrap, profile: { ...profile, ...planned.wallet } }, receipt: planned.receipt }; })() : await customFetch<{ bootstrap: PlayerBootstrap; receipt: { summary: string } }>('/api/player/shop/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      await applyBootstrap(result.bootstrap);
      clearShopRequest(sessionStorage, profile.id); setPending(null); setMessage(result.receipt.summary);
    } catch (error) {
      if (error instanceof ApiError && [400,409].includes(error.status)) {
        clearShopRequest(sessionStorage, profile.id); setPending(null);
        setMessage((error.data as { error?: string })?.error ?? 'This purchase is unavailable.');
        void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      } else setMessage('Purchase not confirmed. Recover it below; the same request cannot charge twice.');
    } finally { flight.current = false; setBusy(false); }
  }
  async function save(remove = false) {
    if (flight.current || pending) return; flight.current = true; setBusy(true); setMessage('');
    try {
      const next: CosmeticLoadout = { ...equipped, cardBackgrounds: { ...equipped.cardBackgrounds } };
      if (tab === 'scene') { if (remove) delete next.cardBackgrounds![cardId]; else next.cardBackgrounds![cardId] = 'blue-hour'; }
      else if (remove) { next.bannerCardId = null; next.bannerFinish = 'base'; next.stickers = []; }
      else { next.bannerCardId = cardId; next.bannerFinish = tab === 'banner' ? finish : equipped.bannerCardId === cardId ? equipped.bannerFinish ?? 'base' : 'base'; next.stickers = stickers; }
      const invalid = validateCosmeticLoadout(profile, next); if (invalid) { setMessage(invalid); return; }
      const result = preview ? { ...bootstrap, profile: { ...profile, settings: { ...profile.settings, cosmetics: next } } } : await customFetch<PlayerBootstrap>('/api/player/cosmetics', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      await applyBootstrap(result); setMessage(remove ? 'Original look restored.' : 'Saved to your collection.');
    } catch (error) { setMessage(error instanceof ApiError ? (error.data as { error?: string })?.error ?? 'Could not save. Please retry.' : 'Could not save. Please retry.'); }
    finally { flight.current = false; setBusy(false); }
  }
  function toggleSticker(id: string) { setStickers(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current); }
  return <main className="character-styles" data-testid="character-styles">
    <header className="character-styles__header"><div><p className="style-kicker">SIGNATURE COLLECTION / {set.series}</p><h1>{card.name}<i>Make it yours.</i></h1></div><div className="style-wallet"><GameGlyph name="shards"/><strong>{profile.styleShards.toLocaleString()}</strong><span>Style Shards</span></div></header>
    {preview && <p className="style-notice">Local preview · Purchases and selections stay in this preview.</p>}
    <CharacterBanner cardId={cardId} finish={tab === 'banner' ? finish : equipped.bannerCardId === cardId ? equipped.bannerFinish : 'base'} stickers={stickers} displayName={profile.displayName} />
    <div className="character-styles__subline"><span>{set.title}</span><div><button className="style-link" type="button" onClick={() => setReveal(value => !value)}>{reveal ? 'Close reveal' : 'Replay unlock reveal'}</button>{clip && <button type="button" className="style-link" disabled={!owned} onClick={() => setPlaying(value => !value)}>{playing ? 'Close special' : 'Watch special'}</button>}</div></div>
    {playing && clip && <div className="style-special"><SpecialMove clip={clip}/><span>{clip.label}</span></div>}
    {reveal && <section className="style-reveal-preview" aria-label="Character unlock preview"><CharacterUnlock key={cardId} cardId={cardId}><div className="style-reveal-card"><CardView card={card} fillContainer presentationOnly disableLayout /></div></CharacterUnlock></section>}
    <nav className="style-tabs" aria-label="Character cosmetics">{(['stickers','banner','scene'] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} disabled={busy || !!pending} onClick={() => { setTab(value); setMessage(''); }}>{value === 'stickers' ? '01 / Sticker pack' : value === 'banner' ? '02 / Character banner' : '03 / Card scene'}</button>)}</nav>
    {tab === 'stickers' && stickers.length > 0 && <section className="style-sticker-mix" aria-label="Your banner stickers"><div><strong>Your banner mix</strong><p>Mix any owned packs. Tap a sticker to free a slot.</p></div>{stickers.map(id => <button key={id} type="button" disabled={busy || !!pending} onClick={() => toggleSticker(id)} aria-label={'Remove ' + (stickerById(id)?.sticker.name ?? 'sticker')}><CharacterSticker id={id} decorative/><span aria-hidden="true">×</span></button>)}</section>}
    <div className="style-workbench"><section data-notification-id={tab === 'banner' && finish === 'base' ? `banner:${cardId}` : `style:style:${cardId}:${tab === 'stickers' ? 'stickers' : tab === 'scene' ? 'backdrop' : 'banner-finish'}`} className="style-workbench__art" aria-label="Cosmetic preview">
      {tab === 'stickers' ? <><div className="style-sticker-sheet">{set.stickers.map((sticker, index) => <button type="button" key={sticker.id} disabled={!unlocked || busy || !!pending || (!stickers.includes(sticker.id) && stickers.length >= 3)} aria-pressed={stickers.includes(sticker.id)} aria-label={sticker.name} onClick={() => toggleSticker(sticker.id)}><CharacterSticker id={sticker.id} decorative/><span>{sticker.name}</span><small>{stickers.includes(sticker.id) ? 'ON YOUR BANNER' : 'DIE-CUT / ' + String(index + 1).padStart(2,'0')}</small></button>)}</div><p>{set.stickers.length} designs. One complete pack. {unlocked ? stickers.length + ' / 3 banner slots filled.' : 'Every sticker shown is included.'}</p></> : tab === 'banner' ? <div className="style-banner-options"><CharacterBanner cardId={cardId} finish={finish} compact/><div>{(['base','silver'] as const).map(value => <button type="button" key={value} className="style-button" aria-pressed={finish === value} onClick={() => setFinish(value)}>{value === 'base' ? set.sceneName + ' · Included' : 'Silver Lining · 120 shards'}</button>)}</div><p>Your character banner for your profile and inventory bag.</p></div> : <div className="style-card-scene"><div><CardView card={card} backgroundUrl={getAssetUrl(set.background)} fillContainer presentationOnly disableLayout /></div><p>{set.sceneName}<br/><small>Preview on your actual card.</small></p></div>}
    </section><aside className="style-receipt"><span className="style-kicker">{tab === 'stickers' ? 'THE WHOLE PACK' : tab === 'banner' && finish === 'base' ? 'PART OF YOUR CHARACTER' : 'THE FINISHING TOUCH'}</span><h2>{tab === 'banner' && finish === 'base' ? set.sceneName + ' banner' : tab === 'scene' ? set.sceneName + ' card scene' : offer.name}</h2><p>{tab === 'banner' && finish === 'base' ? 'Your character. Your name. Your favorite stickers. Included when ' + card.name + ' joins your gang.' : tab === 'scene' ? set.sceneDescription : tab === 'stickers' ? `${set.stickers.length} stickers included. Choose up to three for your banner.` : offer.description}</p>
      <ul>{(tab === 'stickers' ? set.stickers.map(sticker => sticker.name) : tab === 'banner' ? ['Original character artwork','Mix up to three owned stickers','Respects reduced motion'] : [set.sceneName + ' environment','Works with your foil finish','Collection, details and your cards']).map(text => <li key={text}>{text}</li>)}</ul>
      <div className="style-receipt__total"><span>{canEquip ? 'In your collection' : 'One-time unlock'}</span><strong>{tab === 'banner' && finish === 'base' ? 'INCLUDED' : unlocked ? 'OWNED' : offer.price + ' SHARDS'}</strong></div>
      {!owned ? <p className="style-notice">Unlock {card.name} to collect these cosmetics.</p> : null}
      {pending ? <><p role="status">A purchase is awaiting confirmation: {pending.itemId.replace('character-','').replaceAll('-',' ')}.</p><button type="button" className="style-button style-button--primary" disabled={busy} onClick={() => void buy()}>Recover purchase</button></> : canEquip ? <><button type="button" className="style-button style-button--primary" disabled={busy || alreadyEquipped} onClick={() => void save()}>{alreadyEquipped ? 'Equipped' : tab === 'stickers' ? 'Save banner stickers' : tab === 'scene' ? 'Equip card scene' : 'Equip banner'}</button>{(tab === 'scene' ? equipped.cardBackgrounds?.[cardId] : equipped.bannerCardId === cardId) && <button className="style-link" type="button" disabled={busy} onClick={() => void save(true)}>{tab === 'scene' ? 'Restore original card scene' : 'Remove profile banner'}</button>}</> : <button type="button" className="style-button style-button--primary" disabled={!owned || busy || profile.styleShards < offer.price} onClick={() => void buy()}>Unlock for {offer.price} Style Shards</button>}
      {owned && !canEquip && profile.styleShards < offer.price && <p className="style-notice">{offer.price - profile.styleShards} more shards to go. Extra character copies from packs become Style Shards.</p>}
      <small className="style-cosmetic-note">Cosmetic only · Permanent unlock · No random contents</small><p role="status" className="style-status">{busy ? 'Saving…' : message}</p>
    </aside></div>
    {set.deckCover && <section className="style-deck-cover" aria-label={card.name + ' deck cover'}><img src={getAssetUrl(set.deckCover)} alt={card.name + ' deck cover'} loading="lazy" decoding="async" width={768} height={1152}/><div><span className="style-kicker">SIGNATURE DECK COVER</span><h2>Lead with {card.name}.</h2><p>This artwork appears on your deck box when {card.name} is its cover character.</p><Link className="style-link" href="/game/decks">Open your decks →</Link></div></section>}
    <Link className="style-link style-all-link" href="/game/style">Browse all signature collections →</Link><details className="style-rollout"><summary>Up next · Mythicals, Legendaries, Super Rares</summary><p>More signature collections are in development.</p><div>{CHARACTER_STYLE_ROLLOUT.filter(item => !item.available).map(item => <span key={item.cardId}><strong>{item.name}</strong><small>{CARD_RARITY_DEFINITIONS[item.rarity].label} · In development</small></span>)}</div></details>
  </main>;
}
