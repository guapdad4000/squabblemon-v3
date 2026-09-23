import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { getPendingCheckout, savePendingCheckout, clearPendingCheckout, formatCurrency, getOrCreatePendingCheckout, isTerminalOrderStatus, isValidOrderId, orderStatusDetail, safeHttpsUrl, safeStripeCheckoutUrl } from './cornerStore';

describe('cornerStore helpers', () => {
  it('saves, retrieves, and clears pending checkouts', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); }
    };

    const uuid = 'd9428888-122b-4f4e-9f6f-9c2a3f349a11';
    savePendingCheckout(mockStorage, 'player1', 'offerA', uuid);
    assert.strictEqual(getPendingCheckout(mockStorage, 'player1', 'offerA'), uuid);
    assert.strictEqual(getPendingCheckout(mockStorage, 'player1', 'offerB'), null);

    clearPendingCheckout(mockStorage, 'player1', 'offerA');
    assert.strictEqual(getPendingCheckout(mockStorage, 'player1', 'offerA'), null);
  });

  it('fails before checkout when storage is blocked or does not persist', () => {
    const uuid = 'd9428888-122b-4f4e-9f6f-9c2a3f349a11';
    assert.throws(() => getOrCreatePendingCheckout({
      getItem: () => null,
      setItem: () => { throw new Error('blocked'); },
    }, 'player1', 'offerA', () => uuid), /blocked/);
    assert.throws(() => getOrCreatePendingCheckout({
      getItem: () => null,
      setItem: () => undefined,
    }, 'player1', 'offerA', () => uuid), /could not be saved/);
  });

  it('rejects invalid stored references', () => {
    assert.throws(() => getPendingCheckout({ getItem: () => 'not-a-uuid' }, 'p', 'o'), /invalid/);
  });

  it('formats currency correctly', () => {
    assert.strictEqual(formatCurrency(1999, 'USD'), '$19.99');
    assert.strictEqual(formatCurrency(500, 'USD'), '$5.00');
  });

  it('identifies terminal order statuses', () => {
    assert.strictEqual(isTerminalOrderStatus('fulfilled'), true);
    assert.strictEqual(isTerminalOrderStatus('failed'), true);
    assert.strictEqual(isTerminalOrderStatus('expired'), true);
    assert.strictEqual(isTerminalOrderStatus('refunded'), true);
    assert.strictEqual(isTerminalOrderStatus('disputed'), true);
    
    assert.strictEqual(isTerminalOrderStatus('pending'), false);
    assert.strictEqual(isTerminalOrderStatus('processing'), false);
  });

  it('validates order ids and safe links', () => {
    assert.strictEqual(isValidOrderId('1712345678901-d9428888-122b-4f4e-9f6f-9c2a3f349a11'), true);
    assert.strictEqual(isValidOrderId('d9428888-122b-4f4e-9f6f-9c2a3f349a11'), false);
    assert.strictEqual(safeHttpsUrl('https://support.example/help'), 'https://support.example/help');
    assert.strictEqual(safeHttpsUrl('javascript:alert(1)'), null);
    assert.strictEqual(safeHttpsUrl('http://support.example'), null);
    assert.strictEqual(safeStripeCheckoutUrl('https://checkout.stripe.com/c/pay/test'), 'https://checkout.stripe.com/c/pay/test');
    assert.strictEqual(safeStripeCheckoutUrl('https://checkout.stripe.com.evil.test/pay'), null);
    assert.strictEqual(safeStripeCheckoutUrl('https://attacker@checkout.stripe.com/pay'), null);
  });

  it('describes delayed and reversed orders truthfully', () => {
    assert.match(orderStatusDetail('processing', 500), /being finalized/);
    assert.match(orderStatusDetail('refunded', 500, '2025-01-01T00:00:00Z'), /completed purchase was later refunded/);
    assert.match(orderStatusDetail('disputed', 500, '2025-01-01T00:00:00Z'), /completed purchase is now disputed/);
  });
});
