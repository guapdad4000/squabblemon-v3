import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve(import.meta.dirname, '../../deliverables/battle-hud-stability/screenshots');
mkdirSync(output, { recursive: true });
const fixture = '/squabblemon/e2e/battle-mobile.fixture.html';
const viewports = [
  ['desktop', 1688, 943], ['laptop', 1366, 768], ['ipad-portrait', 820, 1180],
  ['ipad-landscape', 1180, 820], ['mobile', 390, 844], ['short-phone', 320, 640],
  ['phone-landscape', 844, 390],
] as const;

async function readyArtwork(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  for (const selector of ['.battle-venue__art img', '.battle-rival-avatar img']) {
    const img = page.locator(selector); await expect(img).toHaveCount(1);
    await expect.poll(() => img.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await img.evaluate(node => (node as HTMLImageElement).decode());
  }
}
async function setState(page: Page, values: Record<string, unknown>) {
  await page.evaluate(values => {
    const fixture = (window as any).__battleHudFixture;
    for (const [key, value] of Object.entries(values)) fixture[key](value);
  }, values);
  if (values.setPhase) await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-presentation-phase', String(values.setPhase));
}
async function geometry(page: Page) {
  return page.locator('.battle-command-header,.battlefield-grid,.district-target,.battle-command-deck').evaluateAll(nodes => nodes.map(node => {
    // Impact shakes may transform the board. Layout offsets expose header reflow
    // without mistaking those intended animations for a layout regression.
    const el = node as HTMLElement;
    return { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
  }));
}
async function layoutBox(locator: Locator) {
  return locator.evaluate(node => {
    const el = node as HTMLElement;
    return { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
  });
}
async function hitTest(locator: Locator) {
  expect(await locator.evaluate(node => {
    const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && (hit === node || node.contains(hit));
  }), 'control is the topmost hit target').toBe(true);
}

for (const [name, width, height] of viewports) {
  test(`${name}: the board stays still through long feedback, effects, recaps, reading, and replay`, async ({ page, context }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${fixture}?locations=county-jail,time-square,bodega`);
    await expect(page.getByTestId('district-rule-0')).toBeVisible();
    await readyArtwork(page);
    const initial = await geometry(page); expect(initial.length).toBe(6);
    const speed = page.getByTestId('button-battle-speed'); await hitTest(speed);
    const speedBox = await layoutBox(speed);
    const claimsBox = await layoutBox(page.getByTestId('claims-live'));
    const timerBox = await layoutBox(page.getByTestId('turn-timer'));
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const phase of ['rival-thinking', 'rival-reveal', 'effects', 'round-result', 'round-intro', 'player-ready']) {
        await setState(page, { setRound: 2, setMessage: 'A long commentary message about the move and its targets. '.repeat(20), setEffectMode: phase === 'effects', setPhase: phase });
        expect(await geometry(page), `${phase} must not resize or move the board`).toEqual(initial);
        expect(await layoutBox(speed), `${phase} keeps speed in its slot`).toEqual(speedBox);
        expect(await layoutBox(page.getByTestId('claims-live'))).toEqual(claimsBox);
        expect(await layoutBox(page.getByTestId('turn-timer'))).toEqual(timerBox);
      }
    }
    await speed.click(); await expect(speed).toHaveAttribute('aria-pressed', 'true');
    await speed.click(); await expect(speed).toHaveAttribute('aria-pressed', 'false');
    await setState(page, { setPhase: 'rival-thinking' });
    const skip = page.getByTestId('button-fast-forward'); await hitTest(skip);
    const skipBox = await layoutBox(skip); await skip.click();
    await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-presentation-phase', 'player-ready');
    await expect(skip).toHaveCount(0);
    await setState(page, { setPhase: 'rival-reveal' }); expect(await layoutBox(skip)).toEqual(skipBox);
    await setState(page, { setEffectMode: true, setPhase: 'effects', setCue: { kind: 'event', title: 'Read the play', body: 'Every target and score change stays available.\n\n'.repeat(30), continueLabel: 'Back to battle' } });
    const cue = page.getByTestId('guided-reading-cue'); await expect(cue).toBeVisible();
    expect(await geometry(page)).toEqual(initial);
    const body = cue.locator('.guided-reading-cue__body');
    expect(await body.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    const keepGoing = page.getByTestId('button-continue-guided-reading'); await hitTest(keepGoing);
    await keepGoing.click(); await expect(cue).toHaveCount(0); expect(await geometry(page)).toEqual(initial);
    await setState(page, { setReplayStep: 'before' });
    const replay = page.getByTestId('replay-controls'); await expect(replay).toBeVisible();
    expect(await geometry(page)).toEqual(initial);
    expect(await layoutBox(page.getByTestId('claims-live'))).toEqual(claimsBox);
    await replay.getByRole('button', { name: 'After', exact: true }).click();
    await expect(replay.getByRole('button', { name: 'After', exact: true })).toBeDisabled();
    await replay.getByRole('button', { name: 'Return to live battle' }).click();
    await expect(replay).toHaveCount(0); expect(await geometry(page)).toEqual(initial);
    await setState(page, { setEffectMode: false, setPhase: 'player-ready' });
    await page.locator('.battle-tools > summary').click();
    await expect(page.getByTestId('button-battle-history')).toBeVisible(); await hitTest(page.getByTestId('button-battle-history'));
    expect(await geometry(page)).toEqual(initial);
    await page.locator('.battle-tools > summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    // Capture a fresh ready state so a previous effect's score tween is not mistaken for static UI.
    await page.close(); page = await context.newPage();
    await page.setViewportSize({ width, height });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${fixture}?locations=county-jail,time-square,bodega`);
    await expect(page.getByTestId('district-rule-0')).toBeVisible();
    await readyArtwork(page);
    await expect.poll(() => page.locator('.battle-board-card img.collector-portrait').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.mouse.move(width / 2, 5);
    await page.screenshot({ path: `${output}/${name}.png` }); expect(errors).toEqual([]);
  });
}

test('PvP keeps its identity plates and stable board during commentary and effects', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${fixture}?pvp`); await expect(page.getByTestId('district-rule-0')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const art = page.locator('.battle-venue__art img');
  await expect.poll(() => art.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await art.evaluate(node => (node as HTMLImageElement).decode());
  const initial = await geometry(page);
  for (const phase of ['rival-thinking', 'effects', 'round-result', 'player-ready']) {
    await setState(page, { setPhase: phase, setEffectMode: phase === 'effects', setMessage: 'Long rival commentary. '.repeat(30) });
    expect(await geometry(page)).toEqual(initial);
  }
  await expect(page.getByTestId('pvp-player-avatar')).toBeVisible();
  await expect(page.getByTestId('pvp-rival-avatar')).toBeVisible();
  await expect(page.getByTestId('button-battle-speed')).toHaveCount(0);
  await page.screenshot({ path: `${output}/pvp-desktop.png` });
});
