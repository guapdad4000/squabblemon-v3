import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const sourceRoot = new URL('../src/', import.meta.url);
const replacement = '.panel-section:not(.profile-progress-paper, .profile-badges-paper)';
const original = '.panel-section:not([class*=-paper])';
const css = await readFile(new URL('styles/tokens.css', sourceRoot), 'utf8');
assert.equal(css.split(replacement).length - 1, 9);
assert.ok(!css.includes(original));
const beforeCss = css.replaceAll(replacement, original);
const panelClasses = new Set();
for (const file of await readdir(sourceRoot, { recursive: true })) {
  if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
  const source = await readFile(new URL(file, sourceRoot), 'utf8');
  for (const match of source.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{([^\n]*?)\})/g)) {
    const classes = match[1] ?? match[2] ?? match[3];
    if (!/(?:^|\s)panel-section(?:\s|$)/.test(classes)) continue;
    assert.equal(match[3], undefined, `${file}: enumerate dynamic panel surfaces before changing paper exclusions`);
    panelClasses.add(classes);
  }
}
const paperClasses = [...new Set([...panelClasses].flatMap(value => value.split(/\s+/).filter(name => name.includes('-paper'))))].sort();
assert.deepEqual(paperClasses, ['profile-badges-paper', 'profile-progress-paper'], 'New paper panels must be added to the explicit exclusion and parity cases');
assert.ok(panelClasses.size >= 5);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  const surfaces = [...panelClasses, 'glass-panel', 'sq-card-lift bg-card', 'bg-background', 'corner-store__counter', 'plain', 'panel-section profile-progress-paper glass-panel', 'panel-section profile-badges-paper sq-card-lift bg-card'];
  const content = `<h1>Heading</h1><h2>Heading</h2><h3>Heading</h3><h4>Heading</h4><h5>Heading</h5><h6>Heading</h6>
    <p>Paragraph</p><p>Second paragraph</p><label>Label</label><p>Label help</p><small>Small</small><strong>Strong</strong><legend>Legend</legend><span>Span</span><div>Block</div>
    <button><span>Button span</span><div><strong>Nested button text</strong></div></button><a href="#"><span>Link</span></a>
    <input value="Input"><select><option>Option</option></select><textarea>Text area</textarea>
    <div role="switch"><span>Switch text</span></div><div role="checkbox"><span>Checkbox text</span></div>
    <div class="profile-style-details"><div>Detail</div><dl><dt>Term</dt><dd>Value</dd></dl></div>
    <div class="bg-white/50">Half white</div><div class="bg-white/70">White seventy</div><div class="bg-white">White</div>
    <section class="panel-section profile-progress-paper"><span>Nested paper</span></section>
    <section class="glass-panel"><span>Nested glass</span><button><span>Nested control</span></button></section>`;
  await page.setContent(`<style id="tokens"></style><style id="overrides"></style><main>${surfaces.map((classes, index) => `<section data-case="${index}" class="${classes}" ${classes === 'bg-background' ? 'role="dialog"' : ''}>${content}</section>`).join('')}</main>`);
  const snapshot = () => page.evaluate(() => Array.from(document.querySelectorAll('main, main *'), element => {
    const style = getComputedStyle(element);
    return Object.fromEntries(['color', 'text-shadow', 'background-color', 'background-image', 'background-size', 'background-position', 'border-color', 'border-top-color', 'padding', 'border-radius'].map(property => [property, style.getPropertyValue(property)]));
  }));
  const apply = styles => page.locator('#tokens').evaluate((node, value) => { node.textContent = value; }, styles);
  let comparisons = 0;
  for (const override of ['', 'html section.panel-section span { color: rgb(11, 22, 33) !important; text-shadow:none; }', 'html section.panel-section.profile-progress-paper span { color: rgb(44, 55, 66) !important; }']) {
    await page.locator('#overrides').evaluate((node, value) => { node.textContent = value; }, override);
    await apply(beforeCss);
    const before = await snapshot();
    await apply(css);
    assert.deepEqual(await snapshot(), before, 'Panel surfaces, text, nested controls and cascade preserve computed styles');
    comparisons += before.length;
  }
  for (const classes of ['panel-section', 'panel-section profile-progress-paper', 'panel-section profile-badges-paper']) {
    const index = surfaces.indexOf(classes);
    for (const background of ['bg-white/50', 'bg-white/70']) {
      await page.locator(`[data-case="${index}"]`).locator(`[class="${background}"]`).first().hover();
      await apply(beforeCss);
      const before = await snapshot();
      await apply(css);
      assert.deepEqual(await snapshot(), before, 'Chalkboard hover surfaces preserve computed styles');
      comparisons += before.length;
    }
  }
  await page.close();

  // Chrome invalidation events prove unrelated phase classes no longer dirty all
  // descendant text. These are scope checks, not application timing claims.
  async function invalidationCount(styles) {
    const probe = await browser.newPage();
    await probe.route('**/*', route => route.abort());
    await probe.setContent(`<style>${styles}</style><main id="phase-host" class="phase-ready">${'<div><span>Card text</span><h4>Card name</h4></div>'.repeat(120)}</main>`);
    const session = await probe.context().newCDPSession(probe);
    const events = [];
    session.on('Tracing.dataCollected', ({ value }) => events.push(...value));
    await session.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking', transferMode: 'ReportEvents' });
    await probe.evaluate(async () => {
      for (let index = 0; index < 4; index++) {
        document.querySelector('#phase-host').className = index % 2 ? 'phase-impact' : 'phase-effects';
        document.querySelector('#phase-host span').getBoundingClientRect();
        await new Promise(requestAnimationFrame);
      }
    });
    const done = new Promise(resolve => session.once('Tracing.tracingComplete', resolve));
    await session.send('Tracing.end');
    await done;
    const counts = { classSchedules: 0, descendantTextInvalidations: 0 };
    for (const event of events) {
      const data = event.args?.data;
      if (event.name === 'ScheduleStyleInvalidationTracking' && data?.changedAttribute === 'class' && data.nodeName?.includes('phase-host')) counts.classSchedules++;
      if (event.name === 'StyleInvalidatorInvalidationTracking' && data?.reason === 'Invalidation set matched tagName' && data.selectors?.some(({ selector }) => selector.includes('panel-section'))) counts.descendantTextInvalidations++;
    }
    await session.detach();
    await probe.close();
    return counts;
  }
  const beforeInvalidation = await invalidationCount(beforeCss);
  const afterInvalidation = await invalidationCount(css);
  assert.ok(beforeInvalidation.classSchedules >= 4 && beforeInvalidation.descendantTextInvalidations >= 1000, `Reproduce traced class invalidation: ${JSON.stringify(beforeInvalidation)}`);
  assert.deepEqual(afterInvalidation, { classSchedules: 0, descendantTextInvalidations: 0 });
  console.log(JSON.stringify({ result: 'PASS', sourcePanelClasses: [...panelClasses], paperClasses, surfaces: surfaces.length, comparisons, beforeInvalidation, afterInvalidation }, null, 2));
} finally { await browser.close(); }
