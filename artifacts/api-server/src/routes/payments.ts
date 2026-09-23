import { getAuth } from '@clerk/express';
import { Router, type RequestHandler } from 'express';
import { CreatePaymentCheckoutBody } from '@workspace/api-zod';
import { PaymentError, paymentCatalog } from '../lib/payments/config';
import { createCheckout, getOrder, listOrders, processPaymentEvent } from '../lib/payments/service';
import { verifyWebhook } from '../lib/payments/provider';
import { currentDeploymentContext } from '../lib/runtimeDeploymentContext';

const router = Router();
const boundary = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
  try { await handler(req, res, next); } catch (error) {
    if (error instanceof PaymentError) { res.status(error.status).json({ error: error.message }); return; }
    req.log.error({ paymentFailure: true }, 'Payment request failed');
    res.status(503).json({ error: 'Payment service could not confirm this request. Retry the same purchase.' });
  }
};
router.use('/player/payments', (req, res, next) => {
  if (!getAuth(req).userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.get('/player/payments/catalog', boundary((_req, res) => { res.json(paymentCatalog()); }));
router.post('/player/payments/checkout', boundary(async (req, res) => {
  const parsed = CreatePaymentCheckoutBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Choose a valid bundle and purchase request.' }); return; }
  res.json(await createCheckout(getAuth(req).userId!, parsed.data, currentDeploymentContext()));
}));
router.get('/player/payments/orders', boundary(async (req, res) => {
  if (req.query.cursor !== undefined && (typeof req.query.cursor !== 'string' || req.query.cursor.length > 100)) {
    res.status(400).json({ error: 'Invalid purchase history cursor.' }); return;
  }
  res.json(await listOrders(getAuth(req).userId!, req.query.cursor as string | undefined));
}));
router.get('/player/payments/orders/:orderId', boundary(async (req, res) => {
  res.json(await getOrder(getAuth(req).userId!, String(req.params.orderId)));
}));
export const paymentWebhook: RequestHandler = boundary(async (req, res) => {
  const event = verifyWebhook(req.body, req.header('stripe-signature') ?? '');
  await processPaymentEvent(event);
  res.json({ received: true });
});
export default router;