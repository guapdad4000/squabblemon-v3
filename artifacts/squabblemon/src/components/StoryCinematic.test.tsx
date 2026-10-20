import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoryCinematic } from './StoryCinematic';

const props = {
  source: 'assets/original-cinematic.mp4',
  poster: 'assets/original-poster.webp',
  title: 'The same chapter',
  eyebrow: 'The same story',
  onComplete() {},
};

function renderWithPolicy(options: {
  reduced?: boolean; inGameReduced?: boolean; hidden?: boolean;
  connection?: { saveData?: boolean; effectiveType?: string; downlink?: number };
} = {}) {
  const keys = ['window', 'document', 'navigator'] as const;
  const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
      matchMedia: () => ({ matches: Boolean(options.reduced) }),
    }) });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
      hidden: Boolean(options.hidden),
      documentElement: { dataset: { reduceMotion: options.inGameReduced ? 'true' : undefined } },
    } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { connection: options.connection } });
    return renderToStaticMarkup(<StoryCinematic {...props} />);
  } finally {
    keys.forEach((key, index) => {
      const original = originals[index];
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
}

test('reduced-motion and bandwidth policies use the original poster on the very first render', () => {
  for (const policy of [
    { reduced: true },
    { inGameReduced: true },
    { hidden: true },
    { connection: { saveData: true } },
    { connection: { effectiveType: 'slow-2g' } },
    { connection: { effectiveType: '2g' } },
    { connection: { effectiveType: '3g' } },
    { connection: { downlink: 0.5 } },
  ]) {
    const html = renderWithPolicy(policy);
    assert.doesNotMatch(html, /<video\b/, JSON.stringify(policy));
    assert.match(html, /<img[^>]+src="\/assets\/original-poster\.webp"/);
    assert.match(html, /The same chapter/);
    assert.match(html, /Continue/);
  }
});

test('normal cinematic keeps autoplay and the original poster, with source assignment deferred until its policy-checked effect', () => {
  const html = renderWithPolicy({ connection: { saveData: false, effectiveType: '4g', downlink: 10 } });
  assert.match(html, /<video\b/);
  assert.match(html, /poster="\/assets\/original-poster\.webp"/);
  assert.match(html, /autoPlay=""/);
  assert.match(html, /preload="none"/);
  assert.doesNotMatch(html, /original-cinematic\.mp4/);
});

test('server rendering is poster-only and does not require browser globals', () => {
  const html = renderToStaticMarkup(<StoryCinematic {...props} />);
  assert.doesNotMatch(html, /<video\b/);
  assert.match(html, /original-poster\.webp/);
});
