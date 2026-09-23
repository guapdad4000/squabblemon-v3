import { useEffect, useRef, useState } from 'react';
import { LayeredVenue } from '../../components/venue/LayeredVenue';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowUpRight, Check } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';
import { CORNER_OFFERS, checkoutDemo, readDemoWallet, type StoreOffer } from '../../lib/cornerStore';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { rewardReceipts } from '../../lib/rewardReceipts';
import { loadFeedbackPreferences } from '../../battleFeedback';
import { playVoiceLine, stopSoundEffect } from '../../lib/sfx';
import '../../styles/ui-polish.css';

export function CornerStore({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const key = 'squabblemon:corner-demo:v1:' + bootstrap.profile.id;
  const [wallet, setWallet] = useState(() => readDemoWallet(localStorage, key));
  const [department, setDepartment] = useState<'clout' | 'pack' | 'style' | 'shards'>('clout');
  const [selected, setSelected] = useState<StoreOffer | null>(null);
  const [error, setError] = useState('');
  const transaction = useRef('');
  const lock = useRef(false);
  const welcomeVoice = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    welcomeVoice.current = playVoiceLine('market-welcome', loadFeedbackPreferences().audioEnabled);
    return () => stopSoundEffect(welcomeVoice.current);
  }, []);
  const owned = (offer: StoreOffer) => offer.kind === 'style' && wallet.receipts.some(r => r.offerId === offer.id);
  function choose(offer: StoreOffer) { transaction.current = crypto.randomUUID(); setError(''); setSelected(offer); }
  function purchase() {
    if (!selected || lock.current) return;
    lock.current = true;
    try {
      const next = checkoutDemo(readDemoWallet(localStorage, key), selected.id, transaction.current, new Date().toISOString());
      localStorage.setItem(key, JSON.stringify(next));
      setWallet(next); setSelected(null);
      rewardReceipts.show({ id: transaction.current, title: selected.kind === 'clout' ? 'Clout in the bag' : 'Fresh from the corner', preview: true,
        items: [{ label: selected.name, amount: selected.amount, image: getAssetUrl(selected.art) }] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this demo purchase.'); }
    finally { lock.current = false; }
  }
  return <main className="corner-store">
    <LayeredVenue scene="fade-market" />
    <header className="corner-store__heading"><span>OPEN LATE · GOOD COMPANY</span><h1>Fade<br /><em>Market.</em></h1><p>A little Clout. A new look. Your next favorite.</p></header>
    <section className="corner-store__counter">
      <div className="corner-store__wallet"><img src={getAssetUrl('assets/rewards/clout-token.webp')} alt="" /><div><small>DEMO CLOUT</small><strong><AnimatedNumber value={wallet.clout} /></strong></div><span>Account Clout<br /><b>{bootstrap.profile.softCurrency.toLocaleString()}</b></span></div>
      <p className="corner-store__notice">Store preview · No real charges. Demo purchases stay on this device and do not change your account. Prices are placeholders.</p>
      <nav className="corner-store__departments" aria-label="Fade Market shelves">{(['clout', 'pack', 'style', 'shards'] as const).map(d => <button key={d} aria-pressed={department === d} onClick={() => setDepartment(d)}>{{ clout: 'Clout', pack: 'Packs', style: 'Card styles', shards: 'Shards' }[d]}</button>)}</nav>
      <div className="corner-store__products">{CORNER_OFFERS.filter(o => o.kind === department).map(offer => <motion.article key={offer.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="corner-product">
        <img src={getAssetUrl(offer.art)} alt="" /><div><small>{offer.kind === 'pack' ? 'SHOWCASE PACK · DEMO CONTENTS' : offer.kind === 'style' ? 'ARTWORK ONLY' : 'MARKET PICK'}</small><h2>{offer.name}</h2><p>{offer.description}</p>
        {offer.cards && <p className="corner-product__contents">{offer.cards.length} {offer.kind === 'style' ? 'alternate illustration' : 'featured cards'} · View contents at checkout</p>}
        <button disabled={owned(offer)} onClick={() => choose(offer)}>{owned(offer) ? <><Check size={16} />On your demo shelf</> : <>{offer.price ? offer.price + ' · Demo' : offer.cost + ' Clout'}<ArrowUpRight size={16} /></>}</button></div>
      </motion.article>)}</div>
      {wallet.receipts.length > 0 && <details className="corner-store__shelf"><summary><ShoppingBag size={17} />Your demo shelf · {wallet.receipts.length} purchases</summary><ul>{[...wallet.receipts].reverse().map(r => { const offer = CORNER_OFFERS.find(o => o.id === r.offerId)!; return <li key={r.id}><img src={getAssetUrl(offer.art)} alt="" /><div><strong>{offer.name}</strong><small>{offer.cards?.map(id => id.replaceAll('-', ' ')).join(' · ') ?? (offer.amount + (offer.kind === 'clout' ? ' Clout' : ' Style Shards'))}</small></div><span>Received</span></li>; })}</ul></details>}
    </section>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="corner-checkout">
      <DialogTitle>{selected?.name}</DialogTitle><DialogDescription>Simulated checkout. No payment information or real money is collected.</DialogDescription>
      {selected && <><img className="corner-checkout__art" src={getAssetUrl(selected.art)} alt="" /><p>{selected.description}</p>
        {selected.cards && <div className="corner-checkout__contents">{selected.cards.map(id => <figure key={id}><img src={getAssetUrl('assets/characters/' + (selected.variant ? id + '-alternate' : id) + '.webp')} alt="" /><figcaption>{id.replaceAll('-', ' ')}</figcaption></figure>)}</div>}
        <div className="corner-checkout__total"><span>{selected.kind === 'clout' ? 'Demo price' : 'Total'}</span><strong>{selected.price ?? selected.cost + ' Clout'}</strong></div>
        {selected.kind !== 'clout' && <p>Demo balance: {wallet.clout} Clout · After purchase: {Math.max(0, wallet.clout - selected.cost)} Clout</p>}
        {error && <p role="alert">{error}</p>}
        <button className="studio-action studio-action--gold" disabled={wallet.clout < selected.cost || owned(selected)} onClick={purchase}>Complete demo purchase</button>
        {wallet.clout < selected.cost && <button className="studio-text-action" onClick={() => { setSelected(null); setDepartment('clout'); }}>Add demo Clout first →</button>}
        <small>Account rewards will require verified checkout when payments launch.</small></>}
    </DialogContent></Dialog>
  </main>;
}
