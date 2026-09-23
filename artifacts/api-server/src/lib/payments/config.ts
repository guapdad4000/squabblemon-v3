import { currentDeploymentContext } from '../runtimeDeploymentContext';

export type PaymentMode = 'test' | 'live';
export const CATALOG_VERSION = 'corner-clout-v2-tax';
export const OFFERS = [
  { id: 'clout-pocket', name: 'Pocket change', clout: 500, amountMinor: 299, currency: 'usd', env: 'POCKET' },
  { id: 'clout-stack', name: 'The stack', clout: 1500, amountMinor: 799, currency: 'usd', env: 'STACK' },
  { id: 'clout-bag', name: 'Full bag', clout: 4000, amountMinor: 1999, currency: 'usd', env: 'BAG' },
] as const;
// Owner approvals are recorded in docs/corner-store-launch-approvals.md.
// These source approvals do not activate purchases: verified production identity
// and BOTH environment gates remain required. Do not enable either gate until
// the hosted replay evidence and actual policy launch date are confirmed.
export const LIVE_APPROVAL = {
  approved: true as boolean,
  merchantEligible: true as boolean,
  pricingApproved: true as boolean,
  regionsApproved: true as boolean,
  refundHandlingApproved: true as boolean,
  taxMode: 'automatic' as string,
};
export class PaymentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function paymentMode(): PaymentMode {
  return process.env.PAYMENTS_MODE === 'live' ? 'live' : 'test';
}
export function trustedOrigin(): string {
  const raw = process.env.PAYMENTS_PUBLIC_ORIGIN;
  if (!raw) throw new PaymentError(503, 'Payments are not configured.');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new PaymentError(503, 'Payment return origin is invalid.');
  }
  return url.origin;
}
export function priceId(mode: PaymentMode, offer: typeof OFFERS[number]): string {
  const id = process.env[`STRIPE_${mode.toUpperCase()}_PRICE_${offer.env}`];
  if (!id?.startsWith('price_')) throw new PaymentError(503, 'This bundle is not configured.');
  return id;
}
export function secretKey(mode: PaymentMode): string {
  const key = process.env[`STRIPE_${mode.toUpperCase()}_SECRET_KEY`];
  if (!key || key.trim() !== key || !new RegExp(`^(?:sk|rk)_${mode}_[A-Za-z0-9_]+$`).test(key)) {
    throw new PaymentError(503, 'Payment provider credentials are unavailable.');
  }
  return key;
}
export function assertCheckoutEnabled(): PaymentMode {
  const mode = paymentMode();
  const runtime = currentDeploymentContext();
  if (process.env.PAYMENTS_ENABLED !== 'true') throw new PaymentError(503, 'Checkout is currently unavailable. Existing payments can still settle.');
  if (mode === 'live' && !(LIVE_APPROVAL.approved && LIVE_APPROVAL.merchantEligible && LIVE_APPROVAL.pricingApproved &&
    LIVE_APPROVAL.regionsApproved && LIVE_APPROVAL.refundHandlingApproved && LIVE_APPROVAL.taxMode === 'automatic' &&
    process.env.NETLIFY === 'true' && runtime?.context === 'production' && Boolean(runtime.deployId) && runtime.origin === trustedOrigin() &&
    (!process.env.CONTEXT || process.env.CONTEXT === 'production') && process.env.APP_ENV === 'production' &&
    process.env.PAYMENTS_LIVE_ENABLED === 'true' && process.env.PAYMENTS_SUPPORT_URL && process.env.PAYMENTS_REFUND_POLICY_URL)) {
    throw new PaymentError(503, 'Live payments await merchant and policy approval.');
  }
  trustedOrigin();
  if (!process.env[`STRIPE_${mode.toUpperCase()}_WEBHOOK_SECRET`]?.startsWith('whsec_')) {
    throw new PaymentError(503, 'Payment settlement is not configured.');
  }
  if (!(mode === 'test' && process.env.PAYMENTS_REPLIT_TEST_PROXY === 'true' && process.env.REPL_IDENTITY && process.env.NETLIFY !== 'true')) secretKey(mode);
  return mode;
}
export function paymentCatalog() {
  let enabled = true;
  let message = paymentMode() === 'test' ? 'Stripe test mode. No real money is charged.' : 'Secure checkout with Stripe.';
  try { assertCheckoutEnabled(); } catch (error) { enabled = false; message = error instanceof PaymentError ? error.message : 'Payments are not configured.'; }
  return {
    version: CATALOG_VERSION, taxMode: 'automatic' as const, mode: enabled ? paymentMode() : 'disabled', enabled, message,
    supportUrl: process.env.PAYMENTS_SUPPORT_URL ?? null,
    refundPolicyUrl: process.env.PAYMENTS_REFUND_POLICY_URL ?? null,
    offers: OFFERS.map(({ env: _env, ...offer }) => {
      let available = enabled;
      try { priceId(paymentMode(), OFFERS.find(o => o.id === offer.id)!); configuredTaxCode(paymentMode()); } catch { available = false; }
      return { ...offer, enabled: available };
    }),
  };
}
export function configuredTaxCode(mode: PaymentMode): string {
  const code = process.env[`STRIPE_${mode.toUpperCase()}_TAX_CODE`];
  if (!code || !/^txcd_[0-9]+$/.test(code)) throw new PaymentError(503, 'Approved Stripe product tax classification is not configured.');
  return code;
}