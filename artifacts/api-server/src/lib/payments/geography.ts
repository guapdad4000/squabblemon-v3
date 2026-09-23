import type { RuntimeDeploymentContext } from '../runtimeDeploymentContext';
import { PaymentError } from './config';

/** Admission only: never apply to an existing order, webhook, or fulfillment.
 * IP geolocation is a restriction, not proof of physical presence.
 */
export function assertNewCheckoutGeography(runtime?: RuntimeDeploymentContext) {
  const hosted = Boolean(runtime) || process.env.NETLIFY === 'true' ||
    process.env.APP_ENV === 'production' || process.env.PAYMENTS_MODE === 'live';
  // Local test checkout has no Netlify invocation context.
  if (!hosted) return;
  if (!runtime?.deployId || !['production', 'deploy-preview', 'branch-deploy'].includes(runtime.context) ||
      runtime.countryCode !== 'US') {
    throw new PaymentError(403, 'New purchases require a United States connection. Location could not be confirmed for this request.');
  }
}