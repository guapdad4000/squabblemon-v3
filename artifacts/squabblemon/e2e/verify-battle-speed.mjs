/**
 * PvE speed toggle: the pill persists, retimes the broadcast, and never reaches PvP.
 * Run against a dev server: JOURNEY_ORIGIN=http://127.0.0.1:PORT node e2e/verify-battle-speed.mjs
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = (process.env.JOURNEY_ORIGIN ?? 'http://127.0.0.1:5173/squabblemon').replace(/\/$/, '');
const launch = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL
  ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL, headless: true }
  : { headless: true };
const browser = await chromium.launch(launch);
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem('squabblemon_e2e_user', 'signed-in');
  localStorage.setItem('squabblemon.preview-decks.v1', JSON.stringify([{
    id: 'speed-toggle-check', name: 'Speed Test Gang', heroCardId: 'cornball', recipeId: null,
    cardIds: ['cornball', 'earthy-sugar-foot', 'plug', 'gamer', 'snow-bunny', 'wifey', 'baby-momma'],
    valid: true, issues: [],
  }]));
});

const arena = () => page.locator('[data-testid="battle-arena"]');
const pill = () => page.getByTestId('button-battle-speed');
const openBattle = async () => {
  await page.goto(`${origin}/game/decks/speed-toggle-check/test`, { waitUntil: 'domcontentloaded' });
  await arena().waitFor();
};

/**
 * Computed animation timing for representative presentation rules: the last
 * dealt card, a revealed board card, an attack impact and the opening dust.
 */
const presentationDurations = () => page.evaluate(() => {
  const arenaNode = document.querySelector('[data-testid="battle-arena"]');
  const probe = (className, tag = 'div', parentClass = null) => {
    const host = parentClass ? Object.assign(document.createElement('div'), { className: parentClass }) : arenaNode;
    if (parentClass) arenaNode.appendChild(host);
    const node = document.createElement(tag);
    node.className = className;
    host.appendChild(node);
    const style = getComputedStyle(node);
    const read = (value) => Math.round(parseFloat(value) * 1000);
    const result = { duration: read(style.animationDuration.split(',')[0]), delay: read(style.animationDelay.split(',')[0]) };
    node.remove();
    if (parentClass) host.remove();
    return result;
  };
  // The deal rule only applies during the deal phase; borrow the class briefly.
  const hadDealPhase = arenaNode.classList.contains('phase-deal');
  arenaNode.classList.add('phase-deal');
  const tray = document.createElement('div');
  tray.id = 'hand-tray';
  arenaNode.appendChild(tray);
  for (let index = 0; index < 5; index++) tray.appendChild(document.createElement('button'));
  const dealt = getComputedStyle(tray.lastElementChild);
  const deal = { duration: Math.round(parseFloat(dealt.animationDuration) * 1000), delay: Math.round(parseFloat(dealt.animationDelay) * 1000) };
  tray.remove();
  if (!hadDealPhase) arenaNode.classList.remove('phase-deal');
  return {
    deal,
    reveal: probe('battle-board-card card-reveal-flip'),
    impact: probe('battle-board-card effect-target beat-impact'),
  };
});

const smokeDuration = async () => {
  const smoke = page.locator('.battle-start-smoke');
  if (!await smoke.count()) return null;
  return smoke.evaluate(node => Math.round(parseFloat(getComputedStyle(node).getPropertyValue('--battle-dust-duration'))));
};

try {
  await openBattle();
  // The pill is reachable while the opening cinematic still owns the screen.
  const cinematicPhase = await arena().getAttribute('data-presentation-phase');
  const normalTiming = await presentationDurations();
  const normalSmoke = await smokeDuration();
  await pill().waitFor();
  await pill().click();
  assert.equal(await arena().getAttribute('data-battle-speed'), 'fast');
  assert.equal(await pill().getAttribute('aria-pressed'), 'true');
  const stillCinematic = await arena().getAttribute('data-presentation-phase');
  console.log(`cinematic phase before toggle: ${cinematicPhase}, after: ${stillCinematic}`);
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="battle-arena"]')).getPropertyValue('--presentation-speed').trim()),
    '1.5',
  );

  // Arena animations, not just the variable, must retime with the choice.
  const fastTiming = await presentationDurations();
  const fastSmoke = await smokeDuration();
  console.log('normal timing', normalTiming, 'fast timing', fastTiming);
  console.log('smoke ms — normal:', normalSmoke, 'fast:', fastSmoke);
  for (const key of ['deal', 'reveal', 'impact']) {
    assert.ok(normalTiming[key].duration > 0, `${key} should animate at normal speed`);
    assert.equal(fastTiming[key].duration, Math.round(normalTiming[key].duration / 1.5), `${key} duration should scale`);
    assert.equal(fastTiming[key].delay, Math.round(normalTiming[key].delay / 1.5), `${key} delay should scale`);
  }
  if (normalSmoke !== null && fastSmoke !== null) {
    assert.equal(fastSmoke, Math.round(normalSmoke / 1.5), 'the opening dust should clear with the accelerated intro');
  }

  const ready = page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]');
  await ready.waitFor({ timeout: 20000 });
  await page.screenshot({ path: 'screenshots/battle-speed-phone.png' });

  // The choice survives a reload.
  await openBattle();
  await pill().waitFor();
  assert.equal(await arena().getAttribute('data-battle-speed'), 'fast');

  // Fast mode reaches the decision faster than normal mode.
  const timeToReady = async () => {
    const started = Date.now();
    await openBattle();
    await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').waitFor({ timeout: 30000 });
    return Date.now() - started;
  };
  const fastMs = await timeToReady();
  await pill().click();
  assert.equal(await arena().getAttribute('data-battle-speed'), 'normal');
  const normalMs = await timeToReady();
  console.log(`intro to decision — fast: ${fastMs}ms, normal: ${normalMs}ms`);
  assert.ok(fastMs < normalMs, `1.5x should reach the decision sooner (fast ${fastMs}ms vs normal ${normalMs}ms)`);

  // Desktop layout keeps the pill beside the skip control.
  await page.setViewportSize({ width: 1280, height: 800 });
  await openBattle();
  await pill().waitFor();
  const [pillBox, skipBox] = await Promise.all([
    pill().boundingBox(),
    page.getByTestId('button-fast-forward').boundingBox().catch(() => null),
  ]);
  console.log('pill box', pillBox, 'skip box', skipBox);
  assert.ok(pillBox && pillBox.width > 0 && pillBox.height >= 28);
  await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').waitFor({ timeout: 30000 });
  await page.screenshot({ path: 'screenshots/battle-speed-desktop.png' });

  assert.deepEqual(errors, []);
  console.log('Battle speed toggle verified.');
} finally {
  await browser.close();
}
