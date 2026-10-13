import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Exercise the real App -> GameApp -> /game/kumite route with all production
// CSS and providers. The auth/account/API payloads are local review fixtures.
// No scrollIntoView, window.scrollTo, or programmatic scroll writes are used:
// lower content must be reached with browser touch input, just as on a phone.
const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43235';
const output = process.env.KUMITE_OUTPUT ?? fileURLToPath(new URL('../../deliverables/kumite-mobile-review/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
});
const report = { evidence: 'Actual local App and GameApp routing, production global styles, intercepted account/tournament APIs, Chromium touch input. No deployed account or iOS-device claim.', complete: false, checks: [], homeChecks: [] };

function snapshot() {
  const now = Date.now();
  const cards = [
    ['bushedo-brown', 'Bushedo Brown', 'Rare', 'Complete 1 full fight', 1],
    ['franklin-duke', 'Franklin Duke', 'Epic', 'Win 1 full fight', 1],
    ['chonk-lee', 'Chonk Lee', 'Legendary', 'Win 1 full final', 1],
    ['dragonfly-jones', 'Dragonfly Jones', 'Legendary', 'Win 3 full fights', 3],
    ['undercova-brotha', 'Undercova Brotha', 'Rare', 'Win 5 full fights', 5],
    ['sho-nuff', "Sho'Nuff", 'Legendary', 'Win 8 full fights', 8],
    ['leroy', 'Leroy', 'Mythical', 'Win 2 full finals', 2],
    ['yasuke', 'Yasuke', 'Mythical', 'Win 3 full finals', 3],
  ];
  const winner = { tournamentId: 'mobile-previous', weekLabel: 'Previous review week', name: 'Harbor Hands', hero: 'dragonfly-jones', wonAt: now - 86400000, entrantCount: 8 };
  return {
    tournament: { id: 'mobile-review', weekLabel: 'Mobile review week', status: 'registration', registrationOpensAt: now - 86400000, startsAt: now + 86400000, endsAt: now + 86400000 + 18 * 3600000, capacity: 8, poolCount: 1, poolSize: 8, pools: [], finals: [], champion: null, entrants: [] },
    registration: null, currentMatch: null, serverTime: now,
    rules: { roundHours: 6, turnSeconds: 75, deckSize: 10, minimumEntrants: 2 },
    progression: { completedMatches: 0, matchWins: 0, championships: 0, rewards: cards.map(([cardId, name, rarity, requirement, required], index) => ({ id: `kumite:card:${cardId}:v1`, cardId, name, rarity, requirement, required, progress: 0, claimed: false, owned: false, metric: index === 0 ? 'completedMatches' : [2, 6, 7].includes(index) ? 'championships' : 'matchWins' })) },
    records: { scope: 'Last 52 weekly tournaments', fastestFight: { tournamentId: 'mobile-previous', weekLabel: 'Previous review week', matchId: 'r1-m1', round: 0, startedAt: now - 86493540, completedAt: now - 86400000, durationMs: 93540, winner: { name: 'Harbor Hands', hero: 'dragonfly-jones' }, opponent: { name: 'Dragon District', hero: 'chonk-lee' } }, recentWinners: [winner], handThrowers: [
      { rank: 1, name: 'Harbor Hands', hero: 'dragonfly-jones', playedWins: 12, championships: 3, lastWonAt: now - 86400000 },
      { rank: 2, name: 'Dragon District', hero: 'chonk-lee', playedWins: 8, championships: 2, lastWonAt: now - 8 * 86400000 },
      { rank: 3, name: 'Quiet Storm', hero: 'bushedo-brown', playedWins: 5, championships: 1, lastWonAt: now - 15 * 86400000 },
    ] },
    winner,
  };
}

async function geometry(page) {
  return page.evaluate(() => {
    const main = document.querySelector('.kumite');
    const shell = document.querySelector('.kumite-shell');
    const rect = main.getBoundingClientRect();
    const style = getComputedStyle(main);
    return { width: innerWidth, height: innerHeight, bodyOverflow: getComputedStyle(document.body).overflow,
      windowScroll: scrollY, mainScroll: main.scrollTop, mainHeight: rect.height,
      clientHeight: main.clientHeight, scrollHeight: main.scrollHeight, overflowY: style.overflowY,
      shellTop: shell.getBoundingClientRect().top, documentOverflow: document.documentElement.scrollWidth - innerWidth,
      mainOverflow: main.scrollWidth - main.clientWidth,
    };
  });
}

async function swipe(page, session, direction, box) {
  const viewport = page.viewportSize();
  const area = box ?? { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const horizontal = direction === 'left' || direction === 'right';
  const x = horizontal ? Math.min(viewport.width - 18, area.x + area.width * (direction === 'left' ? .84 : .16)) : Math.max(18, Math.min(viewport.width - 18, area.x + area.width * .58));
  const y = horizontal ? Math.max(18, Math.min(viewport.height - 18, area.y + area.height * .5)) : viewport.height * (direction === 'up' ? .82 : .2);
  const travel = horizontal ? Math.min(area.width * .66, viewport.width * .66) : viewport.height * .6;
  const sign = ['up', 'left'].includes(direction) ? -1 : 1;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: horizontal ? x + sign * travel * step / 12 : x, y: horizontal ? y : y + sign * travel * step / 12, id: 1 }] });
    await page.waitForTimeout(22);
  }
  // Stop the finger briefly before lifting so a subsequent tap is not consumed
  // merely to stop touch momentum. This remains real browser touch input.
  for (let pause = 0; pause < 3; pause++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: horizontal ? x + sign * travel : x, y: horizontal ? y : y + sign * travel, id: 1 }] });
    await page.waitForTimeout(65);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(220);
}

async function reveal(page, session, locator) {
  for (let attempt = 0; attempt < 22; attempt++) {
    const box = await locator.boundingBox();
    assert.ok(box, 'Touch target is rendered');
    const viewport = page.viewportSize();
    if (box.y >= 10 && box.y + box.height <= viewport.height - 10) return box;
    await swipe(page, session, box.y < 10 ? 'down' : 'up');
  }
  throw new Error(`Touch gestures could not reveal ${await locator.getAttribute('class') ?? await locator.textContent()}`);
}

async function tapVisible(page, session, locator) {
  const box = await reveal(page, session, locator);
  const hitOwnTarget = await locator.evaluate((element, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return !!hit && (element === hit || element.contains(hit));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  assert.ok(hitOwnTarget, 'The visible target is not obscured by an overlay');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function capture(page, path) {
  await page.waitForFunction(() => [...document.images].filter(image => {
    const box = image.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
  }).every(image => image.complete && image.naturalWidth > 0));
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter(image => {
      const box = image.getBoundingClientRect();
      return box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
    }).map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path });
}

try {
  for (const [name, width, height] of [
    ['small-phone', 320, 568], ['phone', 390, 844], ['large-phone', 430, 932], ['tablet', 768, 1024], ['landscape', 844, 390],
  ].filter(([name]) => process.env.KUMITE_HOME_ONLY !== '1' && (!process.env.KUMITE_VIEWPORTS || process.env.KUMITE_VIEWPORTS.split(',').includes(name)))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    const page = await context.newPage(), errors = [], requests = [], failedImages = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => { if (request.resourceType() === 'image') failedImages.push({ url: request.url(), reason: request.failure()?.errorText }); });
    page.on('response', response => { if (response.request().resourceType() === 'image' && response.status() >= 400) failedImages.push({ url: response.url(), status: response.status() }); });
    const current = snapshot();
    let registered = false;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      requests.push({ path, method: route.request().method() });
      let body = {};
      if (path.startsWith('/api/kumite/')) {
        if (path.endsWith('/winners')) body = { winners: [current.winner], serverTime: Date.now() };
        else {
          if (path.endsWith('/register')) {
            assert.equal(route.request().method(), 'POST');
            assert.ok(route.request().postDataJSON().deckId);
            registered = true;
            current.registration = { deckId: route.request().postDataJSON().deckId, deckName: 'Mobile review crew', hero: 'cornball', registeredAt: Date.now() };
            current.tournament.entrants = [{ id: 'e2e-player', name: 'Mobile Fighter', hero: 'cornball', seed: null, pool: null }];
          }
          body = current;
        }
      } else if (path.startsWith('/api/social/')) body = { self: {}, counts: {}, homies: [], incomingRequests: [], outgoingRequests: [], blocked: [], invitations: [] };
      else if (path.endsWith('/rewards/account')) body = { pending: [], growth: { ready: false } };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${origin}/game/kumite`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Enter Kumite', exact: true }).waitFor({ timeout: 45000 });
    const session = await context.newCDPSession(page);
    await tapVisible(page, session, page.getByRole('button', { name: 'Enter Kumite', exact: true }));
    await page.locator('.kumite-scoreboard').waitFor();
    await page.locator('.kumite-roadmap__node').last().waitFor();
    await capture(page, `${output}/${name}-top.png`);
    const before = await geometry(page);
    assert.equal(before.bodyOverflow, 'hidden', 'Regression includes the actual global body scroll lock');
    assert.ok(['auto', 'scroll'].includes(before.overflowY), 'Kumite owns vertical scrolling inside the game scroll lock');
    assert.ok(before.mainHeight <= height + 1, 'The Kumite scroll owner is bounded by the viewport');
    await swipe(page, session, 'up');
    const after = await geometry(page);
    assert.ok(after.mainScroll > before.mainScroll + 50, `${name}: a real upward touch swipe scrolls Kumite`);
    assert.ok(after.shellTop < before.shellTop - 50, 'Visible content moves with the touch gesture');
    assert.equal(after.windowScroll, before.windowScroll, 'Scroll remains owned by Kumite');
    await capture(page, `${output}/${name}-swipe.png`);
    await tapVisible(page, session, page.getByRole('button', { name: 'Sign up', exact: true }));
    await capture(page, `${output}/${name}-signup.png`);
    await writeFile(`${output}/${name}-request-trace.json`, JSON.stringify({ registered, requests, errors }, null, 2));
    await page.getByRole('status').filter({ hasText: 'Registered. Deck locked.' }).waitFor();
    assert.ok(registered, 'Signup is reachable through touch and submits the selected deck');
    await tapVisible(page, session, page.getByRole('tab', { name: 'Bracket', exact: true }));
    const bracket = page.locator('.kumite-bracket__scroll');
    const bracketHeading = page.locator('.kumite-bracket__label');
    await reveal(page, session, bracketHeading);
    const bracketBefore = await bracket.evaluate(element => ({ left: element.scrollLeft, overflow: element.scrollWidth - element.clientWidth }));
    if (bracketBefore.overflow > 1) {
      await reveal(page, session, page.locator('.kumite-match').first());
      const box = await bracket.boundingBox();
      // Keep the gesture on the top of the visible bracket instead of a lower
      // region outside a short landscape viewport.
      const top = Math.max(18, box.y), bottom = Math.min(height - 18, box.y + box.height);
      assert.ok(bottom > top + 30, 'A touchable bracket region is inside the viewport');
      await swipe(page, session, 'left', { ...box, y: top, height: bottom - top });
      assert.ok(await bracket.evaluate(element => element.scrollLeft) > bracketBefore.left + Math.min(25, bracketBefore.overflow * .5), 'A horizontal touch gesture pans the bracket');
    }
    assert.equal(await page.locator('.kumite-match').count(), 7);
    await capture(page, `${output}/${name}-bracket.png`);
    await tapVisible(page, session, page.getByRole('tab', { name: 'Past winners', exact: true }));
    await page.locator('.kumite-winner-card').waitFor();
    await reveal(page, session, page.locator('.kumite-winner-card'));
    await tapVisible(page, session, page.getByRole('tab', { name: 'Rules', exact: true }));
    await reveal(page, session, page.locator('.kumite-rules li').last());
    assert.equal(await page.locator('.kumite-rules li').count(), 5);
    await capture(page, `${output}/${name}-rules.png`);
    const flags = page.locator('.kumite-scoreboard__flags');
    if (await flags.count()) {
      await reveal(page, session, page.locator('.kumite-side-flag--dates h2'));
      const flagBefore = await flags.evaluate(element => ({ left: element.scrollLeft, overflow: element.scrollWidth - element.clientWidth }));
      if (flagBefore.overflow > 1) {
        const box = await flags.boundingBox();
        await swipe(page, session, 'left', { ...box, height: Math.min(box.height, height - box.y - 18) });
        assert.ok(await flags.evaluate(element => element.scrollLeft) > flagBefore.left + 25, 'A horizontal touch gesture reveals the record flag');
      }
      assert.equal(await page.locator('.kumite-side-flag').count(), 2);
      await capture(page, `${output}/${name}-records.png`);
    }
    const lastUnlock = page.getByRole('link', { name: 'View Yasuke', exact: true });
    await reveal(page, session, lastUnlock);
    assert.ok(await lastUnlock.isVisible(), 'The final roadmap reward is reachable with touch swipes');
    await capture(page, `${output}/${name}-last-unlock.png`);
    const final = await geometry(page);
    assert.ok(final.documentOverflow <= 1 && final.mainOverflow <= 1, 'The mobile page has no horizontal overflow');
    const inspectedAt = final.mainScroll;
    await tapVisible(page, session, lastUnlock);
    await page.waitForURL('**/game/collection?card=yasuke');
    await page.locator('.kumite').waitFor({ state: 'detached' });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.locator('.kumite-scoreboard').waitFor();
    await page.locator('.kumite-roadmap__node').last().waitFor();
    // The selected panel resets to registration when the route remounts. Its
    // height can differ from Rules, so the browser clamps the old offset at the
    // new bottom. Require the restored/clamped offset and the same lower reward.
    await page.waitForFunction(expected => {
      const main = document.querySelector('.kumite');
      return Math.abs(main.scrollTop - Math.min(expected, main.scrollHeight - main.clientHeight)) < 6;
    }, inspectedAt);
    const restored = await geometry(page);
    assert.ok(Math.abs(restored.mainScroll - Math.min(inspectedAt, restored.scrollHeight - restored.clientHeight)) < 6, 'Inspecting a reward then using Back restores Kumite scroll position within the new content bounds');
    const rewardAfterBack = await lastUnlock.boundingBox();
    assert.ok(rewardAfterBack.y < height && rewardAfterBack.y + rewardAfterBack.height > 0, 'Back returns to the same lower reward rather than losing the roadmap position');
    await writeFile(`${output}/${name}-back-restoration.json`, JSON.stringify({ inspectedAt, restored, rewardAfterBack }, null, 2));
    await tapVisible(page, session, page.getByRole('tab', { name: 'Sign up', exact: true }));
    assert.equal(await page.getByRole('tab', { name: 'Sign up', exact: true }).getAttribute('aria-selected'), 'true');
    await reveal(page, session, page.getByRole('link', { name: 'Back to fight modes', exact: true }));
    // Populate a real active eight-seat board after the registration flow and
    // verify names/status stay inside their painted plates at the narrow width.
    const names = ['Harbor Hands Champion', 'Dragon District Fighter', 'Quiet Storm', 'Duke District', 'Glow Lane', 'Uptown Flow', 'Dragon District', 'Quiet Storm'];
    const heroes = ['dragonfly-jones', 'chonk-lee', 'bushedo-brown', 'franklin-duke', 'leroy', 'sho-nuff', 'dragonfly-jones', 'bushedo-brown'];
    current.tournament.status = 'active';
    current.tournament.entrants = names.map((name, index) => ({ id: `fighter-${index}`, name, hero: heroes[index], seed: index + 1, pool: null }));
    const quarters = Array.from({ length: 4 }, (_, index) => ({ id: `r1-m${index + 1}`, round: 0, slot: index, pool: null, status: index === 0 ? 'playing' : 'ready', entrants: current.tournament.entrants.slice(index * 2, index * 2 + 2), winner: null, reason: null, checkedIn: index === 0 ? [true, true] : [false, false], deadline: current.tournament.startsAt + 6 * 3600000, roomCode: index === 0 ? 'REVIEW' : null, ...(index === 0 ? { startedAt: Date.now() - 90000 } : {}) }));
    current.tournament.finals = [quarters, Array.from({ length: 2 }, (_, index) => ({ ...quarters[index], id: `r2-m${index + 1}`, round: 1, slot: index, status: 'pending', entrants: [null, null], roomCode: null, checkedIn: [false, false] })), [{ ...quarters[0], id: 'r3-m1', round: 2, status: 'pending', entrants: [null, null], roomCode: null, checkedIn: [false, false] }]];
    current.currentMatch = quarters[0];
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Return to your fight', exact: true }).waitFor();
    await reveal(page, session, page.getByRole('button', { name: 'Quarterfinals', exact: true }));
    await capture(page, `${output}/${name}-active-board.png`);
    const scoreboard = await page.locator('.kumite-scoreboard__frame').evaluate(frame => {
      const box = frame.getBoundingClientRect(), image = frame.querySelector('.kumite-scoreboard__art');
      return { width: box.width, height: box.height, aspectRatio: getComputedStyle(frame).aspectRatio,
        boardWidth: frame.parentElement.getBoundingClientRect().width,
        naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, complete: image.complete,
        stylesheet: document.querySelector('style[data-vite-dev-id$="/src/styles/kumite.css"]')?.getAttribute('data-vite-dev-id'),
      };
    });
    assert.ok(scoreboard.complete && scoreboard.naturalWidth > 0, 'The actual supplied scoreboard image decoded');
    assert.ok(Math.abs(scoreboard.width / scoreboard.height - scoreboard.naturalWidth / scoreboard.naturalHeight) < .005, 'Scoreboard artwork preserves its source aspect ratio');
    const plateFit = await page.locator('.kumite-scoreboard__seat').evaluateAll(seats => seats.map(seat => {
      // The fixed row maps to painted cream plates. A flex seat may grow to fit
      // its overflowing copy; testing that seat alone would miss overlap.
      const plate = seat.parentElement.getBoundingClientRect(), copy = seat.querySelector('div').getBoundingClientRect();
      return { name: seat.querySelector('strong').textContent, plateTop: plate.top, plateBottom: plate.bottom, copyTop: copy.top, copyBottom: copy.bottom };
    }));
    plateFit.forEach(plate => assert.ok(plate.copyTop >= plate.plateTop - 1 && plate.copyBottom <= plate.plateBottom + 1, `${name}: ${plate.name} and status fit the scoreboard plate`));
    const timingFit = await page.locator('.kumite-scoreboard__row').evaluateAll(rows => rows.map((row, index) => {
      const plate = row.getBoundingClientRect(), next = rows[index + 1]?.getBoundingClientRect(), time = row.querySelector('.kumite-scoreboard__time')?.getBoundingClientRect();
      return { plateBottom: plate.bottom, nextTop: next?.top, timeTop: time?.top, timeBottom: time?.bottom };
    }));
    timingFit.forEach((fit, index) => {
      if (fit.timeTop != null && fit.nextTop != null) assert.ok(fit.timeTop >= fit.plateBottom - 1 && fit.timeBottom <= fit.nextTop + 1, `${name}: match timing stays between cream plates ${index + 1}/${index + 2}`);
    });
    await page.getByRole('button', { name: 'Semifinals', exact: true }).waitFor();
    await tapVisible(page, session, page.getByRole('button', { name: 'Semifinals', exact: true }));
    assert.equal(await page.getByRole('button', { name: 'Semifinals', exact: true }).getAttribute('aria-pressed'), 'true');
    await tapVisible(page, session, page.getByRole('button', { name: 'Final', exact: true }));
    assert.equal(await page.getByRole('button', { name: 'Final', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    report.checks.push({ name, width, height, before, after, final, restored, touchScroll: true, lowerSignupSubmitted: true, sections: 4, bracketMatches: 7, horizontalBracket: bracketBefore.overflow > 1, flagRail: !!await flags.count(), lastRewardReachable: true, inspectBackRestoresScroll: true, returnToTop: true, scoreboard, activePlateFit: plateFit, matchTimingFit: timingFit, roundSelection: true, errors, failedImages });
    console.log(`${name}: actual App/GameApp touch scroll, signup, all sections, bracket, flags, last unlock and return passed.`);
    await context.close();
  }
  if (process.env.KUMITE_SKIP_HOME !== '1') for (const [name, width, height] of [['small-phone', 320, 568], ['landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('squabblemon_e2e_user', 'signed-in');
      localStorage.setItem('squabblemon:starter-mythic:e2e-player:intro', '1');
    });
    const page = await context.newPage(), errors = [], failedImages = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => { if (request.resourceType() === 'image') failedImages.push({ url: request.url(), reason: request.failure()?.errorText }); });
    page.on('response', response => { if (response.request().resourceType() === 'image' && response.status() >= 400) failedImages.push({ url: response.url(), status: response.status() }); });
    const current = snapshot();
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let body = {};
      if (path.startsWith('/api/kumite/')) body = path.endsWith('/winners') ? { winners: [current.winner], serverTime: Date.now() } : current;
      else if (path.endsWith('/rewards/starter-mythic') || path.endsWith('/rewards/john-henry')) body = { state: 'locked', chapters: [] };
      else if (path.endsWith('/rewards/account')) body = { pending: [], growth: { ready: false } };
      else if (path.endsWith('/player/mail')) body = { messages: [] };
      else if (path.endsWith('/events/patches') || path.endsWith('/challenge-runs')) body = [];
      else if (path === '/api/social' || path.startsWith('/api/social/')) body = { self: {}, counts: {}, homies: [], incomingRequests: [], outgoingRequests: [], blocked: [], invitations: [] };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${origin}/game`, { waitUntil: 'domcontentloaded' });
    const shortcut = page.getByRole('link', { name: 'Enter Kumite weekly PvP tournaments', exact: true });
    await shortcut.waitFor({ timeout: 45000 });
    await page.locator('.starter-mythic-shortcut').waitFor();
    await page.waitForFunction(() => {
      const image = document.querySelector('.kumite-shortcut__fight > img');
      return image?.complete && image.naturalWidth > 0;
    });
    const placement = await shortcut.evaluate(link => {
      const box = link.getBoundingClientRect(), mythic = document.querySelector('.starter-mythic-shortcut').getBoundingClientRect();
      const image = link.querySelector('.kumite-shortcut__fight > img'), art = image.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      const cta = link.querySelector('.kumite-shortcut__cta').getBoundingClientRect();
      const ctaHit = document.elementFromPoint(cta.x + cta.width / 2, cta.y + cta.height / 2);
      const navRects = [...document.querySelectorAll('.fan-nav a, .fan-nav button, .game-nav a, .game-nav button')].map(element => {
        const rect = element.getBoundingClientRect();
        return { label: element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, mythicBottom: mythic.bottom,
        hitOwnShortcut: !!hit && (hit === link || link.contains(hit)), artwork: image.currentSrc,
        ctaHitOwnShortcut: !!ctaHit && (ctaHit === link || link.contains(ctaHit)),
        naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, renderedWidth: art.width, renderedHeight: art.height, objectFit: getComputedStyle(image).objectFit,
        navRects,
        overlapsNavigation: navRects.some(nav => nav.width > 0 && nav.height > 0 && box.left < nav.right && box.right > nav.left && box.top < nav.bottom && box.bottom > nav.top),
      };
    });
    await capture(page, `${output}/${name}-actual-safehouse.png`);
    await writeFile(`${output}/${name}-safehouse-placement.json`, JSON.stringify({ placement, errors }, null, 2));
    assert.ok(placement.top >= placement.mythicBottom, 'Kumite is below the Mythic shortcut');
    assert.ok(placement.top >= 0 && placement.bottom <= height && placement.left >= 0 && placement.right <= width, 'Chibi shortcut is fully on screen');
    assert.ok(placement.artwork.includes('dragonfly-vs-chonk-chibi-v1.webp'), 'The generated chibi fight art loaded');
    assert.ok(Math.abs(placement.renderedWidth / placement.renderedHeight - placement.naturalWidth / placement.naturalHeight) < .01, 'Chibi artwork keeps its source aspect ratio');
    assert.equal(placement.objectFit, 'contain');
    assert.equal(placement.overlapsNavigation, false, 'Fan navigation does not overlap the chibi shortcut');
    assert.ok(placement.hitOwnShortcut, 'Center hit target belongs to the shortcut');
    assert.ok(placement.ctaHitOwnShortcut, 'The KUMITE label also belongs to the shortcut rather than Shop navigation');
    const session = await context.newCDPSession(page);
    // The shortcut is already visible. tapVisible confirms the hit target and
    // uses a touchscreen coordinate, not Playwright auto-scroll/click.
    await tapVisible(page, session, shortcut);
    await page.waitForURL('**/game/kumite');
    await page.getByRole('button', { name: 'Enter Kumite', exact: true }).waitFor();
    await tapVisible(page, session, page.getByRole('button', { name: 'Enter Kumite', exact: true }));
    await page.locator('.kumite-scoreboard').waitFor();
    await reveal(page, session, page.getByRole('button', { name: 'Sign up', exact: true }));
    assert.deepEqual(errors, []);
    report.homeChecks.push({ name, width, height, placement, actualAppHome: true, touchLinkRoutesToKumite: true, enterArenaAndSignupReachable: true, errors, failedImages });
    console.log(`${name}: actual Home chibi art, Mythic order, aspect ratio, hit target and touch route to Kumite passed.`);
    await context.close();
  }
  report.complete = true;
} catch (error) { report.failure = String(error.stack ?? error); throw error; }
finally { await browser.close(); await writeFile(`${output}/verification.json`, JSON.stringify(report, null, 2)); }
