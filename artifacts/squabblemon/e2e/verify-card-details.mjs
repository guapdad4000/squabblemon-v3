import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const port = process.env.CARD_DETAILS_PORT ?? '4185';
const origin = `http://127.0.0.1:${port}/squabblemon`;
const server = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port], {
  env: { ...process.env, PORT: port, BASE_PATH: '/squabblemon/', VITE_E2E_AUTH: 'true' }, stdio: 'ignore', windowsHide: true,
});
const report = { checks: [], errors: [], complete: false };
let browser, activePage;
const sizes = [['phone',390,844,true],['small-phone',320,740,true],['tall-phone',430,932,true],['landscape',844,390,true],['tablet',820,1180,true],['desktop',1440,960,false]];

async function hold(page, card, touch) {
  await card.scrollIntoViewIfNeeded();
  const bounds = await card.boundingBox(); assert.ok(bounds);
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await page.getByRole('dialog').waitFor();
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, y); await page.mouse.down();
    await page.getByRole('dialog').waitFor(); await page.mouse.up();
  }
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole('dialog').count(), 1, 'Releasing the hold does not dismiss the card');
}

async function verifyDetails(page, name, mode, width, height, touch) {
  const dialog = page.locator('.card-inspector-shell');
  const close = page.getByRole('button', { name: 'Close card details', exact: true });
  assert.equal(await close.count(), 1, 'One clear close control');
  const bounds = await close.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, 'Close remains in the viewport');
  assert.ok(bounds.width >= 48 && bounds.height >= 48, 'Close is an easy touch target');
  assert.equal(await close.evaluate(button => button.contains(document.elementFromPoint(button.getBoundingClientRect().x + 20, button.getBoundingClientRect().y + 20))), true, 'The close control is above the artwork');
  const geometry = await dialog.evaluate(element => {
    const card = element.querySelector('.collector-card');
    const copy = card.querySelector('.collector-card-copy');
    const effect = card.querySelector('.collector-card-ability > div:last-child');
    const rect = card.getBoundingClientRect(), copyRect = copy.getBoundingClientRect();
    const scroller = element.querySelector('.card-inspector-scroll');
    return { shell: { width: element.clientWidth, height: element.clientHeight }, width: scroller.clientWidth, scrollWidth: scroller.scrollWidth, cardBottom: rect.bottom, copyBottom: copyRect.bottom, effectTop: effect.getBoundingClientRect().top, cardMiddle: rect.y + rect.height / 2, effectFont: parseFloat(getComputedStyle(effect).fontSize), top: getComputedStyle(copy).top, bottom: getComputedStyle(copy).bottom };
  });
  assert.equal(geometry.shell.height, height);
  assert.ok(geometry.scrollWidth <= geometry.width + 1, 'Details do not scroll sideways');
  assert.ok(Math.abs(geometry.copyBottom - geometry.cardBottom) <= 18, 'Description sits at the card bottom');
  assert.ok(geometry.effectTop > geometry.cardMiddle && geometry.effectFont >= 11, 'Description is readable in the lower half');
  assert.ok(await dialog.locator('[data-testid=card-inspector] h4').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Card name fits its artwork width');
  assert.equal(await dialog.locator('.collector-card img').evaluateAll(images => images.every(image => image.draggable === false)), true, 'Card artwork is not natively draggable');
  assert.equal(await dialog.locator('.collector-card').evaluateAll(cards => cards.every(card => getComputedStyle(card).userSelect === 'none')), true, 'Card artwork cannot be selected like webpage content');
  const paper = dialog.locator('.dossier-paper');
  const paperCheck = await paper.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const referee = element.querySelector('.dr-fade-referee').getBoundingClientRect();
    const content = [...element.querySelectorAll('.dossier-banner,.dossier-name,.dossier-handle,.dossier-sticky,.dossier-stats,.dossier-notes,.dossier-section,.dossier-vitals')];
    return {
      refereeOverlaps: referee.top < rect.top && referee.bottom > rect.top,
      refereeTop: referee.top, paperTop: rect.top, refereeBottom: referee.bottom,
      outside: content.filter(node => {
        if (!node.getClientRects().length) return false;
        const box = node.getBoundingClientRect();
        return box.left < rect.left - 2 || box.right > rect.right + 2 || box.top < rect.top - 2 || box.bottom > rect.bottom + 2;
      }).map(node => ({className: node.className, rect: node.getBoundingClientRect().toJSON(), paper: rect.toJSON()})),
      background: getComputedStyle(element).backgroundColor,
      stamp: getComputedStyle(element.querySelector('.dossier-banner__stamp')).backgroundImage,
      clip: getComputedStyle(element, '::before').content !== 'none',
    };
  });
  assert.ok(paperCheck.refereeOverlaps && paperCheck.clip, `Referee and clip cross the paper edge: ${JSON.stringify(paperCheck)}`);
  assert.deepEqual(paperCheck.outside, [], 'Resume content remains inside the paper');
  assert.match(paperCheck.stamp, /classified-stamp\.png/, 'Transparent stamp is used');
  if (mode === 'battle' && name === 'desktop') {
    const ink = await page.evaluate(async () => {
      const paths = ['classified-stamp.png', 'scout-stamp.png'];
      return Promise.all(paths.map(async file => {
        const image = new Image();
        image.src = `${location.pathname.split('/e2e/')[0]}/assets/inspector/${file}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let clear = 0, printed = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 20) clear++;
          if (data[i] > 180) printed++;
        }
        return { clear, printed };
      }));
    });
    assert.ok(ink.every(stamp => stamp.clear > 1000 && stamp.printed > 1000), 'Both distressed stamps contain transparent paper and opaque ink');
  }
  // Stress unusually long live copy without changing the fixture's game data.
  await paper.evaluate(element => {
    element.querySelector('.dossier-name').textContent = 'ExtraordinaryUnbrokenFighterNameThatMustStayOnPaper';
    element.querySelector('.dossier-sticky__title').textContent = 'ExtraordinaryUnbrokenSignatureAbility';
    element.querySelector('.dossier-sticky__copy').textContent = 'A lengthy effect that stays on the clipboard. '.repeat(18);
    element.querySelector('.dossier-notes').append(' A scout memo that keeps going.'.repeat(12));
  });
  assert.ok(await paper.evaluate(element => {
    const paper = element.getBoundingClientRect();
    return [...element.querySelectorAll('.dossier-name,.dossier-sticky__title,.dossier-sticky__copy,.dossier-notes')].every(node => {
      const box = node.getBoundingClientRect();
      return box.left >= paper.left - 2 && box.right <= paper.right + 2 && box.bottom <= paper.bottom + 2;
    });
  }), 'Long name, ability, effect, and notes remain on paper');
  await page.screenshot({ path: `../../screenshots/card-details-${mode}-${name}.jpg`, type: 'jpeg', quality: 85 });
  // Scrolling either the portrait page or desktop dossier must not move dismissal.
  await page.locator('.card-inspector-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.locator('.dossier-paper').evaluate(element => { element.scrollTop = element.scrollHeight; });
  const after = await close.boundingBox();
  assert.equal(after.y, bounds.y, 'Close remains pinned after scrolling');
  assert.equal(after.x, bounds.x);
  if (touch) await close.tap(); else await close.click();
  await dialog.waitFor({ state: 'detached' });
  report.checks.push(`${name}: ${mode} opens, scrolls, shows bottom descriptions, and closes with a real ${touch ? 'tap' : 'click'}`);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin + '/')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Preview server starts');
  browser = await chromium.launch({ headless: true });
  for (const [name,width,height,touch] of sizes.filter(([name]) => !process.env.CARD_DETAILS_SIZES || process.env.CARD_DETAILS_SIZES.split(',').includes(name))) {
    const context = await browser.newContext({ viewport: {width,height}, hasTouch: touch, isMobile: touch, reducedMotion: name === 'desktop' ? 'no-preference' : 'reduce' });
    await context.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    const page = activePage = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
    await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
    await page.goto(origin + '/e2e/card-inspection.fixture.html');
    await page.getByRole('button', {name:'solo',exact:true}).click();
    const card = page.getByTestId('hand-tray').locator('[data-card-id="cornball"]');
    await hold(page, card, touch);
    await verifyDetails(page,name,'battle',width,height,touch);
    assert.equal(await card.evaluate(element => document.activeElement === element), true, 'Closing returns focus to the inspected card');
    if (touch) await card.tap(); else await card.click();
    assert.equal(await card.getAttribute('aria-pressed'), 'true', 'Battle input works immediately after closing');

    await page.goto(origin + '/game/collection');
    const collectionCard = page.getByTestId('collection-card-control').filter({ has: page.locator('[data-card-id="cornball"]') });
    await collectionCard.waitFor();
    if (touch) await collectionCard.tap(); else await collectionCard.click();
    await page.getByRole('dialog').waitFor();
    await verifyDetails(page,name,'collection',width,height,touch);
    await collectionCard.focus(); await page.keyboard.press('Alt+Enter');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.card-inspector-shell').evaluate(element => element.contains(document.activeElement)), true, 'Keyboard focus stays in details');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'detached'});
    assert.equal(await collectionCard.evaluate(element => document.activeElement === element), true, 'Escape restores collection focus');
    if (name === 'phone') {
      // Exercise the user's actual battle route, including the PlayLoop overlay parent.
      await page.goto(origin + '/play/guest');
      await page.getByTestId('button-start').click();
      await page.getByTestId('battle-arena').waitFor();
      for (let attempt = 0; attempt < 120; attempt++) {
        if (await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').count()) break;
        const skip = page.getByTestId('button-fast-forward');
        if (await skip.count()) await skip.click({timeout:500}).catch(() => {});
        await page.waitForTimeout(100);
      }
      await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').waitFor();
      const hand = page.getByTestId('hand-tray').locator('[data-card-id]').first();
      const cardId = await hand.getAttribute('data-card-id');
      await hold(page, hand, true);
      await verifyDetails(page,name,'guest-battle',width,height,true);
      await hand.tap();
      assert.equal(await hand.getAttribute('aria-pressed'), 'true', 'Actual guest battle resumes after dismissal');
      await page.getByRole('button',{name:/^Deploy /}).first().tap();
      await page.getByTestId('button-lock').tap();
      const playedCard = page.locator(`[data-testid^="card-board-player-"][data-card-id="${cardId}"]`).first();
      await playedCard.waitFor(); await playedCard.tap();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('button', {name:'Close card details',exact:true}).tap();
      await page.getByRole('dialog').waitFor({state:'detached'});
      report.checks.push('Actual portrait guest battle: hand inspection, return to battle, play card, inspect played card, and close all succeed');
      // Existing hold/drag regression fixture covers mouse, touch, pen, cancellation, and online.
      await page.goto(origin + '/e2e/card-inspection.fixture.html');
      await page.getByRole('button',{name:'Run gesture checks',exact:true}).click();
      await page.waitForFunction(() => /ALL CHECKS PASSED|FAIL/.test(document.querySelector('[data-testid="gesture-results"]').textContent), null, {timeout:60000});
      const results = await page.getByTestId('gesture-results').innerText();
      assert.ok(results.includes('ALL CHECKS PASSED'), results);
      report.checks.push('Existing card gesture suite passes for deck, solo, waiting, and online modes');
    }
    console.log(`${name}: battle and collection dismissal, scrolling, text position, and keyboard checks passed.`);
    await context.close(); activePage = null;
  }
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch(error) {
  report.failure = String(error.stack ?? error);
  await activePage?.screenshot({path:'../../screenshots/card-details-failure.jpg',type:'jpeg',quality:85}).catch(() => {});
  throw error;
} finally {
  await browser?.close(); server.kill();
  await writeFile('../../screenshots/card-details-verification.json', JSON.stringify(report,null,2));
}
