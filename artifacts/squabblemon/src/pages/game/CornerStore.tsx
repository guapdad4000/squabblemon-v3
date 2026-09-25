import { ItemDot, useNotifications } from '../../components/Notifications';
import { useEffect, useRef, useState } from 'react';
import { LayeredVenue } from '../../components/venue/LayeredVenue';
import {
  type PlayerBootstrap,
  useGetPaymentCatalog,
  useCreatePaymentCheckout,
  useGetPaymentOrder,
  useListPaymentOrders,
  getGetPaymentCatalogQueryKey,
  getGetPaymentOrderQueryKey,
  getGetPlayerBootstrapQueryKey,
  getListPaymentOrdersQueryKey,
  ApiError,
  type PaymentCheckoutInput,
  type PaymentOffer,
  type PaymentOrder
} from '@workspace/api-client-react';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowUpRight, RefreshCw, ArrowRight, CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';
import { CORNER_OFFERS, type StoreOffer, getOrCreatePendingCheckout, clearPendingCheckout, formatCurrency, isTerminalOrderStatus, isValidOrderId, orderStatusDetail, safeHttpsUrl, safeStripeCheckoutUrl } from '../../lib/cornerStore';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { loadFeedbackPreferences } from '../../battleFeedback';
import { playVoiceLine, stopSoundEffect } from '../../lib/sfx';
import '../../styles/ui-polish.css';
import { useLocation, useSearch } from 'wouter';
import { e2eAuthEnabled } from '../../lib/auth';
import { appPath } from '../../lib/routing';
import { useQueryClient } from '@tanstack/react-query';

const MAX_STATUS_ATTEMPTS = 15;

type TaxAwareCatalog = {
  taxMode?: 'none' | 'automatic';
};

type TaxAwareOrder = {
  taxMode?: 'none' | 'automatic';
  taxAmountMinor?: number | null;
  totalAmountMinor?: number | null;
};

function catalogPriceLabel(amountMinor: number, currency: string, catalog: TaxAwareCatalog | undefined) {
  const base = formatCurrency(amountMinor, currency);
  if (catalog?.taxMode === 'automatic') return `${base} + applicable tax`;
  if (catalog?.taxMode === 'none') return base;
  return `${base} · final shown by Stripe`;
}

function OrderAmount({ order, compact = false }: { order: PaymentOrder; compact?: boolean }) {
  const taxOrder = order as PaymentOrder & TaxAwareOrder;
  const base = formatCurrency(order.amountMinor, order.currency);
  const paymentConfirmed = order.status === 'fulfilled' || order.status === 'refunded' || order.status === 'disputed';
  const hasConfirmedTotal = paymentConfirmed && typeof taxOrder.totalAmountMinor === 'number';
  const total = hasConfirmedTotal
    ? formatCurrency(taxOrder.totalAmountMinor!, order.currency)
    : paymentConfirmed && taxOrder.taxMode === 'none'
      ? base
      : null;
  const hasConfirmedTax = typeof taxOrder.taxAmountMinor === 'number';
  const unresolvedTotalMessage = order.status === 'pending' || order.status === 'processing'
    ? 'Final total not yet confirmed'
    : 'No completed payment total';

  return (
    <span data-testid={`text-order-amount-${order.id}`} className={compact ? '' : 'block space-y-1'}>
      {total
        ? <>
            <strong className="text-white">{total}</strong>
            <span className={compact ? 'ml-1' : 'block text-white/50'}>
              {compact ? '· ' : ''}Base {base} · {hasConfirmedTax
                ? `Tax ${formatCurrency(taxOrder.taxAmountMinor!, order.currency)}`
                : taxOrder.taxMode === 'none'
                  ? 'No tax (historical quote)'
                  : 'Tax unavailable'}
            </span>
          </>
        : <><strong className="text-white">Base {base}</strong><span className={compact ? 'ml-1' : 'block'}>· {unresolvedTotalMessage}</span></>}
      {order.refundedAmountMinor > 0 && (
        <span data-testid={`text-order-refund-${order.id}`} className={compact ? 'ml-1 text-rose-300' : 'block text-rose-300'}>
          {compact ? '· ' : ''}Refunded {formatCurrency(order.refundedAmountMinor, order.currency)}
        </span>
      )}
    </span>
  );
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.data && typeof error.data === 'object' && 'error' in error.data) {
    const detail = error.data.error;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  return fallback;
}

function isPermanentOrderError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 404);
}

function saveCurrentPathForSignIn() {
  const intended = `${window.location.pathname}${window.location.search}`;
  if (intended.startsWith('/game/')) sessionStorage.setItem('squabblemon_after_sign_in', intended);
}

function OrderStatusModal({ orderId, bootstrap, checkoutEnabled, onClose }: { orderId: string, bootstrap: PlayerBootstrap, checkoutEnabled: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const [attempts, setAttempts] = useState(0);
  const [journalError, setJournalError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const checkoutLinkRef = useRef<HTMLInputElement | null>(null);
  const validOrderId = isValidOrderId(orderId);
  const query = useGetPaymentOrder(validOrderId ? orderId : '', {
    query: {
      enabled: validOrderId,
      queryKey: getGetPaymentOrderQueryKey(orderId),
      retry: false,
      refetchInterval: (query) => {
        const data = query.state.data as PaymentOrder | undefined;
        if (data && isTerminalOrderStatus(data.status)) return false;
        if (isPermanentOrderError(query.state.error) || attempts >= MAX_STATUS_ATTEMPTS) return false;
        return 2000;
      }
    }
  });
  const { data: order, isLoading, error, refetch, dataUpdatedAt, errorUpdatedAt } = query;

  useEffect(() => {
    if (dataUpdatedAt || errorUpdatedAt) setAttempts(value => Math.min(MAX_STATUS_ATTEMPTS, value + 1));
  }, [dataUpdatedAt, errorUpdatedAt]);

  useEffect(() => {
    if (order && isTerminalOrderStatus(order.status)) {
      queryClient.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListPaymentOrdersQueryKey() });
      try {
        clearPendingCheckout(sessionStorage, bootstrap.profile.id, order.offerId);
      } catch {
        setJournalError('The saved checkout reference could not be cleared. Clear site data before starting this purchase again.');
      }
    }
  }, [order?.status, bootstrap.profile.id, order?.offerId, queryClient]);

  const terminal = order && isTerminalOrderStatus(order.status);
  const pollingPaused = !terminal && attempts >= MAX_STATUS_ATTEMPTS;
  const resumeUrl = safeStripeCheckoutUrl(order?.checkoutUrl);
  const authExpired = error instanceof ApiError && error.status === 401;

  async function copyCheckoutLink() {
    if (!resumeUrl) return;
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopyMessage('Secure checkout link copied. Paste it into your browser address bar.');
    } catch {
      checkoutLinkRef.current?.focus();
      checkoutLinkRef.current?.select();
      setCopyMessage('Select and copy the secure link below, then paste it into your browser address bar.');
    }
  }
  
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent data-testid="corner-order-status" className="corner-checkout bg-black border-2 border-white/10 rounded-xl overflow-hidden p-0 max-w-sm">
        <div className="p-6">
          <DialogTitle className="font-display italic uppercase text-2xl text-center mb-1">Order Status</DialogTitle>
          <DialogDescription className="text-center font-sans text-sm text-white/60 mb-6">
            {terminal ? 'Order finalized.' : 'Checking your purchase...'}
          </DialogDescription>
          
          {!validOrderId && <p role="alert" className="text-red-400 py-6 text-center">This purchase reference is invalid.</p>}
          {isLoading && <div className="py-8 flex flex-col items-center"><Loader2 size={32} className="animate-spin text-primary mb-4" /><p className="text-white/70">Contacting market...</p></div>}
          {error && <div className="py-8 flex flex-col items-center"><AlertCircle size={32} className="text-red-500 mb-4" /><p role="alert" className="text-red-400 mb-4 text-center">{errorMessage(error, 'Could not retrieve this purchase.')}</p>{authExpired ? <a href="/sign-in" onClick={saveCurrentPathForSignIn} className="studio-action studio-action--gold text-sm no-underline">Sign in to check purchase</a> : <button onClick={() => { setAttempts(0); void refetch(); }} className="studio-action studio-action--gold text-sm">Check again</button>}</div>}
          
          {order && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                   {order.status === 'fulfilled' ? <CheckCircle size={48} className="text-green-500" /> : 
                    order.status === 'failed' || order.status === 'refunded' || order.status === 'disputed' ? <XCircle size={48} className="text-red-500" /> : 
                   order.status === 'expired' ? <Clock size={48} className="text-yellow-500" /> : 
                   <Loader2 size={48} className="animate-spin text-blue-500" />}
                </div>
                <h3 className="font-display text-2xl uppercase italic tracking-wide">
                  {order.status}
                </h3>
                <p className="text-sm text-white/60 mt-2 font-sans">
                  {order.status === 'pending' || order.status === 'processing' 
                    ? orderStatusDetail(order.status, order.clout, order.fulfilledAt)
                    : orderStatusDetail(order.status, order.clout, order.fulfilledAt)}
                </p>
              </div>
               {journalError && <p role="alert" className="text-red-400 text-sm">{journalError}</p>}
              
              <div className="bg-white/5 p-3 rounded flex justify-between items-center border border-white/10">
                <span className="text-white/50 font-mono text-[10px] uppercase tracking-widest">ID</span>
                <span className="font-mono text-[10px] text-white/80 truncate max-w-[200px]">{order.id}</span>
              </div>
              <div className="bg-white/5 p-3 rounded border border-white/10 text-sm text-white/60">
                <OrderAmount order={order} />
              </div>

              {order.status === 'pending' && resumeUrl && (
                checkoutEnabled
                  ? <div className="space-y-3">
                      <a href={resumeUrl} className="studio-action studio-action--gold flex justify-center no-underline">Resume Checkout</a>
                      <button type="button" onClick={() => void copyCheckoutLink()} className="studio-text-action w-full justify-center">
                        Copy secure checkout link
                      </button>
                      <input
                        ref={checkoutLinkRef}
                        aria-label="Secure checkout link"
                        className="w-full rounded border border-white/20 bg-black/70 px-3 py-2 font-mono text-[11px] text-white/75"
                        onFocus={event => event.currentTarget.select()}
                        readOnly
                        value={resumeUrl}
                      />
                      <p className="text-center text-xs text-white/50">If Preview opens a blank page, select this address and paste it into your browser.</p>
                      {copyMessage && <p role="status" className="text-center text-xs text-white/60">{copyMessage}</p>}
                    </div>
                  : <button disabled className="studio-action studio-action--gold">Checkout unavailable</button>
              )}
              
              <button className="studio-text-action w-full justify-center mt-2" onClick={onClose}>
                {terminal ? 'Return to Market' : 'Check Later'}
              </button>
            </div>
          )}
           {pollingPaused && !error && <div className="text-center"><p className="text-white/60 text-sm mb-3">Confirmation is taking longer than usual. The latest server status is still shown.</p><button className="studio-action studio-action--gold text-sm" onClick={() => { setAttempts(0); void refetch(); }}>Check again</button></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseHistory({ checkoutEnabled, onInspect }: { checkoutEnabled: boolean, onInspect: (orderId: string) => void }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const currentCursor = cursors[cursors.length - 1] || undefined;
  const queryClient = useQueryClient();
  
  const { data, isLoading, error, refetch } = useListPaymentOrders(
    currentCursor ? { cursor: currentCursor } : undefined, 
    { query: { queryKey: getListPaymentOrdersQueryKey(currentCursor ? { cursor: currentCursor } : undefined), retry: false } }
  );

  function refreshHistory() {
    queryClient.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPaymentOrdersQueryKey() });
    void refetch();
  }

  return (
    <div className="corner-store__shelf-content mt-4 pt-4 border-t border-white/10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-white/60">Ledger</h3>
        <button onClick={refreshHistory} className="text-white/40 hover:text-white transition-colors" aria-label="Refresh history">
          <RefreshCw size={14} />
        </button>
      </div>
      
      {isLoading && <p className="text-white/40 text-xs font-mono">LOADING...</p>}
      {error && <div><p role="alert" className="text-red-400 text-xs font-mono mb-2">{errorMessage(error, 'COULD NOT LOAD ORDERS')}</p><button className="studio-text-action text-xs" onClick={refreshHistory}>Retry</button></div>}
      
      {!isLoading && !error && data?.orders && data.orders.length === 0 && (
        <p className="text-white/40 text-xs font-mono">NO PURCHASES FOUND</p>
      )}

      {data?.orders && data.orders.length > 0 && (
        <ul className="space-y-2 mb-4">
          {data.orders.map(order => (
            <li key={order.id} data-testid="corner-history-order" className="bg-black/60 p-3 rounded border border-white/5 flex flex-col gap-2 transition-colors hover:border-white/10">
              <div className="flex justify-between items-start">
                <strong className="font-sans font-bold text-sm leading-none">{order.offerName}</strong>
                <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  order.status === 'fulfilled' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  order.status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  order.status === 'pending' || order.status === 'processing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-white/10 text-white/60 border border-white/10'
                }`}>{order.status}</span>
              </div>
              <div className="flex justify-between items-end mt-1">
                <div className="text-white/50 text-[11px] font-sans">
                  {new Date(order.createdAt).toLocaleDateString()} · <OrderAmount order={order} compact />
                  <p className="mt-1">{orderStatusDetail(order.status, order.clout, order.fulfilledAt)}</p>
                </div>
                <button onClick={() => onInspect(order.id)} className="text-primary hover:text-yellow-300 font-bold text-[11px] font-sans flex items-center gap-1 uppercase tracking-wide">
                  {order.status === 'pending' && safeStripeCheckoutUrl(order.checkoutUrl) && checkoutEnabled ? 'Resume / details' : 'Details'} <ArrowRight size={10} />
                </button>
              </div>
              {order.status === 'pending' && checkoutEnabled && safeStripeCheckoutUrl(order.checkoutUrl) && (
                <label className="mt-1 block text-[10px] uppercase tracking-wider text-white/50">
                  Stripe checkout address
                  <input
                    aria-label={`Stripe checkout address for ${order.offerName}`}
                    className="mt-1 w-full rounded border border-white/15 bg-black/70 px-2 py-2 font-mono text-[10px] normal-case tracking-normal text-white/70"
                    onFocus={event => event.currentTarget.select()}
                    readOnly
                    value={safeStripeCheckoutUrl(order.checkoutUrl)!}
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      
      <div className="flex justify-between items-center">
        <button 
          disabled={cursors.length === 0} 
          onClick={() => setCursors(cursors.slice(0, -1))}
          className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white disabled:opacity-30 disabled:hover:text-white/70"
        >
          &larr; Prev
        </button>
        <button 
          disabled={!data?.nextCursor} 
          onClick={() => { if (data?.nextCursor) setCursors([...cursors, data.nextCursor]); }}
          className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white disabled:opacity-30 disabled:hover:text-white/70"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

export function CornerStore({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { seen } = useNotifications();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const returnOrderId = searchParams.get('order');

  const [department, setDepartment] = useState<'clout' | 'pack' | 'style' | 'shards'>('clout');
  const [selected, setSelected] = useState<StoreOffer | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [unitedStatesConfirmed, setUnitedStatesConfirmed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const lock = useRef(false);
  const welcomeVoice = useRef<HTMLAudioElement | null>(null);
  
  const queryClient = useQueryClient();
  const { data: catalog, isLoading: catalogLoading, isFetching: catalogFetching, error: catalogError, refetch: refetchCatalog } = useGetPaymentCatalog({
    query: { queryKey: getGetPaymentCatalogQueryKey(), retry: false }
  });
  const createCheckout = useCreatePaymentCheckout();
  
  const checkoutEnabled = !e2eAuthEnabled && !!catalog?.enabled && (catalog.mode === 'test' || catalog.mode === 'live');

  useEffect(() => {
    welcomeVoice.current = playVoiceLine('market-welcome', loadFeedbackPreferences().audioEnabled);
    return () => stopSoundEffect(welcomeVoice.current);
  }, []);

  function choose(offer: StoreOffer) {
    seen(`offer:${offer.id}`);
    setAdultConfirmed(false);
    setUnitedStatesConfirmed(false);
    setCheckoutError(''); 
    setSelected(offer); 
  }

  async function purchase(catalogOffer: PaymentOffer) {
    if (lock.current) return;
    if (!adultConfirmed || !unitedStatesConfirmed) {
      setCheckoutError('Confirm your age and US location before proceeding.');
      return;
    }
    if (!checkoutEnabled) {
      setCheckoutError('Checkout is not available in the current market mode.');
      return;
    }
    
    lock.current = true;
    setCheckoutBusy(true);
    setCheckoutError('');

    try {
      const idempotencyKey = getOrCreatePendingCheckout(
        sessionStorage,
        bootstrap.profile.id,
        catalogOffer.id,
        () => crypto.randomUUID(),
      );

      const res = await createCheckout.mutateAsync({
        data: { offerId: catalogOffer.id as PaymentCheckoutInput['offerId'], idempotencyKey, adultConfirmed, unitedStatesConfirmed }
      });

      const checkoutUrl = safeStripeCheckoutUrl(res.checkoutUrl);
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
      } else if (res.order.status === 'fulfilled') {
        queryClient.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPaymentOrdersQueryKey() });
        clearPendingCheckout(sessionStorage, bootstrap.profile.id, catalogOffer.id);
        setSelected(null);
      } else if (isTerminalOrderStatus(res.order.status)) {
        clearPendingCheckout(sessionStorage, bootstrap.profile.id, catalogOffer.id);
        queryClient.invalidateQueries({ queryKey: getListPaymentOrdersQueryKey() });
        setCheckoutError(`${orderStatusDetail(res.order.status, res.order.clout, res.order.fulfilledAt)} Choose Proceed to Checkout again to intentionally start a new purchase.`);
      } else {
        setCheckoutError('The purchase is still pending, but Stripe did not provide a verified checkout link. Check Your Orders before trying again.');
      }
    } catch (err) {
      setCheckoutError(errorMessage(err, err instanceof Error ? err.message : 'Failed to connect to checkout service.'));
    } finally {
      lock.current = false;
      setCheckoutBusy(false);
    }
  }

  return (
    <main className="corner-store">
      <LayeredVenue scene="fade-market" />
      <div className="corner-store__scroll">
        <header className="corner-store__heading">
          <span>OPEN LATE · GOOD COMPANY</span>
          <h1>Fade<br /><em>Market.</em></h1>
          <p>A little Clout. A new look. Your next favorite.</p>
        </header>
        
        <section className="corner-store__counter">
        <div className="corner-store__wallet">
          <img src={getAssetUrl('assets/rewards/clout-token.webp')} alt="Clout token" />
          <div>
            <small>ACCOUNT CLOUT</small>
            <strong><AnimatedNumber value={bootstrap.profile.softCurrency} /></strong>
          </div>
        </div>
        
        {(catalog?.mode === 'test' || e2eAuthEnabled) && (
          <p className="corner-store__notice bg-yellow-500/10 border border-yellow-500/30 text-yellow-200">
            {e2eAuthEnabled ? 'Preview mode · Checkout and resume are disabled.' : 'Test Mode · No real charges will be made.'}
          </p>
        )}
        {searchParams.get('payment') === 'cancel' && (
          <p className="corner-store__notice bg-white/5 border border-white/20 text-white/75">Checkout was closed. Your purchase status below remains the server’s latest record.</p>
        )}
        {catalogError && (
          <div role="alert" className="corner-store__notice bg-red-500/10 border border-red-500/30 text-red-200">
            <p>{errorMessage(catalogError, 'Market catalog could not be loaded.')}</p>
            <button className="studio-text-action mt-2" disabled={catalogFetching} onClick={() => void refetchCatalog()}>{catalogFetching ? 'Retrying…' : 'Retry catalog'}</button>
          </div>
        )}
        
        {catalog && !catalog.enabled && (
          <p className="corner-store__notice bg-red-500/10 border border-red-500/30 text-red-200">
            {catalog.message || 'Market is currently closed.'}
          </p>
        )}

        <nav className="corner-store__departments" aria-label="Fade Market shelves">
          {(['clout', 'pack', 'style', 'shards'] as const).map(d => (
            <button key={d} aria-pressed={department === d} onClick={() => setDepartment(d)}>
              {{ clout: 'Clout', pack: 'Packs', style: 'Card styles', shards: 'Shards' }[d]}
            </button>
          ))}
        </nav>
        
        <div className="corner-store__products">
          {CORNER_OFFERS.filter(o => o.kind === department).map(offer => {
            const catalogOffer = catalog?.offers.find(o => o.id === offer.id);
            const isSupported = offer.kind === 'clout';
            const available = !!catalogOffer && catalogOffer.enabled && checkoutEnabled;
            const priceDisplay = catalogOffer ? catalogPriceLabel(catalogOffer.amountMinor, catalogOffer.currency, catalog as TaxAwareCatalog | undefined) : 'Unavailable';
            
            return (
              <motion.article key={offer.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="corner-product">
                <img src={getAssetUrl(offer.art)} alt="" />
                <div>
                  <small>{offer.kind === 'pack' ? 'SHOWCASE PACK · PREVIEW' : offer.kind === 'style' ? 'ARTWORK ONLY' : 'MARKET PICK'}</small>
                  <h2>{isSupported ? (catalogOffer?.name ?? 'Unavailable bundle') : offer.name}<ItemDot id={`offer:${offer.id}`} /></h2>
                  <p>{isSupported ? (catalogOffer ? `${catalogOffer.clout.toLocaleString()} Clout for your account.` : 'Catalog details are unavailable.') : offer.description}</p>
                  {offer.cards && <p className="corner-product__contents">{offer.cards.length} {offer.kind === 'style' ? 'alternate illustration' : 'featured cards'}</p>}
                  
                  <button 
                    disabled={isSupported && (!available || catalogLoading)} 
                    onClick={() => choose(offer)}
                  >
                    {!isSupported ? 'View' : (
                      <>
                        {priceDisplay}
                        <ArrowUpRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
        
        <details className="corner-store__shelf bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden transition-all duration-300 open:pb-4" open={historyOpen} onToggle={e => setHistoryOpen(e.currentTarget.open)}>
          <summary className="flex items-center gap-2 p-3 font-sans font-bold text-sm cursor-pointer hover:bg-white/5 transition-colors select-none">
            <ShoppingBag size={17} className="text-white/60" /> Your Orders
          </summary>
          {historyOpen && (
            <div className="px-4">
              <PurchaseHistory checkoutEnabled={checkoutEnabled} onInspect={(orderId) => {
                const params = new URLSearchParams(search);
                params.set('view', 'corner');
                params.set('order', orderId);
                setLocation(`${location}?${params.toString()}`);
              }} />
            </div>
          )}
        </details>
      </section>
      </div>

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="corner-checkout">
          {selected && (
            <>
               <DialogTitle>{catalog?.offers.find(offer => offer.id === selected.id)?.name ?? selected.name}</DialogTitle>
              <DialogDescription>
                {selected.kind === 'clout' ? 'Secure checkout via Stripe.' : 'Previewing upcoming market item.'}
              </DialogDescription>
              
              <img className="corner-checkout__art" src={getAssetUrl(selected.art)} alt="" />
               <p>{selected.kind === 'clout'
                 ? catalog?.offers.find(offer => offer.id === selected.id)
                   ? `${catalog.offers.find(offer => offer.id === selected.id)!.clout.toLocaleString()} Clout for your account.`
                   : 'Catalog details are unavailable.'
                 : selected.description}</p>
              
              {selected.cards && (
                <div className="corner-checkout__contents">
                  {selected.cards.map(id => (
                    <figure key={id}>
                      <img src={getAssetUrl('assets/characters/' + (selected.variant ? id + '-alternate' : id) + '.webp')} alt="" />
                      <figcaption>{id.replaceAll('-', ' ')}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
              
              {selected.kind === 'clout' && catalog && (() => {
                const cOffer = catalog.offers.find(o => o.id === selected.id);
                if (!cOffer) return <p className="text-red-400 py-4">Item currently unavailable.</p>;
                 const configuredSupportUrl = safeHttpsUrl(catalog.supportUrl);
                 const configuredRefundUrl = safeHttpsUrl(catalog.refundPolicyUrl);
                
                return (
                  <>
                    <div className="corner-checkout__total">
                      <span>{(catalog as TaxAwareCatalog).taxMode === 'none' ? 'Total' : 'Bundle price'}</span>
                      <strong>{formatCurrency(cOffer.amountMinor, cOffer.currency)}</strong>
                    </div>
                    <p data-testid="text-corner-tax-disclosure" className="text-xs text-white/60">
                      {(catalog as TaxAwareCatalog).taxMode === 'automatic'
                        ? 'Applicable tax is calculated automatically. Stripe shows the final total before you pay.'
                        : (catalog as TaxAwareCatalog).taxMode === 'none'
                          ? 'No additional tax is configured for this quote.'
                          : 'Tax status is unavailable. Stripe shows the final total before you pay.'}
                    </p>
                    <p className="text-sm text-white/60">Current balance: {bootstrap.profile.softCurrency.toLocaleString()} Clout<br/>After purchase: {(bootstrap.profile.softCurrency + cOffer.clout).toLocaleString()} Clout</p>
                    
                    <label className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} /> I am at least 18 years old.</label>
                    <label className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" checked={unitedStatesConfirmed} onChange={event => setUnitedStatesConfirmed(event.target.checked)} /> I am located in the United States.</label>
                    <p className="text-xs text-white/60">These are your declarations, not verified age or location.</p>
                    {checkoutError && <p role="alert" className="text-red-400 font-bold bg-red-900/20 p-2 rounded border border-red-500/30 text-sm mt-2">{checkoutError}</p>}
                    
                    <button 
                      className="studio-action studio-action--gold mt-4" 
                     disabled={checkoutBusy || !checkoutEnabled || !cOffer.enabled || !adultConfirmed || !unitedStatesConfirmed}
                       onClick={() => purchase(cOffer)}
                    >
                      {checkoutBusy ? 'Preparing Checkout…' : checkoutEnabled ? 'Proceed to Checkout' : 'Checkout unavailable'}
                    </button>
                    
                    <div className="flex justify-center gap-4 mt-4">
                       <a
                         href={configuredSupportUrl ?? appPath('/support')}
                         target={configuredSupportUrl ? '_blank' : undefined}
                         rel={configuredSupportUrl ? 'noreferrer' : undefined}
                         data-testid="link-corner-support"
                         className="text-primary hover:text-yellow-300 font-mono text-[10px] uppercase tracking-widest no-underline"
                       >
                         Support
                       </a>
                       <a
                         href={configuredRefundUrl ?? appPath('/refund-policy')}
                         target={configuredRefundUrl ? '_blank' : undefined}
                         rel={configuredRefundUrl ? 'noreferrer' : undefined}
                         data-testid="link-corner-refund-policy"
                         className="text-primary hover:text-yellow-300 font-mono text-[10px] uppercase tracking-widest no-underline"
                       >
                         Refund Policy
                       </a>
                    </div>
                  </>
                );
              })()}
              
              {selected.kind !== 'clout' && (
                 <p className="text-sm text-white/60">Showcase preview only. This item is not currently for sale.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {returnOrderId && (
        <OrderStatusModal 
          orderId={returnOrderId} 
          bootstrap={bootstrap} 
           checkoutEnabled={checkoutEnabled}
          onClose={() => {
            const params = new URLSearchParams(search);
            params.delete('payment');
            params.delete('order');
            setLocation(`${location}?${params.toString()}`, { replace: true });
          }} 
        />
      )}
    </main>
  );
}
