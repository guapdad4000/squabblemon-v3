import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { interactionClickSound } from './interactionClickSounds';

const controlSelector = 'button, a[href], [role="button"], [role="tab"], input[type="button"], input[type="submit"]';

class FakeElement {
  constructor(private readonly selectors: Set<string>, private readonly control: FakeElement = undefined as unknown as FakeElement) {
    if (!this.control) this.control = this;
  }

  closest(selector: string) {
    if (selector === controlSelector) return this.control;
    return this.control.selectors.has(selector) ? this.control : null;
  }

  matches(selector: string) {
    return this.selectors.has(selector);
  }
}

const originalElement = globalThis.Element;
before(() => { globalThis.Element = FakeElement as unknown as typeof Element; });
after(() => { globalThis.Element = originalElement; });

function targetInside(...selectors: string[]) {
  const control = new FakeElement(new Set(selectors));
  return new FakeElement(new Set(), control) as unknown as Element;
}

test('the key jingle belongs only to the header Safehouse icon', () => {
  assert.equal(interactionClickSound(targetInside('.city-header__safehouse')), 'keys-jingle');
  assert.equal(interactionClickSound(targetInside('.safehouse-room-markers')), null);
  assert.equal(interactionClickSound(targetInside('.safehouse-room-tools')), null);
  assert.equal(interactionClickSound(targetInside('.safehouse-bounty-logo')), null);
  assert.equal(interactionClickSound(targetInside('.safehouse-stage .starter-mythic-shortcut')), null);
  assert.equal(interactionClickSound(targetInside('.fan-nav')), null);
});

test('other routed interaction sounds remain intact', () => {
  assert.equal(interactionClickSound(targetInside('.arsenal-paper-tabs, .collection-tabs, .market-tabs, .fight-tabs, .guide-chapter-nav')), 'page-turn');
  assert.equal(interactionClickSound(targetInside('.fadecade-hub, .fadecade-dialog-content')), 'arcade-beep');
});
