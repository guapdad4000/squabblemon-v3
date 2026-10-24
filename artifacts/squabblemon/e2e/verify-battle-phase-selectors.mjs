import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const [css, playLoop] = await Promise.all([
  readFile(new URL('../src/index.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/PlayLoop.tsx', import.meta.url), 'utf8'),
]);
const union = playLoop.match(/export type PresentationPhase\s*=\s*([^;]+);/)?.[1];
assert.ok(union, 'the actual presentation phase union must be covered');
const phases = [...union.matchAll(/'([^']+)'/g)].map(match => match[1]);
assert.ok(phases.length > 0);
assert.doesNotMatch(css, /\.battle-arena\[class\*=/, 'battle phase changes must avoid class substring selectors');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, declarations]) => ({ selector: selector.trim(), declarations }));
const candidate = [
  rules.find(rule => rule.selector === '.battle-arena.phase-player-ready::after'),
  rules.find(rule => rule.selector.startsWith('.battle-arena:is(.phase-rival-thinking,') && rule.selector.endsWith('::after')),
  rules.find(rule => rule.selector.startsWith('.battle-arena.phase-squabble::after,')),
  rules.find(rule => rule.selector.startsWith('.battle-arena:is(.phase-player-ready,') && rule.selector.endsWith('.presentation-card-origin')),
];
assert.ok(candidate.every(Boolean), 'all four original phase presentation rules must remain');
// Original authored declarations and selector semantics are the parity oracle.
const original = [
  { selector: '.battle-arena.phase-player-ready::after', declarations: 'background: radial-gradient(ellipse at 50% 110%, rgba(250,204,21,.15) 0%, transparent 60%);' },
  { selector: '.battle-arena[class*="phase-rival"]::after', declarations: 'background: radial-gradient(ellipse at 50% -10%, rgba(56,189,248,.15) 0%, transparent 60%);' },
  { selector: '.battle-arena[class*="squabble"]::after, .battle-arena.is-squabble-armed::after', declarations: 'background: radial-gradient(circle at 50% 50%, rgba(225,29,72,.2) 0%, rgba(0,0,0,.8) 100%); opacity: 1;' },
  { selector: '.battle-arena[class*="phase-player-"] .presentation-card-origin', declarations: 'opacity: .16;' },
];
const scopedCss = (entries, id) => entries.map(({ selector, declarations }) => `${selector.replaceAll('.battle-arena', `#${id}.battle-arena`)} { ${declarations} }`).join('\n');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<style>.battle-arena::after { content: ''; }\n${scopedCss(original, 'original')}\n${scopedCss(candidate, 'candidate')}</style>
    <div id="original" class="battle-arena"><span class="presentation-card-origin">Origin</span></div>
    <div id="candidate" class="battle-arena"><span class="presentation-card-origin">Origin</span></div>`);
  const results = await page.evaluate(({ phases, original, candidate }) => {
    const before = document.querySelector('#original');
    const after = document.querySelector('#candidate');
    const view = element => ({
      background: getComputedStyle(element, '::after').backgroundImage,
      overlayOpacity: getComputedStyle(element, '::after').opacity,
      originOpacity: getComputedStyle(element.querySelector('.presentation-card-origin')).opacity,
    });
    const matches = (element, rules) => rules.map(({ selector }, index) =>
      (index === 3 ? element.querySelector('.presentation-card-origin') : element).matches(selector.replaceAll('::after', '')));
    return phases.flatMap(phase => [false, true].map(armed => {
      before.className = after.className = `battle-arena phase-${phase}${armed ? ' is-squabble-armed' : ''}`;
      return { phase, armed, before: view(before), after: view(after),
        beforeMatches: matches(before, original), afterMatches: matches(after, candidate) };
    }));
  }, { phases, original, candidate });
  for (const result of results) {
    const label = `${result.phase}, armed=${result.armed}`;
    assert.deepEqual(result.afterMatches, result.beforeMatches, `${label}: selector coverage`);
    assert.deepEqual(result.after, result.before, `${label}: computed overlay and origin presentation`);
  }
  console.log(JSON.stringify({ result: 'PASS', phases: phases.length, states: results.length,
    checked: ['selector coverage', 'overlay gradient', 'overlay opacity', 'origin opacity'] }, null, 2));
} finally { await browser.close(); }
