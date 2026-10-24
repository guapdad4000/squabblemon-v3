import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Production CSS and bundled fonts in an isolated browser cascade check.
// This does not stand in for an authenticated game-flow visual comparison.
const source = new URL('../src/', import.meta.url);
const files = { type: 'styles/blzee-type.css', battle: 'components/battle-actions.css', board: 'components/battle-board.css',
  workshop: 'styles/deck-workshop.css', carousel: 'styles/deck-carousel.css' };
const styles = Object.fromEntries(Object.entries(files).map(([name, file]) => {
  const url = new URL(file, source);
  const css = readFileSync(url, 'utf8').replace(/url\('([^']+\.woff2)'\)/g, (_, font) =>
    `url('data:font/woff2;base64,${readFileSync(new URL(font, url)).toString('base64')}')`);
  return [name, css];
}));
const orders = [
  ['type', 'board', 'battle', 'workshop', 'carousel'], // Global CSS before lazy routes.
  ['board', 'battle', 'workshop', 'carousel', 'type'], // Roles after loaded routes.
  ['battle', 'type', 'board', 'carousel', 'workshop'], // Returning through another route.
];
const viewports = [
  { width: 320, height: 568, action: 12, online: 10, deck: 24 },
  { width: 390, height: 844, action: 12, online: 10, deck: 24 },
  { width: 844, height: 390, action: 11, online: 11, deck: 24 },
  { width: 1280, height: 800, action: 13, online: 13, deck: 32 },
];
const html = `
  <style>:root { --font-display:'Clash Display',sans-serif; --font-sans:Arial,sans-serif; }</style>
  <div class="battle-arena battle-hud"><button id="location" class="mobile-district-open">THE TOWN</button>
    <div class="battle-actions"><button id="action" class="battle-primary-action battle-street-sign">End Turn</button></div>
    <div class="battle-actions" data-online><button id="online" class="battle-primary-action battle-street-sign">Play Card</button></div>
  </div>
  <div class="deck-workbench__name"><input id="deck" value="THE OPPS"></div>
  <div class="decks-spectacle__title"><h1 id="title">MY DECKS</h1></div>
`;
const browser = await chromium.launch({ headless: true });
let checks = 0;
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    for (const order of orders) {
      const label = `${viewport.width}x${viewport.height}, ${order.join(' -> ')}`;
      await page.setContent(html);
      for (const name of order) await page.addStyleTag({ content: styles[name] });
      const result = await page.evaluate(async () => {
        const faces = (await Promise.all([
          document.fonts.load('700 15px "Hemi Head"', 'End Turn'),
          document.fonts.load('400 24px "Blzee"', 'THE OPPS'),
        ])).flat().map(face => ({ family: face.family, status: face.status }));
        const text = Object.fromEntries(['action', 'online', 'deck', 'title', 'location'].map(id => {
          const css = getComputedStyle(document.getElementById(id));
          return [id, { family: css.fontFamily, weight: css.fontWeight, style: css.fontStyle,
            synthesis: css.fontSynthesis, size: parseFloat(css.fontSize), tracking: parseFloat(css.letterSpacing) }];
        }));
        return { faces, text };
      });
      assert.equal(result.faces.length, 2, `${label}: both bundled font faces exist`);
      assert.ok(result.faces.every(face => face.status === 'loaded'), `${label}: both font faces load`);
      for (const id of ['action', 'online']) {
        const css = result.text[id];
        assert.match(css.family, /^"?Hemi Head"?,/, `${label}: ${id} uses the action role`);
        assert.equal(css.weight, '700', `${label}: ${id} weight`);
        assert.equal(css.style, 'normal', `${label}: ${id} style`);
        assert.equal(css.synthesis, 'none', `${label}: ${id} uses the real font`);
        assert.equal(css.size, viewport[id], `${label}: ${id} keeps its responsive size`);
      }
      for (const id of ['deck', 'title']) {
        const css = result.text[id];
        assert.match(css.family, /^"?Blzee"?,/, `${label}: ${id} uses the deck role`);
        assert.equal(css.weight, '400', `${label}: ${id} weight`);
        assert.equal(css.style, 'normal', `${label}: ${id} style`);
        assert.equal(css.synthesis, 'none', `${label}: ${id} uses the real font`);
        assert.ok(Math.abs(css.tracking / css.size - 0.01) < 0.00001, `${label}: ${id} preserves role spacing`);
      }
      assert.match(result.text.location.family, /^"?Blzee"?,/, `${label}: visible location title uses its role`);
      assert.equal(result.text.location.weight, '400', `${label}: visible location title weight`);
      assert.equal(result.text.location.style, 'normal', `${label}: visible location title style`);
      assert.ok(Math.abs(result.text.location.size - Math.min(14, Math.max(11, viewport.width * .012))) < .001,
        `${label}: location title keeps its responsive clamp`);
      assert.equal(result.text.deck.size, viewport.deck, `${label}: editor size stays responsive`);
      assert.ok(Math.abs(result.text.title.size - Math.min(42, Math.max(28, viewport.width * .04))) < .001,
        `${label}: deck heading keeps its existing clamp`);
      checks++;
    }
    await page.close();
  }
  console.log(`PASS ${checks} typography cascade cases: bundled fonts, role parity, responsive sizes, and three CSS arrival orders.`);
} finally {
  await browser.close();
}
