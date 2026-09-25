import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

// Real-click proof of the entire guided first session: welcome, the six-stop
// home tour, the deck claim handoff, Dr. Fade's welcome, and the deck lesson.
// Any coach step a genuine click/tap cannot hit or cannot advance is a soft-lock.
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23307';
const browser = await chromium.launch();

async function flow(context, label, useTap, sceneMode = 'normal') {
  const page = await context.newPage();
  const errors = [];
  let deckSaveRequest;
  page.on('pageerror', error => errors.push(error.message));
  // Regression: the 3D safehouse scene can stall or fail on real phones, and a
  // scene can report ready without ever projecting marker anchors. The guided
  // tour must stay completable in both cases.
  if (sceneMode === 'blocked') await page.route('**/scenes/**', route => route.abort());
  if (sceneMode === 'no-anchors') await page.route('**/scenes/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><script>window.parent.postMessage({channel:"squabblemon-scene",type:"ready"},location.origin);</script>',
  }));
  if (sceneMode === 'ready-partial-anchors') await page.route('**/scenes/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><script>' +
      'window.parent.postMessage({channel:"squabblemon-scene",type:"ready"},location.origin);' +
      'setTimeout(()=>window.parent.postMessage({channel:"squabblemon-scene",type:"anchors",anchors:[{id:"inventory",x:18,y:24,visible:true}]},location.origin),100);' +
      '</script>',
  }));
  await page.goto(origin + '/e2e/rookie-journey.fixture.html');
  // The workbench save calls the player-decks API; answer with the post-claim bootstrap.
  const bootstrapB = await page.evaluate(() => window.__ROOKIE_BOOTSTRAP_B);
  await page.route('**/api/player/decks/**', route => {
    deckSaveRequest = { url: route.request().url(), method: route.request().method(), body: route.request().postData() };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bootstrapB) });
  });

  // The safehouse scene churns layout while it loads; controls stay hittable
  // for real users but Playwright stability needs a longer window. A mask
  // covering the target still fails the hit test no matter the timeout.
  const act = async locator => {
    try {
      if (useTap) await locator.first().tap({ timeout: 20_000 });
      else await locator.first().click({ timeout: 20_000 });
    } catch (error) {
      const probe = await locator.first().evaluate(el => {
        const nav = el.closest('nav');
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        let chain = [];
        let node = el;
        while (node && chain.length < 8) {
          const s = getComputedStyle(node);
          chain.push(`${node.tagName}.${String(node.className).slice(0, 40)}[${s.display}/${s.visibility}/${s.opacity}${node.hidden ? '/HIDDEN-ATTR' : ''}]`);
          node = node.parentElement;
        }
        const hitter = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(','),
          style: `${cs.display}/${cs.visibility}/${cs.opacity}`,
          navHidden: nav?.hidden, fallback: nav?.dataset.guideFallback,
          hitter: hitter ? `${hitter.tagName}.${String(hitter.className).slice(0, 60)}` : 'nothing',
          chain,
        };
      }).catch(e => 'probe failed: ' + e.message);
      throw new Error(`${label}: STUCK — cannot hit target: ${String(error.message).split('\n').slice(0, 4).join(' | ')}\nprobe=${JSON.stringify(probe)}`);
    }
  };

  // Welcome stage.
  await page.locator('[data-testid="rookie-welcome"]').waitFor({ timeout: 15_000 });
  await act(page.getByRole('button', { name: 'Show me around' }));
  if (sceneMode === 'normal') await page.locator('.safehouse[data-scene-ready="true"]').waitFor({ timeout: 20_000 }).catch(() => {});

  // Home tour: six lessons. Steps with a panel button advance through it; the
  // others advance by hitting the highlighted real control.
  const spotlight = page.locator('[data-testid="fade-spotlight"]');
  for (let lesson = 1; lesson <= 6; lesson += 1) {
    const atStep = await page.waitForFunction(
      expected => document.querySelector('[data-testid="fade-spotlight"]')?.textContent?.includes(expected),
      `HOME ${lesson} / 6`, { timeout: 8_000 },
    ).then(() => true).catch(() => false);
    if (!atStep) throw new Error(`${label}: home tour never reached lesson ${lesson}; spotlight=${await spotlight.textContent().catch(() => 'gone')}`);
    const target = await spotlight.getAttribute('data-coach-target');
    if (sceneMode !== 'normal' && lesson === 2) {
      const fallbackStyle = await page.locator('[aria-label="Explore the television"]').first()
        .evaluate(el => { const s = getComputedStyle(el); return s.visibility + '/' + s.position; });
      assert.equal(fallbackStyle, 'visible/static', `${label}: fallback markers must be visible and static, got ${fallbackStyle}`);
    }
    if (sceneMode === 'ready-partial-anchors' && lesson === 2) {
      await page.locator('[aria-label="Explore your inventory bag"][data-anchor-positioned="true"]').waitFor({ timeout: 5_000 });
      const nav = page.locator('[aria-label="Explore the safehouse"]');
      assert.equal(await nav.getAttribute('data-guide-fallback'), 'true', `${label}: partial anchors must retain mixed fallback layout`);
      const positionedStyle = await page.locator('[aria-label="Explore your inventory bag"]').evaluate(el => {
        const style = getComputedStyle(el);
        return { visibility: style.visibility, position: style.position, positioned: el.getAttribute('data-anchor-positioned') };
      });
      assert.deepEqual(positionedStyle, { visibility: 'visible', position: 'absolute', positioned: 'true' },
        `${label}: the projected marker should keep its scene position`);
    }
    const panelButton = page.locator('.fade-tip button');
    if (await panelButton.count()) {
      console.log(`${label} home ${lesson}: panel button (${target})`);
      await act(panelButton);
    } else if (lesson === 6) {
      console.log(`${label} home ${lesson}: real control ${target} -> Build your gang`);
      await act(page.getByRole('button', { name: /build your gang/i }));
    } else {
      console.log(`${label} home ${lesson}: real control ${target}`);
      await act(page.locator(target));
    }
  }

  // Claim handoff -> Dr. Fade welcome -> deck workbench lesson.
  await page.locator('[data-testid="dr-fade-welcome"]').waitFor({ timeout: 8_000 });
  await act(page.getByRole('button', { name: /build with dr\. fade/i }));

  await page.waitForFunction(
    () => document.querySelector('[data-testid="fade-spotlight"]')?.getAttribute('data-coach-target') === '[data-guide-slot="5"]',
    null, { timeout: 8_000 },
  );
  const slotName = await page.locator('[data-guide-slot="5"]').first().getAttribute('aria-label');
  console.log(`${label} workbench: sixth slot = ${slotName}`);
  await act(page.locator('[data-guide-slot="5"]'));
  const recruitUp = await page.waitForFunction(
    () => document.querySelector('[data-testid="fade-spotlight"]')?.getAttribute('data-coach-target')?.startsWith('[data-guide-recruit='),
    null, { timeout: 4_000 },
  ).then(() => true).catch(() => false);
  if (!recruitUp) throw new Error(`${label}: NO PROGRESS after hitting the Rastamon slot — coach still on ${await spotlight.getAttribute('data-coach-target')}`);
  const recruit = await spotlight.getAttribute('data-coach-target');
  console.log(`${label} workbench: recruit ${recruit}`);
  await act(page.locator(recruit));
  const saveUp = await page.waitForFunction(
    () => document.querySelector('[data-testid="fade-spotlight"]')?.getAttribute('data-coach-target') === '[data-guide-save="true"]',
    null, { timeout: 4_000 },
  ).then(() => true).catch(() => false);
  if (!saveUp) throw new Error(`${label}: NO PROGRESS after hitting the recruit — coach still on ${await spotlight.getAttribute('data-coach-target')}`);
  await act(page.locator('[data-guide-save="true"]'));
  await page.locator('.game-bg').waitFor({ timeout: 10_000 });
  assert.ok(deckSaveRequest, `${label}: Save & start lesson must submit the real deck save`);
  assert.equal(deckSaveRequest.method, 'PUT', `${label}: deck save should use its real mutation method`);
  assert.match(deckSaveRequest.url, /\/api\/player\/decks\//, `${label}: deck save should target player decks`);
  assert.ok(deckSaveRequest.body, `${label}: deck save should submit its lineup`);
  assert.equal(await page.locator('[data-guide-save="true"]').count(), 0, `${label}: successful save should leave the workbench`);
  console.log(`${label}: full journey clickable — welcome, home tour, claim, real deck save, battle transition`);

  const real = errors.filter(message => !/play\(\)|NotAllowedError|NotSupportedError|audio|media/i.test(message));
  assert.deepEqual(real, [], `${label}: page errors`);
  await page.close();
}

try {
  await flow(await browser.newContext({ viewport: { width: 1440, height: 900 } }), 'desktop', false);
  await flow(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), 'phone-touch', true);
  await flow(await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true }), 'small-touch', true);
  await flow(await browser.newContext({ viewport: { width: 1440, height: 900 } }), 'desktop-no-scene', false, 'blocked');
  await flow(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), 'phone-touch-no-scene', true, 'blocked');
  await flow(await browser.newContext({ viewport: { width: 1440, height: 900 } }), 'desktop-no-anchors', false, 'no-anchors');
  await flow(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), 'phone-touch-no-anchors', true, 'no-anchors');
  await flow(await browser.newContext({ viewport: { width: 1440, height: 900 } }), 'desktop-partial-anchors', false, 'ready-partial-anchors');
  await flow(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), 'phone-touch-partial-anchors', true, 'ready-partial-anchors');
} finally {
  await browser.close();
}
console.log('Rookie journey: every guided step is hittable and advances on mouse and touch.');
