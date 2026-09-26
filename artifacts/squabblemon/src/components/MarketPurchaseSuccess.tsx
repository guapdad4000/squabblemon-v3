import { motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import type { PaymentOrder } from '@workspace/api-client-react';
import { getAssetUrl } from '../lib/assets';

export type MarketReceiptSource = { order: PaymentOrder; daily?: never } | { daily: { date: string }; order?: never };

export function MarketPurchaseSuccess({ art, name, order, daily, children, reducedMotion = false }: {
  art: string; name: string; children: ReactNode; reducedMotion?: boolean;
} & MarketReceiptSource) {
  const systemReducedMotion = useReducedMotion();
  const still = reducedMotion || systemReducedMotion;
  const [itemLoaded, setItemLoaded] = useState(false);
  const [bagLoaded, setBagLoaded] = useState(false);
  const ready = itemLoaded && bagLoaded;
  const fulfilledDate = daily ? new Date(`${daily.date}T00:00:00Z`) : order.fulfilledAt ? new Date(order.fulfilledAt) : null;
  const dateLabel = fulfilledDate && !Number.isNaN(fulfilledDate.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: daily ? 'UTC' : undefined }).format(fulfilledDate)
    : null;
  return <div className="market-bag-success" data-testid="market-purchase-success" data-reduced={still} data-receipt-kind={daily ? 'daily' : 'purchase'} role="status">
    <span className="market-paper-watermark" aria-hidden="true"><img src={getAssetUrl('assets/market/fade-market-ascii-logo.svg')} alt="" draggable={false} /></span>
    <header className="market-receipt__masthead">
      <span>YOUR NEIGHBORHOOD CONNECTION</span>
      <strong>FADE <em>MARKET</em><i aria-hidden="true">✦</i></strong>
      <p>OPEN LATE. GOOD COMPANY.</p>
    </header>
    <div className="market-receipt__register"><span>{daily ? 'FM / DAILY GIFT' : 'FM / DIGITAL GOODS'}</span><span>CUSTOMER COPY</span></div>
    <div className="market-bag-scene" aria-hidden="true">
      <div className="market-bag-halo" />
      <span className="market-receipt__seal"><small>FADE MARKET</small><b>{daily ? 'FREE' : 'PAID'}</b><small>& PACKED</small></span>
      <motion.img className="market-bag-item" src={getAssetUrl(art)} alt="" onLoad={() => setItemLoaded(true)}
        initial={still ? false : { y: -100, rotate: -16, scale: .8, opacity: 0 }}
        animate={still ? { y: -25, scale: .7, opacity: 1 } : ready ? { y: [-100, -65, 82], rotate: [-16, 8, 0], scale: [.8, 1, .5], opacity: [0, 1, 0] } : { y: -100, opacity: 0 }}
        transition={{ duration: 1.4, delay: .25, times: [0, .35, 1], ease: 'easeInOut' }} />
      <motion.img className="market-thank-you-bag" src={getAssetUrl('assets/market/thank-you-fade-again-bag.png')} alt="" onLoad={() => setBagLoaded(true)}
        initial={false} animate={still || !ready ? {} : { rotate: [0, 0, -4, 3, 0], y: [0, 0, 8, -3, 0], scale: [1, 1, 1.04, 1.01, 1] }}
        transition={{ duration: 2, times: [0, .58, .72, .86, 1] }} />
      <span className="market-bag-spark market-bag-spark--one">✦</span><span className="market-bag-spark market-bag-spark--two">✦</span>
    </div>
    <div className="market-receipt__item"><span>01</span><strong>{name}</strong><span>✓ ADDED</span></div>
    <p className="market-receipt__confirmation">{name} is in your account.</p>
    <div className="market-receipt__totals">{children}</div>
    <div className="market-receipt__record">
      <span>{dateLabel ?? (daily ? 'DAILY PACK CLAIMED' : 'PURCHASE COMPLETE')}</span><span>{daily ? 'STATUS: CLAIMED' : 'STATUS: FULFILLED'}</span>
      <span className="market-receipt__order">{daily ? `DAILY / ${daily.date}` : `ORDER / ${order.id}`}</span>
    </div>
    <footer className="market-receipt__footer">
      <strong>Thank you. Fade again!</strong>
      <div className="market-print-bars" aria-hidden="true" />
      <span>KEEP THIS ONE FOR YOUR RECORDS</span>
    </footer>
  </div>;
}
