import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4288';
const output = process.env.WORLD_OUTPUT ?? '/tmp/fadewood-ui-refinement';
const boothOnly = process.env.WORLD_CASE === 'booth';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const report = [];
// Controlled acknowledgements prove host ownership. This deliberately does not certify camera or GPU rendering.
const child = `<!doctype html><html><body style="margin:0;background:linear-gradient(20deg,#445c34,#182e24);color:#fff1c4;height:100vh;display:grid;place-items:center;font:16px sans-serif"><p>BRIDGE STUB · HOST UI TEST ONLY</p><script>
let instanceId,travel,focus,failed=false;const commands=[];
function send(type,payload={}){if(type==='error')failed=true;parent.postMessage({channel:'squabblemon-fadewood',version:1,instanceId,type,...payload},location.origin)}
window.__fadewoodChild={commands,send,autoFocus:false,complete:()=>travel&&send('travelComplete',travel),completeFocus:()=>focus&&send('focusComplete',focus)};
addEventListener('message',event=>{const c=event.data;if(event.source!==parent||event.origin!==location.origin||c.channel!=='squabblemon-fadewood')return;commands.push(c);if(c.type==='init'){instanceId=c.instanceId;if(failed)send('error',{message:'Synthetic renderer failure'});else{send('progress',{progress:100,label:'Stub ready'});send('ready')}}if(c.type==='travel')travel={requestId:c.requestId,destinationId:c.destinationId};if(c.type==='focus'){focus={requestId:c.requestId,sourceId:c.sourceId};if(window.__fadewoodChild.autoFocus)send('focusComplete',focus)}});
<\/script></body></html>`;

async function setup(viewport, query = '') {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 900 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/scenes/fadewood/index.html?host=1', route => route.fulfill({ contentType: 'text/html', body: child }));
  await page.goto(`${origin}/e2e/fadewood-world.fixture.html${query}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.fadewood-world[data-world-state="ready"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const frame = page.frames().find(candidate => candidate.url().includes('/scenes/fadewood/'));
  const send = (type, payload = {}) => frame.evaluate(({ type, payload }) => window.__fadewoodChild.send(type, payload), { type, payload });
  const last = async type => (await frame.evaluate(() => window.__fadewoodChild.commands)).findLast(command => command.type === type);
  const waitForCommand = (type, oldId) => frame.waitForFunction(({ type, oldId }) => {
    const latest = window.__fadewoodChild.commands.findLast(command => command.type === type);
    return latest && latest.requestId !== oldId;
  }, { type, oldId });
  const acknowledgeFocus = async oldId => { await waitForCommand('focus', oldId); await frame.evaluate(() => window.__fadewoodChild.completeFocus()); };
  const autoFocus = () => frame.evaluate(() => { window.__fadewoodChild.autoFocus = true; });
  return { context, page, frame, send, last, waitForCommand, acknowledgeFocus, autoFocus, errors };
}
async function fits(locator) {
  return locator.evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, fits: r.x >= 0 && r.right <= innerWidth + 1 && r.y >= 0 && r.bottom <= innerHeight + 1 }; });
}
try {
  for (const [name, width, height] of (boothOnly ? [] : [['desktop', 1440, 960], ['phone', 390, 844], ['small-phone', 320, 568], ['landscape', 844, 390]])) {
    const { context, page, frame, send, last, waitForCommand, acknowledgeFocus, autoFocus, errors } = await setup({ width, height });
    const continueButton = page.getByTestId('button-continue-story');
    const dialog = page.locator('.fadewood-world__dialog');
    const continueGeometry = await fits(continueButton);
    assert(continueGeometry.fits && continueGeometry.height >= 44);
    assert.equal(await page.getByRole('button', { name: /^Open Mailman deliveries/ }).count(), 0, 'Mail lives in the scene or menu');

    // A valid source and current focus acknowledgement are required before a sheet can open.
    await page.evaluate(() => postMessage({ channel: 'squabblemon-fadewood', version: 1, instanceId: 'forged', type: 'inspect', sourceId: 'cornball' }, location.origin));
    assert.equal(await dialog.isVisible(), false);
    await send('inspect', { sourceId: 'cornball' });
    await waitForCommand('focus');
    const cancelledFocus = await last('focus');
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0, 'Sheet waits for camera framing');
    await send('focusComplete', { requestId: cancelledFocus.requestId, sourceId: 'wifey' });
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0, 'Wrong source cannot release the sheet');
    await page.getByRole('button', { name: 'Cancel character interaction' }).click();
    await frame.evaluate(() => window.__fadewoodChild.completeFocus());
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0, 'Late cancelled focus cannot reopen a sheet');
    await send('inspect', { sourceId: 'cornball' });
    await acknowledgeFocus(cancelledFocus.requestId);
    await page.getByRole('heading', { name: 'Cornball', exact: true }).waitFor();
    const characterGeometry = await fits(dialog);
    assert(characterGeometry.fits && characterGeometry.scrollWidth <= characterGeometry.clientWidth + 1);
    assert.equal(await dialog.getByRole('button', { name: 'Enter Fade Market', exact: true }).count(), 1);
    await page.locator('.fadewood-character-panel__photo img').evaluate(image => image.decode());
    const primaryGeometry = await fits(dialog.getByRole('button', { name: 'Continue The Block Crown', exact: true }));
    assert(primaryGeometry.fits && primaryGeometry.height >= 44, `${name}: character Continue keeps a visible 44px target`);
    await page.screenshot({ path: join(output, `${name}-character.png`) });
    await page.getByRole('button', { name: 'Close world menu' }).click();

    // Travel and framing bring the player to a choice, never straight into Story.
    await continueButton.click(); await waitForCommand('travel');
    const firstTravel = await last('travel');
    await page.getByRole('button', { name: 'Cancel fast travel' }).click();
    await frame.evaluate(() => window.__fadewoodChild.complete());
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0);
    await continueButton.click(); await waitForCommand('travel', firstTravel.requestId);
    const nextTravel = await last('travel');
    await send('travelComplete', { requestId: nextTravel.requestId, destinationId: 'wrong-place' });
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0);
    const oldFocus = (await last('focus')).requestId;
    await frame.evaluate(() => window.__fadewoodChild.complete());
    await waitForCommand('focus', oldFocus);
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0, 'Host panel waits for matching focus after arrival');
    await frame.evaluate(() => window.__fadewoodChild.completeFocus());
    await page.locator('.fadewood-character-panel').waitFor();
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0, 'Arrival never starts Story without the player choosing Continue');
    const arrivedFocus = await last('focus');
    await page.mouse.click(2, height / 2);
    await page.locator('.fadewood-character-panel').waitFor({ state: 'detached' });
    await send('focusComplete', { requestId: arrivedFocus.requestId, sourceId: arrivedFocus.sourceId });
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0, 'A dismissed arrival cannot be reopened by a late camera receipt');
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0);
    await continueButton.click(); await waitForCommand('travel', nextTravel.requestId);
    await frame.evaluate(() => window.__fadewoodChild.complete());
    await acknowledgeFocus(arrivedFocus.requestId);
    await page.locator('.fadewood-character-panel').waitFor();
    await page.getByRole('button', { name: 'Continue The Block Crown', exact: true }).click();
    await page.getByTestId('fixture-story-overlay').waitFor();
    assert.equal(frame.isDetached(), false);
    await page.getByRole('button', { name: 'Return to world', exact: true }).click();

    // Fast travel reaches Safehouse, while explicit entry routes directly without another sheet.
    await autoFocus();
    await page.getByRole('button', { name: 'Open map and fast travel' }).click();
    const beforeSafehouseTravel = (await last('travel')).requestId;
    const beforeSafehouseFocus = (await last('focus')).requestId;
    await page.getByRole('button', { name: 'Fast travel to Safehouse', exact: true }).click();
    await waitForCommand('travel', beforeSafehouseTravel);
    await frame.evaluate(() => window.__fadewoodChild.complete());
    await page.getByTestId('button-continue-story').waitFor();
    assert.equal(await page.locator('[data-fixture-route]').getAttribute('data-fixture-route'), '/game/story');
    assert.equal((await last('focus')).requestId, beforeSafehouseFocus, 'Safehouse travel does not force a character interaction');
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0);
    await send('state', { playing: true, travel: false, checkpoint: { position: [1, 0, 2], yaw: 0 }, nearest: { id: 'safehouse-door', name: 'Safehouse', kind: 'portal' } });
    const nearby = page.locator('.fadewood-world__nearby');
    await nearby.waitFor();
    const nearbyGeometry = await fits(nearby); assert(nearbyGeometry.fits && nearbyGeometry.height >= 44);
    assert.equal(await nearby.getAttribute('aria-label'), 'Enter Safehouse');
    await nearby.click();
    await page.waitForFunction(() => document.querySelector('[data-fixture-route]')?.getAttribute('data-fixture-route') === '/game');
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0);
    assert.equal((await last('focus')).requestId, beforeSafehouseFocus, 'Explicit Safehouse entry is immediate, without a camera/sheet detour');

    // Nova is a memorial, never a route or commerce menu.
    await send('inspect', { sourceId: 'nova' });
    await dialog.getByRole('heading', { name: 'Nova', exact: true }).waitFor();
    assert.equal(await dialog.getByText('Always part of the block.', { exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('button').count(), 2);
    assert.equal(await dialog.getByRole('button', { name: 'Close world menu', exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('button', { name: 'Keep exploring', exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('link').count(), 0);
    await dialog.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    assert.equal(await page.locator('[data-fixture-route]').getAttribute('data-fixture-route'), '/game');
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0);

    // Touch also reaches completed/unmarked venues with source-specific permitted actions.
    await send('inspect', { sourceId: 'og-blue' }); await page.getByRole('heading', { name: 'OG Blue', exact: true }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: /Continue Season/ }).count(), 0);
    assert.equal(await dialog.getByRole('button', { name: 'Friendly Fades', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Close world menu' }).click();

    // Real Mailman read/claim component, under this fixture's synthetic API only.
    await frame.evaluate(() => { window.__fadewoodChild.autoFocus = false; });
    const previousFocus = (await last('focus')).requestId;
    await send('inspect', { sourceId: 'mailman' }); await waitForCommand('focus', previousFocus);
    assert.equal(await page.locator('.mail-delivery[open]').count(), 0, 'Mail waits for Mailman framing');
    await page.getByRole('button', { name: 'Cancel character interaction' }).click();
    await frame.evaluate(() => window.__fadewoodChild.completeFocus());
    assert.equal(await page.locator('.mail-delivery[open]').count(), 0, 'Cancelled framing cannot show late mail');
    await autoFocus(); await send('inspect', { sourceId: 'mailman' });
    await page.locator('.mail-delivery[open]').waitFor();
    await page.getByRole('button', { name: /A little something for the block/ }).click();
    await page.getByRole('button', { name: 'Claim your gift' }).click();
    await page.getByRole('button', { name: 'Gift claimed ✓' }).waitFor();
    await page.getByRole('button', { name: 'Close mail' }).click();

    // Existing modal ownership cancels travel and ignores later completion.
    await continueButton.click(); await page.getByRole('button', { name: 'Cancel fast travel' }).waitFor();
    await page.evaluate(() => { const d = document.createElement('dialog'); d.id = 'external-fixture-dialog'; document.body.append(d); d.showModal(); });
    await page.waitForFunction(() => !document.querySelector('.fadewood-world__travel'));
    await frame.evaluate(() => window.__fadewoodChild.complete());
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0);
    await page.evaluate(() => document.getElementById('external-fixture-dialog').remove());

    // The actual shared Express artwork, eight sign stops per page, all registry places reachable.
    await page.getByRole('button', { name: 'Open map and fast travel' }).click();
    await page.locator('.fadewood-express').waitFor();
    const expressGeometry = await fits(dialog);
    assert(expressGeometry.fits && expressGeometry.scrollWidth <= expressGeometry.clientWidth + 1);
    assert.equal(await page.locator('.express-board__art').getAttribute('src'), '/brand/navigation/squabble-express-map.webp');
    const mapTargets = await page.locator('.express-map__stops button').evaluateAll(buttons => buttons.map(button => {
      const r = button.getBoundingClientRect(), map = button.closest('.express-map').getBoundingClientRect(), text = button.querySelector('strong');
      return { label: button.getAttribute('aria-label') ?? text.textContent, height: r.height, insideMap: r.left >= map.left - 2 && r.right <= map.right + 2 && r.bottom <= map.bottom + 2, textFits: text.scrollWidth <= text.clientWidth + 1 };
    }));
    assert(mapTargets.every(target => target.height >= 44 && target.insideMap && target.textFits), `${name}: all eight map signs keep 44px targets and fit the map`);
    await page.screenshot({ path: join(output, `${name}-express.png`) });
    const stops = new Set();
    for (let index = 0; index < 6; index++) {
      const buttons = page.locator('.express-map__stops button'); assert(await buttons.count() <= 8);
      for (const label of await buttons.evaluateAll(items => items.map(item => item.getAttribute('aria-label')).filter(Boolean))) stops.add(label);
      const next = page.getByRole('button', { name: index === 0 ? 'Back streets' : 'More stops', exact: true });
      if (!await next.count()) break;
      await next.click();
    }
    assert(stops.has('Fast travel to Post Office') && stops.has('Fast travel to Story mural') && stops.has('Fast travel to Anunaki UFO'));
    await page.getByRole('button', { name: 'Story hosts', exact: true }).click();
    await page.locator('.fadewood-express__poster-rail').waitFor();
    await page.locator('.fadewood-express__poster img').evaluateAll(images => Promise.all(images.slice(0, 3).map(image => image.decode())));
    await page.screenshot({ path: join(output, `${name}-story-hosts.png`) });
    await page.getByRole('button', { name: /View The Anunaki Arrival with Anunaki UFO/ }).click();
    assert.equal(await page.locator('.fadewood-express__story-ticket').getByRole('button', { name: /^Continue/ }).count(), 0);
    assert.equal(await page.locator('.fadewood-express__story-ticket').getByRole('button', { name: 'View chapters' }).count(), 1);
    await page.keyboard.press('Escape');
    await send('error', { message: 'Synthetic renderer failure' });
    await page.getByRole('button', { name: 'Retry the world' }).waitFor();
    assert.deepEqual(errors, []);
    report.push({ name, evidence: 'controlled bridge stub, actual host presentation and synthetic campaign/mail API', continueGeometry, characterGeometry, primaryGeometry, expressGeometry, nearbyGeometry, mapTargets, stops: [...stops], focusGating: true, staleFocusRejected: true, arrivalChoice: true, clickAwayAndReopen: true, directSafehouseEntry: true, novaMemorialOnly: true, mailClaim: true, errors });
    await context.close(); console.log(`${name}: Express, character art, camera gates, Story, Mailman and nearby controls passed.`);
  }

  for (const [scenario, sourceId, arcId, title, nodeId] of (boothOnly ? [] : [['cornball-s2', 'cornball', 'season-2', 'Blockbuster on the Block', 's2-the-morning-after-opening'], ['snitch-sherlock', 'snitch', 'special-sherlock', 'The Missing Motion', 'sherlock-three-bad-alibis']])) {
    const { context, page, send, autoFocus, errors } = await setup({ width: 390, height: 844 }, `?dynamic=${scenario}`);
    await autoFocus();
    await send('state', { playing: true, travel: false, checkpoint: { position: [1, 0, 2], yaw: 0 }, markers: [{ arcId, sourceId, label: title, x: 50, y: 45, visible: true }] });
    await page.getByRole('button', { name: `View ${title} with ${sourceId === 'snitch' ? 'Snitch' : 'Cornball'}` }).click();
    await page.locator('.fadewood-character-panel__story').getByRole('heading', { name: title, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: `Continue ${title}`, exact: true }).isEnabled(), true);
    if (sourceId === 'cornball') assert.equal(await page.getByRole('button', { name: 'Enter Fade Market', exact: true }).count(), 1);
    await page.getByRole('button', { name: `Continue ${title}`, exact: true }).click();
    await page.getByTestId('fixture-story-overlay').waitFor();
    assert((await page.getByTestId('fixture-story-overlay').innerText()).includes(nodeId));
    assert.deepEqual(errors, []);
    report.push({ scenario, preferredArc: arcId, correctNode: nodeId, focusedCharacterContinuesDirectly: true });
    await context.close();
  }
  if (!boothOnly) console.log('Dynamic Cornball Season Two and Snitch Sherlock panels preserve their correct stories.');

  // The new contextual booth is reachable, preserves both characters, and promises no live gameplay.
  {
    const { context, page, frame, send, last, waitForCommand, autoFocus, errors } = await setup({ width: 320, height: 568 });
    await autoFocus();
    await send('state', { playing: true, travel: false, checkpoint: { position: [8.1, 0.261, -3.6], yaw: 0 }, nearest: { id: 'demario-luigion-booth', name: 'DeMario & Luigion', kind: 'portal' } });
    await page.getByRole('button', { name: 'Open DeMario & Luigion', exact: true }).click();
    const dialog = page.locator('.fadewood-world__dialog');
    await dialog.getByRole('heading', { name: 'DeMario & Luigion', exact: true }).waitFor();
    assert.equal(await dialog.getByText('SMOKE SHOP', { exact: true }).count(), 1);
    assert.equal(await dialog.getByText('Their story is coming to this corner.', { exact: true }).count(), 1);
    assert.equal(await dialog.getByText('Chapter in development', { exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('button').count(), 3);
    assert.equal(await dialog.getByRole('button', { name: /^Continue|Claim|Buy|Enter shop/ }).count(), 0);
    assert.equal(await dialog.getByRole('link').count(), 0);
    const portraits = page.locator('.fadewood-character-panel__photo img');
    await portraits.evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.deepEqual(await portraits.evaluateAll(images => images.map(image => ({ alt: image.alt, path: new URL(image.src).pathname, fit: getComputedStyle(image).objectFit }))), [
      { alt: 'DeMario', path: '/assets/characters/demario.webp', fit: 'contain' },
      { alt: 'Luigion', path: '/assets/characters/luigion.webp', fit: 'contain' },
    ]);
    const geometry = await fits(dialog);
    assert(geometry.fits && geometry.scrollWidth <= geometry.clientWidth + 1);
    const dismiss = dialog.getByRole('button', { name: 'Keep exploring', exact: true });
    await dismiss.scrollIntoViewIfNeeded();
    const dismissGeometry = await fits(dismiss); assert(dismissGeometry.fits && dismissGeometry.height >= 44);
    await page.screenshot({ path: join(output, 'small-phone-demario-luigion.png') });
    await dismiss.click();
    await page.getByRole('button', { name: 'Open map and fast travel' }).click();
    await page.getByRole('button', { name: 'Back streets', exact: true }).click();
    await page.getByRole('button', { name: 'More stops', exact: true }).click();
    const stop = page.getByRole('button', { name: 'Fast travel to DeMario & Luigion', exact: true });
    const stopGeometry = await fits(stop); assert(stopGeometry.fits && stopGeometry.height >= 44);
    assert.equal(await stop.locator('strong').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
    await stop.click(); await waitForCommand('travel');
    assert.equal((await last('travel')).destinationId, 'demario-luigion-booth');
    await frame.evaluate(() => window.__fadewoodChild.complete());
    await page.getByTestId('button-continue-story').waitFor();
    assert.equal(await page.locator('.fadewood-character-panel').count(), 0, 'Booth fast travel leaves inspection to the player');
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0);
    assert.equal(await page.locator('[data-fixture-route]').getAttribute('data-fixture-route'), '/game/story');
    await send('error', { message: 'Synthetic renderer failure' });
    await page.getByRole('button', { name: 'Retry the world' }).waitFor();
    await page.getByTestId('button-continue-story').click();
    await page.locator('.fadewood-character-panel').waitFor();
    assert.equal(await page.getByTestId('fixture-story-overlay').count(), 0, 'A failed renderer still preserves the explicit Story choice');
    await page.getByRole('button', { name: 'Continue The Block Crown', exact: true }).click();
    await page.getByTestId('fixture-story-overlay').waitFor();
    assert.deepEqual(errors, []);
    report.push({ scenario: 'demario-luigion-booth', viewport: { width: 320, height: 568 }, geometry, dismissGeometry, stopGeometry, canonicalPortraits: true, contextualOnly: true, expressTravel: true, fallbackExplicitStoryChoice: true, errors });
    await context.close(); console.log('DeMario & Luigion booth: canonical art, honest draft copy, dismiss-only context and Express travel passed.');
  }
} finally {
  await browser.close(); await writeFile(join(output, 'host-ui-verification.json'), JSON.stringify(report, null, 2));
}
