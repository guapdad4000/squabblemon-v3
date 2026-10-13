import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43217';
const output = process.env.KUMITE_OUTPUT ?? fileURLToPath(new URL('../../deliverables/kumite-review/browser/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'], ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const report = [];

async function capture(page, path, fullPage = true) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    const images = [...document.images].filter(image => !image.closest('.compact-deck-picker'));
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path, fullPage });
}

function snapshot() {
  const now = Date.now();
  return { tournament: { id: 'review-week', weekLabel: 'Browser review week', status: 'registration', registrationOpensAt: now - 86400000, startsAt: now + 86400000, endsAt: now + 86400000 + 18 * 3600000, capacity: 8, poolCount: 1, poolSize: 8, pools: [], finals: [], champion: null, entrants: [] }, registration: null, currentMatch: null, serverTime: now, rules: { roundHours: 6, turnSeconds: 75, deckSize: 10, minimumEntrants: 2 }, progression: { completedMatches: 0, matchWins: 0, championships: 0, rewards: [
    { id: 'kumite:card:bushedo-brown:v1', cardId: 'bushedo-brown', name: 'Bushedo Brown', rarity: 'Rare', requirement: 'Complete 1 full fight', metric: 'completedMatches', required: 1, progress: 0, claimed: false, owned: false },
    { id: 'kumite:card:franklin-duke:v1', cardId: 'franklin-duke', name: 'Franklin Duke', rarity: 'Epic', requirement: 'Win 1 full fight', metric: 'matchWins', required: 1, progress: 0, claimed: false, owned: false },
    { id: 'kumite:card:chonk-lee:v1', cardId: 'chonk-lee', name: 'Chonk Lee', rarity: 'Legendary', requirement: 'Win 1 full final', metric: 'championships', required: 1, progress: 0, claimed: false, owned: false },
    { id: 'kumite:card:dragonfly-jones:v1', cardId: 'dragonfly-jones', name: 'Dragonfly Jones', rarity: 'Legendary', requirement: 'Win 3 full fights', metric: 'matchWins', required: 3, progress: 0, claimed: false, owned: true },
    { id: 'kumite:card:undercova-brotha:v1', cardId: 'undercova-brotha', name: 'Undercova Brotha', rarity: 'Rare', requirement: 'Win 5 full fights', metric: 'matchWins', required: 5, progress: 0, claimed: false, owned: true },
    { id: 'kumite:card:sho-nuff:v1', cardId: 'sho-nuff', name: "Sho'Nuff", rarity: 'Legendary', requirement: 'Win 8 full fights', metric: 'matchWins', required: 8, progress: 0, claimed: false, owned: true },
    { id: 'kumite:card:leroy:v1', cardId: 'leroy', name: 'Leroy', rarity: 'Mythical', requirement: 'Win 2 full finals', metric: 'championships', required: 2, progress: 0, claimed: false, owned: true },
    { id: 'kumite:card:yasuke:v1', cardId: 'yasuke', name: 'Yasuke', rarity: 'Mythical', requirement: 'Win 3 full finals', metric: 'championships', required: 3, progress: 0, claimed: false, owned: true },
  ] }, records: { scope: 'Last 52 weekly tournaments', fastestFight: null, recentWinners: [], handThrowers: [] } };
}

try {
  for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1440, 960], ['small-phone', 320, 740], ['tablet', 768, 1024], ['arena-landscape', 844, 390]].filter(([name]) => !process.env.KUMITE_VIEWPORTS || process.env.KUMITE_VIEWPORTS.split(',').includes(name))) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    let current = snapshot(), winners = [], failRegistration = false, delayCurrent = false, assignedRoom = null, inventoryResponse = null;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/player/bootstrap', async route => {
      requests.push({ path: '/api/player/bootstrap', method: route.request().method() });
      assert.ok(inventoryResponse, 'Reward receipt invalidation has a saved profile response');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inventoryResponse) });
    });
    await page.route('**/api/kumite/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      requests.push({ path, method: request.method(), body: request.postDataJSON() });
      let body;
      if (path.endsWith('/winners')) body = { winners, serverTime: Date.now() };
      else if (path.endsWith('/register')) {
        if (failRegistration) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'The final tournament spot was just taken. Please refresh.' }) });
        assert.equal(request.method(), 'POST');
        const { deckId } = request.postDataJSON();
        assert.ok(deckId);
        current.registration = { deckId, deckName: 'Registered review crew', hero: 'cornball', registeredAt: Date.now() };
        current.tournament.entrants = [{ id: 'review-entrant', name: 'Review Fighter', hero: 'cornball', seed: null, pool: null }];
        body = current;
      } else if (path.endsWith('/withdraw')) {
        assert.equal(request.method(), 'POST');
        current.registration = null; current.tournament.entrants = []; body = current;
      } else if (path.endsWith('/match')) {
        assert.equal(request.method(), 'POST');
        current.currentMatch.checkedIn = [true, false]; body = { room: assignedRoom, current };
      } else {
        if (delayCurrent) await new Promise(resolve => setTimeout(resolve, 650));
        body = current;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${origin}/e2e/kumite.fixture.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Enter Kumite' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Back to fight modes' }).count(), 1);
    await page.waitForFunction(() => [...document.images].filter(image => { const box = image.getBoundingClientRect(); return box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight; }).every(image => image.complete));
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-entrance.png`);
    assert.equal(await page.locator('.kumite-entry .kumite-banner').count(), 0, 'Entrance leaves the clean hallway visible');
    await page.getByRole('button', { name: 'Enter Kumite' }).click();
    await page.getByRole('button', { name: 'Sign up' }).waitFor();
    assert.equal(await page.locator('.kumite-panel').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Sign up' }).count(), 1);
    assert.equal(await page.locator('.kumite-scoreboard__seat').count(), 8);
    assert.equal(await page.locator('.kumite-scoreboard__art').count(), 1, 'Actual scoreboard artwork is present');
    assert.equal(await page.locator('.kumite-rewards__cards article').count(), 8);
    assert.equal(await page.locator('.kumite-rewards__cards article[data-earned="true"]').count(), 0);
    assert.equal(await page.locator('.kumite-arena-scene img').count(), 3);
    assert.equal(await page.locator('.kumite-side-flag').count(), 2, 'One dates flag and one records flag');
    assert.equal(await page.locator('.kumite-tabs__cloth').count(), 4, 'Every navigation tab is cloth artwork');
    assert.equal(await page.locator('.kumite-scoreboard__round-cloth').count(), 3, 'Every round selector is cloth artwork');
    assert.equal(await page.locator('.kumite-footer').count(), 0, 'No decorative footer');
    assert.ok(await page.locator('.kumite-panel').evaluate(panel => getComputedStyle(panel).backgroundImage.includes('panel-background.webp')), 'Shared content panel has the illustrated background');
    const branchPositions = await page.locator('.kumite-roadmap__nodes').evaluate(nodes => {
      const map = nodes.getBoundingClientRect();
      return [...nodes.children].map((node, index) => {
        const box = node.getBoundingClientRect();
        return { index, x: (box.x + box.width / 2 - map.x) / map.width, y: (box.y + box.height / 2 - map.y) / map.height, left: box.left, right: box.right };
      });
    });
    branchPositions.forEach(({ index, x, y, left, right }) => {
      assert.ok(Math.abs(x - (index % 2 === 0 ? .25 : .75)) < .005, `Reward ${index + 1} follows its illustrated branch`);
      assert.ok(Math.abs(y - (.147 + index * .098)) < .005, `Reward ${index + 1} follows its illustrated height`);
      assert.ok(left >= 0 && right <= width, `Reward ${index + 1} stays inside ${width}px`);
    });
    await page.waitForFunction(() => [...document.images].filter(image => { const box = image.getBoundingClientRect(); return box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight; }).every(image => image.complete));
    assert.equal(await page.locator('img').evaluateAll(images => images.filter(image => image.complete && image.naturalWidth === 0).map(image => image.src)).then(failed => JSON.stringify(failed)), '[]', 'Requested runtime artwork loads');
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-signup.png`);
    await page.locator('.kumite-roadmap').screenshot({ path: `${output}/${name}-roadmap.png` });
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.getByRole('button', { name: 'Withdraw registration' }).waitFor();
    assert.equal(requests.filter(request => request.path.endsWith('/register')).length, 1);
    assert.equal(await page.locator('.kumite-entrant-list li').count(), 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-registered.png`);
    await page.getByRole('button', { name: 'Withdraw registration' }).click();
    await page.getByRole('button', { name: 'Sign up' }).waitFor();
    assert.equal(await page.locator('.kumite-entrant-list li').count(), 0);
    failRegistration = true;
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.getByRole('alert').filter({ hasText: 'final tournament spot' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Withdraw registration' }).count(), 0, 'Failed registration never invents a saved place');
    failRegistration = false;
    await page.getByRole('tab', { name: 'Bracket', exact: true }).click();
    assert.equal(await page.locator('.kumite-panel').count(), 1);
    assert.equal(await page.locator('.kumite-match').count(), 7);
    assert.equal(await page.locator('.kumite-match__entrant').count(), 14);
    assert.equal(await page.locator('.kumite-bracket__hint').isVisible(), width <= 600);
    if (width <= 600) {
      const rail = page.locator('.kumite-bracket__scroll');
      await rail.focus();
      await page.keyboard.press('End');
      await page.waitForFunction(() => { const rail = document.querySelector('.kumite-bracket__scroll'); return rail.scrollLeft > 0 && rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1; });
      const finalVisible = await rail.evaluate(rail => { const view = rail.getBoundingClientRect(), final = rail.querySelector('.kumite-bracket__round:nth-child(3)').getBoundingClientRect(); return final.right <= view.right + 1 && final.left >= view.left - 1; });
      assert.ok(finalVisible, 'Keyboard End reveals the full final round');
      await page.keyboard.press('Home');
      assert.equal(await rail.evaluate(rail => rail.scrollLeft), 0);
      await rail.evaluate(rail => { rail.scrollLeft = rail.scrollWidth; });
      assert.ok(await rail.evaluate(rail => rail.scrollLeft > 0), 'Horizontal scrolling reveals final rounds');
      await rail.evaluate(rail => { rail.scrollLeft = 0; });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-bracket.png`);
    await page.getByRole('tab', { name: 'Past winners' }).click();
    await page.getByRole('heading', { name: 'No champions yet.' }).waitFor();
    assert.equal(await page.locator('.kumite-winner-card').count(), 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-history-empty.png`);
    winners = [{ tournamentId: 'completed-review', weekLabel: 'Completed review week', name: 'Fixture Champion', hero: 'cornball', wonAt: Date.now() - 86400000, entrantCount: 8 }];
    current.records = { scope: 'Last 52 weekly tournaments', fastestFight: { tournamentId: 'previous-review', weekLabel: 'Previous review week', matchId: 'r1-m2', round: 0, startedAt: Date.now() - 86400000 - 93540, completedAt: Date.now() - 86400000, durationMs: 93540, winner: { name: 'Fixture Champion', hero: 'leroy' }, opponent: { name: 'Harbor Hands', hero: 'sho-nuff' } }, recentWinners: [{ ...winners[0], hero: 'leroy' }, { tournamentId: 'earlier-review', weekLabel: 'Earlier review week', name: 'Dragon District', hero: 'dragonfly-jones', wonAt: Date.now() - 8 * 86400000 }], handThrowers: [{ rank: 1, name: 'Fixture Champion', hero: 'leroy', playedWins: 12, championships: 3, lastWonAt: Date.now() - 86400000 }, { rank: 2, name: 'Dragon District', hero: 'dragonfly-jones', playedWins: 8, championships: 2, lastWonAt: Date.now() - 8 * 86400000 }, { rank: 3, name: 'Harbor Hands', hero: 'sho-nuff', playedWins: 5, championships: 1, lastWonAt: Date.now() - 15 * 86400000 }] };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Past winners' }).click();
    await page.locator('.kumite-winner-card').waitFor();
    assert.equal(await page.locator('.kumite-winner-card').count(), 1);
    assert.ok((await page.locator('.kumite-side-flag--records').textContent()).includes('1:33.540'));
    assert.equal(await page.locator('.kumite-side-flag--records .kumite-side-flag__legends ol').count(), 2);
    const flagFit = await page.locator('.kumite-side-flag__ink').evaluateAll(inks => inks.map(ink => {
      const box = ink.getBoundingClientRect();
      return { scrollWidth: ink.scrollWidth, width: box.width, scrollHeight: ink.scrollHeight, height: box.height };
    }));
    if (flagFit.some(fit => fit.scrollHeight > fit.height + 1)) console.log({ width, flagFit });
    flagFit.forEach((fit, index) => {
      assert.ok(fit.scrollWidth <= fit.width + 1, `Flag ${index + 1} text fits cloth at ${width}px`);
      assert.ok(fit.scrollHeight <= fit.height + 1, `Flag ${index + 1} dates/records stay above the fist emblem at ${width}px`);
    });
    await page.locator('.kumite-scoreboard-stage').screenshot({ path: `${output}/${name}-flags.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-history.png`);
    await page.getByRole('tab', { name: 'Rules' }).click();
    assert.equal(await page.locator('.kumite-rules li').count(), 5);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-rules.png`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].map(el => ({ tag: el.tagName, class: el.className, x: el.getBoundingClientRect().x, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).filter(el => el.right > innerWidth + 1 || el.x < -1).slice(-12)));
    assert.ok(overflow <= 1, `${width}px viewport has ${overflow}px document overflow`);
    await page.getByRole('tab', { name: 'Rules' }).focus();
    await page.keyboard.press('Home');
    assert.equal(await page.getByRole('tab', { name: 'Sign up' }).getAttribute('aria-selected'), 'true');
    current.registration = { deckId: 'kumite-review-0', deckName: 'Registered review crew', hero: 'cornball', registeredAt: Date.now() };
    current.tournament.status = 'active';
    current.tournament.entrants = [
      { id: 'self', name: 'Review Fighter', hero: 'cornball', seed: 1, pool: null },
      { id: 'rival', name: 'Review Rival', hero: 'chonk-lee', seed: 2, pool: null },
      { id: 'harbor', name: 'Harbor Hands', hero: 'undercova-brotha', seed: 3, pool: null },
      { id: 'duke', name: 'Duke District', hero: 'franklin-duke', seed: 4, pool: null },
      { id: 'glow', name: 'Glow Lane', hero: 'leroy', seed: 5, pool: null },
      { id: 'uptown', name: 'Uptown Flow', hero: 'sho-nuff', seed: 6, pool: null },
      { id: 'dragon', name: 'Dragon District', hero: 'dragonfly-jones', seed: 7, pool: null },
      { id: 'quiet', name: 'Quiet Storm', hero: 'bushedo-brown', seed: 8, pool: null },
    ];
    current.currentMatch = { id: 'r1-m1', round: 0, slot: 0, pool: null, status: 'ready', entrants: [{ id: 'self', name: 'Review Fighter', hero: 'cornball' }, { id: 'rival', name: 'Review Rival', hero: 'chonk-lee' }], winner: null, reason: null, checkedIn: [false, false], deadline: Date.now() + 6 * 3600000, roomCode: null };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Check in & fight' }).click();
    await page.getByRole('status').filter({ hasText: 'Checked in. Waiting for opponent.' }).waitFor();
    assert.equal(requests.filter(request => request.path.endsWith('/match')).length, 1);
    const stale = structuredClone(current);
    stale.currentMatch.status = 'playing'; stale.currentMatch.roomCode = 'STALE1';
    stale.currentMatch.startedAt = Date.now() - 65000;
    current.tournament.status = 'complete'; current.currentMatch = null;
    delayCurrent = true;
    await page.addInitScript(data => { window.kumiteReviewCachedData = data; }, stale);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Sign up' }).waitFor();
    assert.ok(new URL(page.url()).pathname.endsWith('/e2e/kumite.fixture.html'), 'Cached active room cannot redirect before server reconciliation');
    await page.getByText('TOURNAMENT COMPLETE', { exact: true }).waitFor();
    assert.ok(new URL(page.url()).pathname.endsWith('/e2e/kumite.fixture.html'), 'Fresh completed tournament stays in Kumite');
    current.tournament.status = 'active'; current.currentMatch = stale.currentMatch;
    current.currentMatch.roomCode = 'REVIEW2';
    assignedRoom = { code: 'REVIEW2', status: 'waiting' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Return to your fight' }).waitFor();
    await page.waitForTimeout(800);
    assert.ok(new URL(page.url()).pathname.endsWith('/e2e/kumite.fixture.html'), 'Intentional return to Kumite never forces navigation back into the waiting room');
    await page.getByRole('button', { name: 'Semifinals', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Semifinals', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Quarterfinals', exact: true }).click();
    const finishedQuarters = [1, 2, 3].map(index => ({ id: `r1-m${index + 1}`, round: 0, slot: index, pool: null, status: 'complete', entrants: current.tournament.entrants.slice(index * 2, index * 2 + 2), winner: current.tournament.entrants[index * 2], reason: 'played', checkedIn: [true, true], deadline: current.currentMatch.deadline, roomCode: null, startedAt: Date.now() - (120000 + index * 11000), completedAt: Date.now() - 10000, durationMs: 110000 + index * 11000 }));
    current.tournament.finals = [[current.currentMatch, ...finishedQuarters], [
      { id: 'r2-m1', round: 1, slot: 0, pool: null, status: 'pending', entrants: [null, finishedQuarters[0].winner], winner: null, reason: null, checkedIn: [false, false], deadline: current.currentMatch.deadline + 6 * 3600000, roomCode: null },
      { id: 'r2-m2', round: 1, slot: 1, pool: null, status: 'ready', entrants: [finishedQuarters[1].winner, finishedQuarters[2].winner], winner: null, reason: null, checkedIn: [false, false], deadline: current.currentMatch.deadline + 6 * 3600000, roomCode: null },
    ], [{ id: 'r3-m1', round: 2, slot: 0, pool: null, status: 'pending', entrants: [null, null], winner: null, reason: null, checkedIn: [false, false], deadline: current.currentMatch.deadline + 12 * 3600000, roomCode: null }]];
    inventoryResponse = await page.evaluate(() => window.kumiteReviewBootstrap);
    inventoryResponse.profile.ownedCardIds = [...inventoryResponse.profile.ownedCardIds, 'bushedo-brown'];
    current.progression.completedMatches = 1;
    current.progression.rewards[0].claimed = true; current.progression.rewards[0].progress = 1; current.progression.rewards[0].owned = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.kumite-scoreboard__time')?.textContent.includes('Fighting'));
    await page.waitForFunction(() => window.kumiteReviewBootstrap?.profile.ownedCardIds.includes('bushedo-brown'));
    assert.equal(await page.locator('.kumite-rewards__cards article[data-earned="true"]').count(), 1);
    assert.equal(await page.locator('.kumite-rewards__cards article[data-earned="false"]').count(), 7);
    assert.ok(requests.some(request => request.path === '/api/player/bootstrap'), 'A new reward receipt refetches the active inventory bootstrap');
    const platePlacement = await page.locator('.kumite-scoreboard__row').evaluateAll(rows => rows.map((row, index) => {
      const plate = row.getBoundingClientRect(), next = rows[index + 1]?.getBoundingClientRect(), timing = row.querySelector('.kumite-scoreboard__time')?.getBoundingClientRect();
      return { plateTop: plate.top, plateBottom: plate.bottom, nextTop: next?.top, timingTop: timing?.top, timingBottom: timing?.bottom, names: [...row.querySelectorAll('.kumite-scoreboard__seat > div')].map(name => { const box = name.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; }) };
    }));
    platePlacement.forEach((plate, index) => {
      plate.names.forEach(name => assert.ok(name.top >= plate.plateTop - 1 && name.bottom <= plate.plateBottom + 1, `Names/status fit inside cream plate ${index + 1} at ${width}px`));
      if (plate.timingTop != null && plate.nextTop != null) assert.ok(plate.timingTop >= plate.plateBottom - 1 && plate.timingBottom <= plate.nextTop + 1, `Timing fits between cream plates ${index + 1}/${index + 2} at ${width}px`);
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, `${output}/${name}-scoreboard-live.png`);
    await page.locator('.kumite-scoreboard-stage').screenshot({ path: `${output}/${name}-flags-live.png` });
    await page.locator('.kumite-registration').screenshot({ path: `${output}/${name}-signup-panel.png` });
    await page.getByRole('button', { name: 'Return to your fight' }).click();
    await page.waitForURL('**/game/online/REVIEW2');
    assert.deepEqual(errors, []);
    report.push({ viewport: name, width, height, errors, documentOverflow: overflow, signup: true, withdraw: true, failedSignup: true, bracketMatches: 7, emptyHistory: true, archive: true, keyboardTabs: true, clothNavigation: 4, clothRounds: 3, sideFlags: 2, illustratedPanel: true, footerRemoved: true, platePlacement, roadmapBranches: branchPositions, checkIn: true, staleRoomReconciled: true, noForcedReturn: true, explicitRoomEntry: true, inventoryRefetchedOnReceipt: true, arenaLayers: 3, evidence: 'Intercepted API fixtures; server integration tested separately.' });
    console.log(`${name}: signup, withdraw, failed signup, 7-match bracket, archive, keyboard tabs, artwork and check-in passed.`);
    await context.close();
  }
  for (const [name, width, height] of [['short-phone', 320, 568], ['landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/player/rewards/starter-mythic', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state: 'locked', chapters: [] }) }));
    await page.goto(`${origin}/e2e/kumite-rail.fixture.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Enter Kumite weekly PvP tournaments' }).waitFor();
    await page.waitForFunction(() => [...document.images].filter(image => { const box = image.getBoundingClientRect(); return box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight; }).every(image => image.complete));
    const placement = await page.locator('.kumite-shortcut').evaluate(shortcut => {
      const box = shortcut.getBoundingClientRect(), mythic = document.querySelector('.starter-mythic-shortcut').getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, mythicBottom: mythic.bottom, hitOwnShortcut: !!hit?.closest('.kumite-shortcut'), hitTag: hit?.tagName, viewportHeight: innerHeight, viewportWidth: innerWidth };
    });
    assert.ok(placement.bottom <= height, `${name} shortcut bottom ${placement.bottom} fits height ${height}`);
    assert.ok(placement.top >= placement.mythicBottom, `${name} shortcut sits below Mythic`);
    assert.ok(placement.left >= 0 && placement.right <= width, `${name} shortcut fits width`);
    assert.ok(placement.hitOwnShortcut, `${name} center target belongs to shortcut instead of fan navigation`);
    assert.deepEqual(errors, []);
    await capture(page, `${output}/${name}-home-rail.png`, false);
    report.push({ viewport: name, width, height, homeRail: placement, errors, evidence: 'Actual KumiteShortcut, StarterMythic, GameNav and production styles over static canonical room poster.' });
    console.log(`${name}: home Kumite rail fits, sits below Mythic and remains the center hit target.`);
    await context.close();
  }
  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'no-preference' });
  const motionPage = await motionContext.newPage();
  const motionSnapshot = snapshot();
  await motionPage.route('**/api/kumite/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().url().endsWith('/winners') ? { winners: [], serverTime: Date.now() } : motionSnapshot) }));
  await motionPage.goto(`${origin}/e2e/kumite.fixture.html?view=arena&motion=full`, { waitUntil: 'domcontentloaded' });
  await motionPage.locator('.kumite-scoreboard__art').waitFor();
  await motionPage.mouse.move(1380, 900);
  await motionPage.waitForFunction(() => parseFloat(document.querySelector('.kumite-arena-scene').style.getPropertyValue('--arena-x')) > 0);
  const drift = await motionPage.locator('.kumite-arena-scene').evaluate(scene => ({ x: parseFloat(scene.style.getPropertyValue('--arena-x')), y: parseFloat(scene.style.getPropertyValue('--arena-y')) }));
  assert.ok(Math.abs(drift.x) <= 5 && Math.abs(drift.y) <= 3, 'Arena parallax stays within bounded layer offsets');
  await motionPage.emulateMedia({ reducedMotion: 'reduce' });
  await motionPage.waitForFunction(() => document.querySelector('.kumite-arena-scene').style.getPropertyValue('--arena-x') === '');
  await motionPage.waitForFunction(() => [...document.querySelectorAll('.kumite-arena-scene > img')].every(image => getComputedStyle(image).transform === 'none'));
  const transforms = await motionPage.locator('.kumite-arena-scene > img').evaluateAll(images => images.map(image => getComputedStyle(image).transform));
  assert.ok(transforms.every(transform => transform === 'none'), 'Reduced motion disables all arena layer transforms');
  report.push({ arenaPointerMotion: true, boundedDrift: drift, reducedMotionResetsLayers: true });
  console.log('Arena pointer parallax stays bounded; reduced motion removes transforms.');
  await motionContext.close();
} finally { await browser.close(); await writeFile(`${output}/verification.json`, JSON.stringify(report, null, 2)); }
